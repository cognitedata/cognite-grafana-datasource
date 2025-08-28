import React, { useState, useEffect, useCallback } from 'react';
import { AsyncSelect, Alert, InlineFieldRow, InlineField, CodeEditor, Field } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { SelectedProps } from '../types';
import { stringifyError, fetchStreams, Stream } from '../cdf/client';

interface RecordsTabProps extends SelectedProps {
  connector: any;
}

const sampleJsonQuery = `{
  "lastUpdatedTime": {
    "gt": "\${__from}",
    "lt": "\${__to}"
  },
  "aggregates": {
    "rate": {
      "timeHistogram": {
        "property": ["lastUpdatedTime"],
        "fixedInterval": "\${__interval}",
        "aggregates": {
          "avgPower": {
            "avg": {
              "property": ["elwiz", "MeterReading", "power"]
            }
          },
          "maxPower": {
            "max": {
              "property": ["elwiz", "MeterReading", "power"]
            }
          },
          "minPower": {
            "min": {
              "property": ["elwiz", "MeterReading", "power"]
            }
          }
        }
      }
    }
  }
}`;



export const RecordsTab: React.FC<RecordsTabProps> = ({
  query,
  onQueryChange,
  connector,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { recordsQuery = { streamId: '', jsonQuery: '' } } = query;
  
  // Initialize with sample query if empty
  const jsonQueryValue = recordsQuery.jsonQuery || sampleJsonQuery;

  const searchStreams = useCallback(async (searchQuery: string) => {
    try {
      setLoading(true);
      console.log('Loading streams, search query:', searchQuery);
      const streams = await fetchStreams(connector);
      console.log('Loaded streams:', streams.length);

      // If no search query, return all streams (first 50 for performance)
      const filteredStreams = searchQuery.trim() 
        ? streams.filter(stream =>
            stream.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            stream.externalId.toLowerCase().includes(searchQuery.toLowerCase()) ||
            stream.description?.toLowerCase().includes(searchQuery.toLowerCase())
          )
        : streams.slice(0, 50); // Limit to first 50 when no search

      const streamOptions = filteredStreams.map((stream: Stream) => ({
        label: stream.name || stream.externalId,
        value: stream.externalId,
        description: stream.description,
        externalId: stream.externalId,
        name: stream.name,
      }));
      
      setError(null);
      console.log('Stream options:', streamOptions.length);
      return streamOptions;
    } catch (err) {
      const errorMsg = `Stream search failed: ${stringifyError(err)}`;
      console.error('Stream loading error:', err);
      setError(errorMsg);
      return [];
    } finally {
      setLoading(false);
    }
  }, [connector]);

  const handleStreamSelection = (selectedStream: SelectableValue | null) => {
    onQueryChange({
      recordsQuery: {
        ...recordsQuery,
        streamId: selectedStream?.value || '',
      },
    });
  };



  const getCurrentStreamValue = () => {
    if (recordsQuery.streamId) {
      return {
        label: recordsQuery.streamId, // Fallback to streamId for now
        value: recordsQuery.streamId,
        externalId: recordsQuery.streamId,
      };
    }
    return null;
  };

  return (
    <div>
      <div className="gf-form-group">
        <InlineFieldRow>
          <InlineField
            label="Stream"
            labelWidth={14}
            tooltip="Select the stream to query records from"
          >
            <AsyncSelect
              loadOptions={searchStreams}
              value={getCurrentStreamValue()}
              onChange={handleStreamSelection}
              placeholder="Search streams by name or external ID"
              isClearable
              isLoading={loading}
              width={40}
              noOptionsMessage="No streams found"
              inputId={`records-stream-search-${query.refId}`}
              defaultOptions
            />
          </InlineField>
        </InlineFieldRow>

        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
          <Field 
            label="Query"
            style={{ flex: 1 }}
          >
            <CodeEditor
              value={jsonQueryValue}
              language="json"
              height={300}
              onBlur={(value) => {
                onQueryChange({
                  recordsQuery: {
                    ...recordsQuery,
                    jsonQuery: value,
                  },
                });
              }}
              onSave={(value) => {
                onQueryChange({
                  recordsQuery: {
                    ...recordsQuery,
                    jsonQuery: value,
                  },
                });
              }}
              showMiniMap={false}
              showLineNumbers
            />
          </Field>
          
          <div style={{ 
            minWidth: '300px',
            padding: '16px', 
            border: '1px solid var(--border-weak)',
            borderRadius: '2px', 
            fontSize: '13px',
            backgroundColor: 'var(--background-secondary)',
            color: 'var(--text-primary)',
            marginTop: '30px' // Align with the code editor content
          }}>
            <div style={{ fontWeight: 600, marginBottom: '12px', color: 'var(--text-primary)' }}>
              Template Variables
            </div>
            <div style={{ lineHeight: '1.5' }}>
              <div style={{ marginBottom: '8px' }}>
                <code style={{ 
                  backgroundColor: 'var(--background-canvas)', 
                  padding: '3px 6px', 
                  borderRadius: '3px',
                  fontFamily: 'monospace'
                }}>
                  {'${__from}'}
                </code>
                <br />
                <span style={{ color: 'var(--text-secondary)' }}>Start of time range (epoch ms)</span>
              </div>
              <div style={{ marginBottom: '8px' }}>
                <code style={{ 
                  backgroundColor: 'var(--background-canvas)', 
                  padding: '3px 6px', 
                  borderRadius: '3px',
                  fontFamily: 'monospace'
                }}>
                  {'${__to}'}
                </code>
                <br />
                <span style={{ color: 'var(--text-secondary)' }}>End of time range (epoch ms)</span>
              </div>
              <div>
                <code style={{ 
                  backgroundColor: 'var(--background-canvas)', 
                  padding: '3px 6px', 
                  borderRadius: '3px',
                  fontFamily: 'monospace'
                }}>
                  {'${__interval}'}
                </code>
                <br />
                <span style={{ color: 'var(--text-secondary)' }}>Query interval (e.g., "1h", "5m")</span>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <Alert title="Error" severity="error">
            {error}
          </Alert>
        )}
      </div>
    </div>
  );
};
