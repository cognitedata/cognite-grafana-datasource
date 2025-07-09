import React, { useState, useEffect, useCallback } from 'react';
import { Select, AsyncSelect, Alert, InlineFieldRow, InlineField, Input, InlineSwitch } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { SelectedProps } from '../types';
import { fetchDMSSpaces, fetchDMSViews, searchDMSInstances, stringifyError } from '../cdf/client';
import { DMSSpace, DMSView, DMSInstance } from '../types/dms';
import { CommonEditors, LabelEditor } from './commonEditors';

interface CogniteTimeSeriesSearchTabProps extends SelectedProps {
  connector: any;
}

const LatestValueCheckbox = (props: SelectedProps) => {
  const { query, onQueryChange } = props;
  return (
    <InlineFieldRow>
      <InlineField
        label="Latest value"
        labelWidth={14}
        tooltip="Fetch the latest data point in the provided time range"
      >
        <InlineSwitch
          label='Latest value'
          id={`latest-value-${query.refId}`}
          value={query.latestValue}
          onChange={({ currentTarget }) => onQueryChange({ latestValue: currentTarget.checked })}
        />
      </InlineField>
    </InlineFieldRow>
  );
};

export const CogniteTimeSeriesSearchTab: React.FC<CogniteTimeSeriesSearchTabProps> = ({
  query,
  onQueryChange,
  connector,
}) => {
  const [spaces, setSpaces] = useState<SelectableValue[]>([]);
  const [views, setViews] = useState<SelectableValue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { cogniteTimeSeriesSearchQuery } = query;

  const loadSpaces = useCallback(async () => {
    try {
      setLoading(true);
      const spacesData = await fetchDMSSpaces(connector);
      const spaceOptions = spacesData.map((space: DMSSpace) => ({
        label: space.name || space.space,
        value: space.space,
        description: space.description,
      }));
      setSpaces(spaceOptions);
      setError(null);
    } catch (err) {
      setError(`Failed to load spaces: ${stringifyError(err)}`);
    } finally {
      setLoading(false);
    }
  }, [connector]);

  const loadViews = useCallback(async (space: string) => {
    try {
      setLoading(true);
      const viewsData = await fetchDMSViews(connector, space);
      const viewOptions = viewsData.map((view: DMSView) => ({
        label: view.name || view.externalId,
        value: view.externalId,
        description: view.description,
      }));
      setViews(viewOptions);
      setError(null);
    } catch (err) {
      setError(`Failed to load views for space ${space}: ${stringifyError(err)}`);
    } finally {
      setLoading(false);
    }
  }, [connector]);

  const searchTimeseries = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || !cogniteTimeSeriesSearchQuery.space || !cogniteTimeSeriesSearchQuery.externalId) {
      return [];
    }

    try {
      const searchRequest = {
        view: {
          type: 'view' as const,
          space: cogniteTimeSeriesSearchQuery.space,
          externalId: cogniteTimeSeriesSearchQuery.externalId,
          version: cogniteTimeSeriesSearchQuery.version,
        },
        query: searchQuery,
        filter: {
          not: {
            equals: {
              property: ['type'],
              value: 'string',
            },
          },
        },
        limit: 1000,
      };

      const instances = await searchDMSInstances(connector, searchRequest);
      const tsOptions = instances.map((instance: DMSInstance) => {
        const name = instance.properties?.[cogniteTimeSeriesSearchQuery.space]?.[`${cogniteTimeSeriesSearchQuery.externalId}/${cogniteTimeSeriesSearchQuery.version}`]?.name || instance.externalId;
        return {
          label: name,
          value: `${instance.space}:${instance.externalId}`,
          description: `Space: ${instance.space}, External ID: ${instance.externalId}`,
          space: instance.space,
          externalId: instance.externalId,
          name: name,
        };
      });
      return tsOptions;
    } catch (err) {
      setError(`Search failed: ${stringifyError(err)}`);
      return [];
    }
  }, [connector, cogniteTimeSeriesSearchQuery.space, cogniteTimeSeriesSearchQuery.externalId, cogniteTimeSeriesSearchQuery.version]);

  useEffect(() => {
    loadSpaces();
  }, [loadSpaces]);

  useEffect(() => {
    if (cogniteTimeSeriesSearchQuery.space) {
      loadViews(cogniteTimeSeriesSearchQuery.space);
    }
  }, [cogniteTimeSeriesSearchQuery.space, loadViews]);

  const handleSpaceChange = (selectedSpace: SelectableValue | null) => {
    onQueryChange({
      cogniteTimeSeriesSearchQuery: {
        ...cogniteTimeSeriesSearchQuery,
        space: selectedSpace?.value || '',
        externalId: '', // Reset external ID when space changes
        selectedTimeseries: undefined, // Reset selected timeseries
      },
    });
  };

  const handleVersionChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onQueryChange({
      cogniteTimeSeriesSearchQuery: {
        ...cogniteTimeSeriesSearchQuery,
        version: event.target.value,
        selectedTimeseries: undefined, // Reset selected timeseries when version changes
      },
    });
  };

  const handleExternalIdChange = (selectedView: SelectableValue | null) => {
    onQueryChange({
      cogniteTimeSeriesSearchQuery: {
        ...cogniteTimeSeriesSearchQuery,
        externalId: selectedView?.value || '',
        selectedTimeseries: undefined, // Reset selected timeseries
      },
    });
  };

  const handleTimeseriesSelection = (selectedTimeseries: SelectableValue | null) => {
    onQueryChange({
      cogniteTimeSeriesSearchQuery: {
        ...cogniteTimeSeriesSearchQuery,
        selectedTimeseries: selectedTimeseries ? {
          // PR Feedback: We need space field here because top-level space (e.g., "cdf_cdm") 
          // is used for searching/listing in DMS view, while selectedTimeseries.space 
          // (e.g., "cdm_try") is where the actual selected instance lives for data queries
          space: selectedTimeseries.space,
          externalId: selectedTimeseries.externalId,
        } : undefined,
      },
    });
  };

  const getCurrentTimeseriesValue = () => {
    if (cogniteTimeSeriesSearchQuery.selectedTimeseries) {
      // Use the space from selectedTimeseries since that's where the instance actually lives
      const space = cogniteTimeSeriesSearchQuery.selectedTimeseries.space;
      const externalId = cogniteTimeSeriesSearchQuery.selectedTimeseries.externalId;
      return {
        label: externalId, // Fallback to externalId since name will be loaded at runtime
        value: `${space}:${externalId}`,
        space: space,
        externalId: externalId,
        name: externalId, // Fallback to externalId for now
      };
    }
    return null;
  };

  return (
    <div>
      <div className="gf-form-group">
        <InlineFieldRow>
          <InlineField
            label="Space"
            labelWidth={14}
            tooltip="Select the space to search in"
          >
            <Select
              options={spaces}
              value={cogniteTimeSeriesSearchQuery.space}
              onChange={handleSpaceChange}
              placeholder="Select space"
              isClearable
              isLoading={loading}
              width={20}
            />
          </InlineField>
        </InlineFieldRow>

        <InlineFieldRow>
          <InlineField
            label="Version"
            labelWidth={14}
            tooltip="Version of the view"
          >
            <Input
              value={cogniteTimeSeriesSearchQuery.version}
              onChange={handleVersionChange}
              placeholder="v1"
              width={20}
            />
          </InlineField>
        </InlineFieldRow>

        <InlineFieldRow>
          <InlineField
            label="View"
            labelWidth={14}
            tooltip="Select the view to search in"
          >
            <Select
              options={views}
              value={cogniteTimeSeriesSearchQuery.externalId}
              onChange={handleExternalIdChange}
              placeholder="Select view"
              isClearable
              isLoading={loading}
              width={20}
            />
          </InlineField>
        </InlineFieldRow>

        <InlineFieldRow>
          <InlineField
            label="Search"
            labelWidth={14}
            tooltip="Search for timeseries by name or description"
          >
            <AsyncSelect
              key={`${cogniteTimeSeriesSearchQuery.space}-${cogniteTimeSeriesSearchQuery.version}-${cogniteTimeSeriesSearchQuery.externalId}`}
              loadOptions={searchTimeseries}
              value={getCurrentTimeseriesValue()}
              onChange={handleTimeseriesSelection}
              placeholder="Search timeseries by name/description"
              isClearable
              width={40}
              noOptionsMessage="No timeseries found"
              inputId={`cognite-timeseries-search-${query.refId}`}
            />
          </InlineField>
        </InlineFieldRow>

        <LatestValueCheckbox {...{ query, onQueryChange }} />
        {!query.latestValue && (
          <CommonEditors {...{ query, onQueryChange }} />
        )}

        {error && (
          <Alert title="Information" severity="info">
            {error}
          </Alert>
        )}
      </div>
      {query.latestValue && (
        <LabelEditor {...{ onQueryChange, query }} />
      )}
    </div>
  );
};
