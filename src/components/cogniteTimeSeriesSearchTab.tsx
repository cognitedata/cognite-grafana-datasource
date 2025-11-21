import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Select, AsyncSelect, Alert, InlineFieldRow, InlineField, Input, InlineSwitch } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { SelectedProps } from '../types';
import { fetchDMSSpaces, fetchDMSViews, searchDMSInstances, fetchCogniteUnits, getTimeSeriesUnit, stringifyError } from '../cdf/client';
import { DMSSpace, DMSView, DMSInstance, DMSSearchRequest, CogniteUnit } from '../types/dms';
import { CommonEditors, LabelEditor } from './commonEditors';
import { Connector } from '../connector';

interface CogniteTimeSeriesSearchTabProps extends SelectedProps {
  connector: Connector;
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
  const [units, setUnits] = useState<CogniteUnit[]>([]);
  const [timeSeriesUnit, setTimeSeriesUnit] = useState<string | undefined>(undefined);
  const [loadingUnits, setLoadingUnits] = useState(false);

  const { cogniteTimeSeries } = query;

  // Create a stable key for instanceId to trigger useEffect
  const instanceIdKey = useMemo(
    () => cogniteTimeSeries.instanceId
      ? `${cogniteTimeSeries.instanceId.space}:${cogniteTimeSeries.instanceId.externalId}`
      : undefined,
    [cogniteTimeSeries.instanceId]
  );

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
    if (!searchQuery.trim() || !cogniteTimeSeries.space || !cogniteTimeSeries.externalId) {
      return [];
    }

    try {
      const searchRequest: DMSSearchRequest = {
        view: {
          type: 'view',
          space: cogniteTimeSeries.space,
          externalId: cogniteTimeSeries.externalId,
          version: cogniteTimeSeries.version,
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
        const name = instance.properties?.[cogniteTimeSeries.space]?.[`${cogniteTimeSeries.externalId}/${cogniteTimeSeries.version}`]?.name || instance.externalId;
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
  }, [connector, cogniteTimeSeries.space, cogniteTimeSeries.externalId, cogniteTimeSeries.version]);

  useEffect(() => {
    loadSpaces();
  }, [loadSpaces]);

  useEffect(() => {
    if (cogniteTimeSeries.space) {
      loadViews(cogniteTimeSeries.space);
    }
  }, [cogniteTimeSeries.space, loadViews]);

  // Load available units
  useEffect(() => {
    const loadUnits = async () => {
      try {
        setLoadingUnits(true);
        const unitsData = await fetchCogniteUnits(connector);
        setUnits(unitsData);
      } catch (err) {
        console.warn('Failed to load units:', stringifyError(err));
      } finally {
        setLoadingUnits(false);
      }
    };
    loadUnits();
  }, [connector]);

  // Fetch the unit of the selected timeseries
  useEffect(() => {
    const fetchUnit = async () => {
      const instanceId = cogniteTimeSeries.instanceId;
      if (instanceId?.space && instanceId?.externalId) {
        setLoadingUnits(true);
        try {
          const unit = await getTimeSeriesUnit(connector, instanceId);
          setTimeSeriesUnit(unit);
        } catch (err) {
          console.warn('Failed to fetch timeseries unit:', stringifyError(err));
          setTimeSeriesUnit(undefined);
        } finally {
          setLoadingUnits(false);
        }
      } else {
        setTimeSeriesUnit(undefined);
      }
    };
    fetchUnit();
  }, [connector, instanceIdKey, cogniteTimeSeries.instanceId]);

  const handleSpaceChange = (selectedSpace: SelectableValue | null) => {
    onQueryChange({
      cogniteTimeSeries: {
        ...cogniteTimeSeries,
        space: selectedSpace?.value || '',
        externalId: '', // Reset external ID when space changes
        instanceId: undefined, // Reset selected timeseries
      },
    });
  };

  const handleVersionChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onQueryChange({
      cogniteTimeSeries: {
        ...cogniteTimeSeries,
        version: event.target.value,
        instanceId: undefined, // Reset selected timeseries when version changes
      },
    });
  };

