import React, { useState, useEffect, useCallback } from 'react';
import { AsyncSelect, Alert, InlineFieldRow, InlineField, CodeEditor, Field, InlineSwitch } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { SelectedProps, RecordsMode } from '../types';
import { stringifyError, fetchStreams, Stream } from '../cdf/client';

interface RecordsTabProps extends SelectedProps {
  connector: any;
}

const sampleAggregateQuery = `{
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

const sampleFilterQuery = `{
  "lastUpdatedTime": {
    "gt": "\${__from}",
    "lt": "\${__to}"
  },
  "limit": 100
}`;



export const RecordsTab: React.FC<RecordsTabProps> = ({
  query,
  onQueryChange,
  connector,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { recordsQuery = { streamId: '', mode: RecordsMode.Aggregate } } = query;
  
  // Handle backward compatibility and migration
  const migrateQuery = () => {
    if (recordsQuery.jsonQuery && !recordsQuery.aggregateQuery && !recordsQuery.filterQuery) {
      // Migrate old jsonQuery to appropriate mode-specific query
      const migrated = {
        ...recordsQuery,
        [recordsQuery.mode === RecordsMode.Filter ? 'filterQuery' : 'aggregateQuery']: recordsQuery.jsonQuery,
      };
      onQueryChange({ recordsQuery: migrated });
      return migrated;
    }
    return recordsQuery;
  };
  
  const currentRecordsQuery = migrateQuery();
  
  // Get the current query for the active mode
  const getCurrentModeQuery = () => {
    if (currentRecordsQuery.mode === RecordsMode.Filter) {
      return currentRecordsQuery.filterQuery || '';
    } else {
      return currentRecordsQuery.aggregateQuery || '';
    }
  };
  
  // Initialize with appropriate sample query based on mode if empty
  const getSampleQuery = () => {
    return currentRecordsQuery.mode === RecordsMode.Filter ? sampleFilterQuery : sampleAggregateQuery;
  };
  
  const currentModeQuery = getCurrentModeQuery();
  const jsonQueryValue = currentModeQuery || getSampleQuery();

  const searchStreams = useCallback(async (searchQuery: string) => {
    try {
      setLoading(true);
      const streams = await fetchStreams(connector);

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
      return streamOptions;
    } catch (err) {
      const errorMsg = `Stream search failed: ${stringifyError(err)}`;
      setError(errorMsg);
      return [];
    } finally {
      setLoading(false);
    }
  }, [connector]);

  // Auto-trigger query when recordsQuery has valid data (similar to TemplatesTab)
  useEffect(() => {
    // Only trigger if we have both streamId and current mode's query (valid query)
    const currentModeQueryValue = getCurrentModeQuery();
    if (currentRecordsQuery.streamId && currentModeQueryValue?.trim()) {
      onQueryChange({
        recordsQuery: currentRecordsQuery,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRecordsQuery]);

  const handleStreamSelection = (selectedStream: SelectableValue | null) => {
    // If current mode's query is empty, populate it with the sample query
    const currentModeQueryValue = getCurrentModeQuery();
    const queryToUse = currentModeQueryValue?.trim() || getSampleQuery();
    
    // Update the appropriate mode-specific query field
    const modeQueryField = currentRecordsQuery.mode === RecordsMode.Filter ? 'filterQuery' : 'aggregateQuery';
    
    const updatedRecordsQuery = {
      ...currentRecordsQuery,
      streamId: selectedStream?.value || '',
      [modeQueryField]: queryToUse,
    };
    
    // Pass only the patch to onQueryChange, similar to other tabs
    onQueryChange({
      recordsQuery: updatedRecordsQuery,
    });
  };

  const handleModeChange = (isFilter: boolean) => {
    const newMode = isFilter ? RecordsMode.Filter : RecordsMode.Aggregate;
    const newModeSample = newMode === RecordsMode.Filter ? sampleFilterQuery : sampleAggregateQuery;
    
    // Get the query for the new mode
    const newModeQuery = newMode === RecordsMode.Filter 
      ? currentRecordsQuery.filterQuery || '' 
      : currentRecordsQuery.aggregateQuery || '';
    
    let queryForNewMode;
    
    // Use sample query if the new mode's query is empty or exactly matches the sample
    const isUnmodifiedSample = newModeQuery === newModeSample;
    
    if (!newModeQuery.trim() || isUnmodifiedSample) {
      queryForNewMode = newModeSample;
    } else {
      queryForNewMode = newModeQuery;
    }
    
    // Update the appropriate mode-specific query field
    const newModeQueryField = newMode === RecordsMode.Filter ? 'filterQuery' : 'aggregateQuery';
    
    onQueryChange({
      recordsQuery: {
        ...currentRecordsQuery,
        mode: newMode,
        [newModeQueryField]: queryForNewMode,
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

        <InlineFieldRow>
          <InlineField
            label="Query Type"
            labelWidth={14}
            tooltip="Aggregate queries return statistical summaries (avg, max, min). Filter queries return raw records."
          >
            <InlineSwitch
              label="Use Filter (Raw Records)"
              value={recordsQuery.mode === RecordsMode.Filter}
              onChange={(e) => handleModeChange(e.currentTarget.checked)}
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
                // Update the appropriate mode-specific query field
                const modeQueryField = currentRecordsQuery.mode === RecordsMode.Filter ? 'filterQuery' : 'aggregateQuery';
                onQueryChange({
                  recordsQuery: {
                    ...currentRecordsQuery,
                    [modeQueryField]: value,
                  },
                });
              }}
              onSave={(value) => {
                // Update the appropriate mode-specific query field
                const modeQueryField = currentRecordsQuery.mode === RecordsMode.Filter ? 'filterQuery' : 'aggregateQuery';
                onQueryChange({
                  recordsQuery: {
                    ...currentRecordsQuery,
                    [modeQueryField]: value,
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
                  {recordsQuery.mode === RecordsMode.Filter ? 'Filter Query Help' : 'Aggregate Query Help'}
                </div>
                {recordsQuery.mode === RecordsMode.Filter ? (
                  <div style={{ marginBottom: '12px', lineHeight: '1.5', color: 'var(--text-secondary)' }}>
                    <strong>Filter queries</strong> return raw record data. Use filters, sources, sorting, and limits to retrieve specific records.
                  </div>
                ) : (
                  <div style={{ marginBottom: '12px', lineHeight: '1.5', color: 'var(--text-secondary)' }}>
                    <strong>Aggregate queries</strong> return statistical summaries like averages, min/max values, and time histograms.
                  </div>
                )}
                <div style={{ fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)' }}>
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
