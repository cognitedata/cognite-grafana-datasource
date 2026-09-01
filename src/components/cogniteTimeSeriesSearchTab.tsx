import React, { useState, useEffect, useMemo } from 'react';
import { Select, Alert, Badge, BadgeColor, InlineFieldRow, InlineField, InlineSwitch } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { SelectedProps } from '../types';
import { getCogniteUnitIndex, getTimeSeriesProperties, stringifyError } from '../cdf/client';
import { encodeInstanceRef, InstancePicker, PickedInstance } from './common/InstancePicker';
import { ViewPicker } from './common/ViewPicker';
import { CogniteUnit, InvolvedView } from '../types/dms';
import { CommonEditors, LabelEditor } from './commonEditors';
import { Connector } from '../connector';

interface CogniteTimeSeriesSearchTabProps extends SelectedProps {
  connector: Connector;
}

const TYPE_BADGE_COLORS: Record<string, BadgeColor> = {
  numeric: 'blue',
  string: 'orange',
  state: 'purple',
};

export const getTypeBadgeColor = (type: string): BadgeColor =>
  TYPE_BADGE_COLORS[type] ?? 'darkgrey';

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
  const [error, setError] = useState<string | null>(null);
  const [units, setUnits] = useState<CogniteUnit[]>([]);
  const [timeSeriesUnit, setTimeSeriesUnit] = useState<string | undefined>(undefined);
  const [timeSeriesType, setTimeSeriesType] = useState<string | undefined>(undefined);
  const [loadingUnits, setLoadingUnits] = useState(false);

  const { cogniteTimeSeries, cogniteActivityQuery } = query;

  // Create a stable key for instanceId to trigger useEffect
  const instanceIdKey = useMemo(
    () => cogniteTimeSeries.instanceId
      ? `${cogniteTimeSeries.instanceId.space}:${cogniteTimeSeries.instanceId.externalId}`
      : undefined,
    [cogniteTimeSeries.instanceId]
  );

  // Load available units
  useEffect(() => {
    const loadUnits = async () => {
      try {
        setLoadingUnits(true);
        // Shares the cached catalog with label interpolation, so the units are fetched
        // and indexed once per connector.
        const unitIndex = await getCogniteUnitIndex(connector);
        setUnits([...unitIndex.values()]);
      } catch (err) {
        console.warn('Failed to load units:', stringifyError(err));
      } finally {
        setLoadingUnits(false);
      }
    };
    loadUnits();
  }, [connector]);

  // Fetch the unit and type of the selected timeseries in a single byids call
  useEffect(() => {
    const fetchProperties = async () => {
      const instanceId = cogniteTimeSeries.instanceId;
      if (instanceId?.space && instanceId?.externalId) {
        setLoadingUnits(true);
        try {
          const { unit, type } = await getTimeSeriesProperties(connector, instanceId);
          setTimeSeriesUnit(unit);
          setTimeSeriesType(type);
        } catch (err) {
          console.warn('Failed to fetch timeseries properties:', stringifyError(err));
          setTimeSeriesUnit(undefined);
          setTimeSeriesType(undefined);
        } finally {
          setLoadingUnits(false);
        }
      } else {
        setTimeSeriesUnit(undefined);
        setTimeSeriesType(undefined);
      }
    };
    fetchProperties();
  }, [connector, instanceIdKey, cogniteTimeSeries.instanceId]);

  // String timeseries don't support aggregations — pin aggregation to 'none'
  useEffect(() => {
    if (timeSeriesType === 'string' && query.aggregation !== 'none') {
      onQueryChange({ aggregation: 'none' });
    }
  }, [timeSeriesType, query.aggregation, onQueryChange]);

  const handleViewChange = (view: InvolvedView | null) => {
    onQueryChange({
      cogniteTimeSeries: {
        ...cogniteTimeSeries,
        space: view?.space || '',
        externalId: view?.externalId || '',
        version: view?.version || '',
        instanceId: undefined, // Reset selected timeseries when view changes
      },
    });
  };

  const handleTimeseriesSelection = (picked: PickedInstance[]) => {
    const selected = picked[0];
    const type = selected?.props?.type;
    setTimeSeriesType(type);
    onQueryChange({
      cogniteTimeSeries: {
        ...cogniteTimeSeries,
        instanceId: selected?.space && selected?.externalId ? {
          // PR Feedback: We need space field here because top-level space (e.g., "cdf_cdm")
          // is used for searching/listing in DMS view, while instanceId.space
          // (e.g., "cdm_try") is where the actual selected instance lives for data queries
          space: selected.space,
          externalId: selected.externalId,
        } : undefined,
      },
      // String timeseries don't support aggregations — pin to 'none' on selection
      ...(type === 'string' ? { aggregation: 'none' } : {}),
    });
  };

  const getCurrentTimeseriesValue = (): PickedInstance[] => {
    const instanceId = cogniteTimeSeries.instanceId;
    if (!instanceId) {
      return [];
    }
    // Use the space from instanceId since that's where the instance actually lives
    return [{
      value: encodeInstanceRef({ space: instanceId.space, externalId: instanceId.externalId }),
      space: instanceId.space,
      externalId: instanceId.externalId,
    }];
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
  const isStateType = timeSeriesType === 'state';

  // Activity overlay handlers
  const handleActivityOverlayToggle = (checked: boolean) => {
    onQueryChange({
      cogniteActivityQuery: {
        ...cogniteActivityQuery,
        enabled: checked,
      },
    });
  };

  const handleActivityViewChange = (view: InvolvedView | null) => {
    onQueryChange({
      cogniteActivityQuery: {
        ...cogniteActivityQuery,
        space: view?.space || 'cdf_cdm',
        externalId: view?.externalId || 'CogniteActivity',
        version: view?.version || 'v1',
      },
    });
  };

  const handleUseScheduledTimeToggle = (checked: boolean) => {
    onQueryChange({
      cogniteActivityQuery: {
        ...cogniteActivityQuery,
        useScheduledTime: checked,
      },
    });
  };

  return (
    <div>
      <div>
        <InlineFieldRow>
          <InlineField
            label="View"
            labelWidth={14}
            tooltip="Select a CogniteTimeSeries view to search in"
          >
            <ViewPicker
              connector={connector}
              container="CogniteTimeSeries"
              value={cogniteTimeSeries}
              onChange={handleViewChange}
              placeholder="Select a CogniteTimeSeries view"
              isClearable
              width={40}
              onError={setError}
            />
          </InlineField>
        </InlineFieldRow>

        <InlineFieldRow>
          <InlineField
            label="Search"
            labelWidth={14}
            tooltip="Search for timeseries by name or description"
          >
            <InstancePicker
              connector={connector}
              view={{
                space: cogniteTimeSeries.space,
                externalId: cogniteTimeSeries.externalId,
                version: cogniteTimeSeries.version,
              }}
              value={getCurrentTimeseriesValue()}
              onChange={handleTimeseriesSelection}
              placeholder="Search timeseries by name/description"
              width={40}
              noOptionsMessage="No timeseries found"
              inputId={`cognite-timeseries-search-${query.refId}`}
              badgeOf={(props) =>
                props.type
                  ? { text: props.type, color: getTypeBadgeColor(props.type) }
                  : undefined
              }
              onError={setError}
            />
          </InlineField>
        </InlineFieldRow>

        {cogniteTimeSeries.instanceId && isStateType && (
          <Alert title="Unsupported time series type" severity="info">
            State time series are not currently supported in Grafana.
          </Alert>
        )}

        {cogniteTimeSeries.instanceId && isUnitConversionEnabled && !isStateType && (
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
            {timeSeriesUnit && (
              <InlineField transparent style={{ alignItems: 'center' }}>
                <Badge
                  text={`Storage unit: ${getUnitDisplayName(timeSeriesUnit)}`}
                  color="darkgrey"
                />
              </InlineField>
            )}
          </InlineFieldRow>
        )}

        {/* Activity Overlay Section - only show when time series is selected */}
        {cogniteTimeSeries.instanceId && !isStateType && (
          <>
            <InlineFieldRow>
              <InlineField
                label="Activities"
                labelWidth={14}
                tooltip="Overlay activities from CogniteActivity views on the time series chart"
              >
                <InlineSwitch
                  label='Activities'
                  id={`overlay-activities-${query.refId}`}
                  value={cogniteActivityQuery?.enabled || false}
                  onChange={({ currentTarget }) => handleActivityOverlayToggle(currentTarget.checked)}
                />
              </InlineField>
            </InlineFieldRow>

            {cogniteActivityQuery?.enabled && (
              <>
                <InlineFieldRow>
                  <InlineField
                    label="View"
                    labelWidth={14}
                    tooltip="Select a CogniteActivity view to overlay"
                  >
                    <ViewPicker
                      connector={connector}
                      container="CogniteActivity"
                      value={cogniteActivityQuery}
                      onChange={handleActivityViewChange}
                      placeholder="Select a CogniteActivity view"
                      isClearable
                      width={40}
                    />
                  </InlineField>
                </InlineFieldRow>

                <InlineFieldRow>
                  <InlineField
                    label="Scheduled"
                    labelWidth={14}
                    tooltip="Use scheduledStartTime/scheduledEndTime instead of actual startTime/endTime"
                  >
                    <InlineSwitch
                      label='Scheduled'
                      id={`use-scheduled-time-${query.refId}`}
                      value={cogniteActivityQuery?.useScheduledTime || false}
                      onChange={({ currentTarget }) => handleUseScheduledTimeToggle(currentTarget.checked)}
                    />
                  </InlineField>
                </InlineFieldRow>
              </>
            )}
          </>
        )}

        {!isStateType && (
          <>
            <LatestValueCheckbox {...{ query, onQueryChange }} />
            {!query.latestValue && (
              <CommonEditors
                {...{ query, onQueryChange }}
                hideAggregation={timeSeriesType === 'string'}
              />
            )}
          </>
        )}

        {error && (
          <Alert title="Information" severity="info">
            {error}
          </Alert>
        )}
      </div>
      {query.latestValue && !isStateType && (
        <LabelEditor {...{ onQueryChange, query }} />
      )}
    </div>
  );
};