  const handleExternalIdChange = (selectedView: SelectableValue | null) => {
    onQueryChange({
      cogniteTimeSeries: {
        ...cogniteTimeSeries,
        externalId: selectedView?.value || '',
        instanceId: undefined, // Reset selected timeseries
      },
    });
  };

  const handleTimeseriesSelection = (selectedTimeseries: SelectableValue | null) => {
    onQueryChange({
      cogniteTimeSeries: {
        ...cogniteTimeSeries,
        instanceId: selectedTimeseries ? {
          // PR Feedback: We need space field here because top-level space (e.g., "cdf_cdm") 
          // is used for searching/listing in DMS view, while instanceId.space 
          // (e.g., "cdm_try") is where the actual selected instance lives for data queries
          space: selectedTimeseries.space,
          externalId: selectedTimeseries.externalId,
        } : undefined,
      },
    });
  };

  const getCurrentTimeseriesValue = () => {
    if (cogniteTimeSeries.instanceId) {
      // Use the space from instanceId since that's where the instance actually lives
      const space = cogniteTimeSeries.instanceId.space;
      const externalId = cogniteTimeSeries.instanceId.externalId;
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

  const handleTargetUnitChange = (selectedUnit: SelectableValue | null) => {
    onQueryChange({
      cogniteTimeSeries: {
        ...cogniteTimeSeries,
        targetUnit: selectedUnit?.value,
      },
    });
  };

  // Get the display name for a unit
  const getUnitDisplayName = (unitExternalId: string): string => {
    const unit = units.find(u => u.externalId === unitExternalId);
    if (!unit) {
      return unitExternalId;
    }
    const displayName = unit.description || unit.name;
    return unit.symbol ? `${displayName} (${unit.symbol})` : displayName;
  };

  // Get units filtered by selected quantity
  const getFilteredUnits = (): SelectableValue[] => {
    if (!timeSeriesUnit) {
      return [];
    }

    let filteredUnits = units;
    const tsUnit = units.find((u) => u.externalId === timeSeriesUnit);
    if (tsUnit?.quantity) {
      filteredUnits = units.filter((u) => u.quantity === tsUnit.quantity);
    }

    const options = filteredUnits.map((unit) => {
      const label = unit.symbol ? `${unit.description || unit.name} (${unit.symbol})` : (unit.description || unit.name);
      return {
        label,
        value: unit.externalId,
        description: unit.description,
      };
    });
    return options;
  };

  const isUnitConversionEnabled = !!timeSeriesUnit && !!cogniteTimeSeries.instanceId;

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
              value={cogniteTimeSeries.space}
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
              value={cogniteTimeSeries.version}
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
              value={cogniteTimeSeries.externalId}
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
              key={`${cogniteTimeSeries.space}-${cogniteTimeSeries.version}-${cogniteTimeSeries.externalId}`}
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
          {timeSeriesUnit && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              marginLeft: '8px',
              color: 'rgba(204, 204, 220, 0.65)',
              fontSize: '12px',
              whiteSpace: 'nowrap'
            }}>
              Unit: {getUnitDisplayName(timeSeriesUnit)}
            </div>
          )}
        </InlineFieldRow>

        {cogniteTimeSeries.instanceId && isUnitConversionEnabled && (
          <InlineFieldRow>
            <InlineField
              label="Target Unit"
              labelWidth={14}
              tooltip={`Convert data to target unit. Current unit: ${getUnitDisplayName(timeSeriesUnit)}`}
            >
              <Select
                options={getFilteredUnits()}
                value={cogniteTimeSeries.targetUnit || timeSeriesUnit}
                onChange={handleTargetUnitChange}
                placeholder="Select target unit"
                isClearable
                isLoading={loadingUnits}
                width={40}
              />
            </InlineField>
          </InlineFieldRow>
        )}

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
