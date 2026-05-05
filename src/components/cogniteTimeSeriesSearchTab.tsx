import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Select, AsyncSelect, Alert, Badge, BadgeColor, InlineFieldRow, InlineField, InlineSwitch, Toggletip, Button, Tooltip, Icon } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { SelectedProps, CogniteTimeSeries } from '../types';
import { searchDMSInstances, fetchCogniteUnits, getTimeSeriesProperties, getStateSetStates, stringifyError, fetchCogniteTimeSeriesViews, fetchCogniteActivityViews, StateSetEntry } from '../cdf/client';
import { DMSInstance, DMSSearchRequest, CogniteUnit, InvolvedView } from '../types/dms';
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
          label="Latest value"
          id={`latest-value-${query.refId}`}
          value={query.latestValue}
          onChange={({ currentTarget }) => onQueryChange({ latestValue: currentTarget.checked })}
        />
      </InlineField>
    </InlineFieldRow>
  );
};

const NUMERIC_AGGREGATIONS = new Set([
  'none', 'average', 'max', 'min', 'count', 'sum', 'interpolation',
  'stepInterpolation', 'continuousVariance', 'discreteVariance', 'totalVariation',
]);
const STATE_AGGREGATIONS = new Set([
  'none',
  'dominantState',
  'count',
  'stateDuration',
  'stateCount',
  'stateTransitions',
]);

// Returns a partial query update that snaps `aggregation` back to a valid value
// for the newly selected TS type. Returns {} if the current aggregation is still valid.
function normalizeAggregationForType(
  type: CogniteTimeSeries['type'] | undefined,
  current: string | undefined
): { aggregation?: string } {
  if (type === 'string') {
    return current === 'none' ? {} : { aggregation: 'none' };
  }
  if (type === 'state') {
    return current && STATE_AGGREGATIONS.has(current) ? {} : { aggregation: 'dominantState' };
  }
  // numeric (or unknown — fall back to numeric defaults)
  return current && NUMERIC_AGGREGATIONS.has(current) ? {} : { aggregation: 'average' };
}

export const CogniteTimeSeriesSearchTab: React.FC<CogniteTimeSeriesSearchTabProps> = ({
  query,
  onQueryChange,
  connector,
}) => {
  const [viewOptions, setViewOptions] = useState<Array<SelectableValue<InvolvedView>>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [units, setUnits] = useState<CogniteUnit[]>([]);
  const [timeSeriesUnit, setTimeSeriesUnit] = useState<string | undefined>(undefined);
  const [timeSeriesType, setTimeSeriesType] = useState<string | undefined>(undefined);
  const [stateSetStates, setStateSetStates] = useState<StateSetEntry[]>([]);
  const [loadingStateSet, setLoadingStateSet] = useState(false);
  const [loadingUnits, setLoadingUnits] = useState(false);
  
  // Activity overlay state
  const [activityViewOptions, setActivityViewOptions] = useState<Array<SelectableValue<InvolvedView>>>([]);
  const [loadingActivityViews, setLoadingActivityViews] = useState(false);

  const { cogniteTimeSeries, cogniteActivityQuery } = query;
  const activityEnabled = cogniteActivityQuery?.enabled || false;

  // Create a stable key for instanceId to trigger useEffect
  const instanceIdKey = useMemo(
    () => cogniteTimeSeries.instanceId
      ? `${cogniteTimeSeries.instanceId.space}:${cogniteTimeSeries.instanceId.externalId}`
      : undefined,
    [cogniteTimeSeries.instanceId]
  );

  const loadViews = useCallback(async () => {
    try {
      setLoading(true);
      const views = await fetchCogniteTimeSeriesViews(connector);
      const options = views.map((view: InvolvedView) => ({
        label: `${view.externalId} (${view.space}) ${view.version}`,
        value: view,
        description: `Space: ${view.space}, Version: ${view.version}`,
      }));
      setViewOptions(options);
      setError(null);
    } catch (err) {
      setError(`Failed to load CogniteTimeSeries views: ${stringifyError(err)}`);
    } finally {
      setLoading(false);
    }
  }, [connector]);

  const searchTimeseries = useCallback(async (searchQuery: string) => {
    if (!cogniteTimeSeries.space || !cogniteTimeSeries.externalId) {
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
        query: searchQuery.trim(),
        limit: 1000,
      };

      const instances = await searchDMSInstances(connector, searchRequest);
      const tsOptions = instances.map((instance: DMSInstance) => {
        const props = instance.properties?.[cogniteTimeSeries.space]?.[`${cogniteTimeSeries.externalId}/${cogniteTimeSeries.version}`];
        const name = props?.name || instance.externalId;
        const type = props?.type;
        return {
          label: name,
          value: `${instance.space}:${instance.externalId}`,
          description: `Space: ${instance.space}, External ID: ${instance.externalId}`,
          space: instance.space,
          externalId: instance.externalId,
          name,
          type,
        };
      });
      return tsOptions;
    } catch (err) {
      setError(`Search failed: ${stringifyError(err)}`);
      return [];
    }
  }, [connector, cogniteTimeSeries.space, cogniteTimeSeries.externalId, cogniteTimeSeries.version]);

  useEffect(() => {
    loadViews();
  }, [loadViews]);

  // Load activity views
  const loadActivityViews = useCallback(async () => {
    try {
      setLoadingActivityViews(true);
      const views = await fetchCogniteActivityViews(connector);
      const options = views.map((view: InvolvedView) => ({
        label: `${view.externalId} (${view.space}) ${view.version}`,
        value: view,
        description: `Space: ${view.space}, Version: ${view.version}`,
      }));
      setActivityViewOptions(options);
    } catch (err) {
      console.warn('Failed to load CogniteActivity views:', stringifyError(err));
    } finally {
      setLoadingActivityViews(false);
    }
  }, [connector]);

  useEffect(() => {
    if (cogniteTimeSeries.instanceId && activityEnabled) {
      loadActivityViews();
    }
  }, [loadActivityViews, cogniteTimeSeries.instanceId, activityEnabled]);

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

  // Fetch the unit and type of the selected timeseries in a single byids call
  useEffect(() => {
    const fetchProperties = async () => {
      const instanceId = cogniteTimeSeries.instanceId;
      if (instanceId?.space && instanceId?.externalId) {
        setLoadingUnits(true);
        try {
          const { unit, type, stateSet } = await getTimeSeriesProperties(connector, instanceId);
          setTimeSeriesUnit(unit);
          setTimeSeriesType(type);
          if (type && cogniteTimeSeries.type !== type) {
            const persistedType = type as CogniteTimeSeries['type'];
            onQueryChange({
              cogniteTimeSeries: {
                ...cogniteTimeSeries,
                type: persistedType,
              },
              ...normalizeAggregationForType(persistedType, query.aggregation),
            });
          }
          if (type === 'state' && stateSet && connector.isStateTimeSeriesEnabled()) {
            setLoadingStateSet(true);
            try {
              const states = await getStateSetStates(connector, stateSet);
              setStateSetStates(states);
            } finally {
              setLoadingStateSet(false);
            }
          } else {
            setStateSetStates([]);
          }
        } catch (err) {
          console.warn('Failed to fetch timeseries properties:', stringifyError(err));
          setTimeSeriesUnit(undefined);
          setTimeSeriesType(undefined);
          setStateSetStates([]);
        } finally {
          setLoadingUnits(false);
        }
      } else {
        setTimeSeriesUnit(undefined);
        setTimeSeriesType(undefined);
        setStateSetStates([]);
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

  const handleViewChange = (selectedOption: SelectableValue<InvolvedView> | null) => {
    const view = selectedOption?.value;
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

  const handleTimeseriesSelection = (selectedTimeseries: SelectableValue | null) => {
    setTimeSeriesType(selectedTimeseries?.type);
    const selectedType = selectedTimeseries?.type as CogniteTimeSeries['type'] | undefined;
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
        type: selectedType,
        // Clear targetUnit when selecting a state TS (units don't apply)
        ...(selectedType === 'state' ? { targetUnit: undefined } : {}),
      },
      ...normalizeAggregationForType(selectedType, query.aggregation),
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
  const stateTimeSeriesFeatureEnabled = connector.isStateTimeSeriesEnabled();
  const isStateType = timeSeriesType === 'state';
  const stateTsUiActive = isStateType && stateTimeSeriesFeatureEnabled;

  // Activity overlay handlers
  const handleActivityOverlayToggle = (checked: boolean) => {
    onQueryChange({
      cogniteActivityQuery: {
        ...cogniteActivityQuery,
        enabled: checked,
      },
    });
  };

  const handleActivityViewChange = (selectedOption: SelectableValue<InvolvedView> | null) => {
    const view = selectedOption?.value;
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

  // Find the currently selected view option
  const selectedViewOption = useMemo(() => {
    if (cogniteTimeSeries.space && cogniteTimeSeries.externalId && cogniteTimeSeries.version) {
      return viewOptions.find(
        (opt) =>
          opt.value?.space === cogniteTimeSeries.space &&
          opt.value?.externalId === cogniteTimeSeries.externalId &&
          opt.value?.version === cogniteTimeSeries.version
      );
    }
    return null;
  }, [viewOptions, cogniteTimeSeries.space, cogniteTimeSeries.externalId, cogniteTimeSeries.version]);

  // Find the currently selected activity view option
  const selectedActivityViewOption = useMemo(() => {
    if (cogniteActivityQuery?.space && cogniteActivityQuery?.externalId && cogniteActivityQuery?.version) {
      return activityViewOptions.find(
        (opt) =>
          opt.value?.space === cogniteActivityQuery.space &&
          opt.value?.externalId === cogniteActivityQuery.externalId &&
          opt.value?.version === cogniteActivityQuery.version
      );
    }
    return null;
  }, [activityViewOptions, cogniteActivityQuery?.space, cogniteActivityQuery?.externalId, cogniteActivityQuery?.version]);

  return (
    <div>
      <div>
        <InlineFieldRow>
          <InlineField
            label="View"
            labelWidth={14}
            tooltip="Select a CogniteTimeSeries view to search in"
          >
            <Select
              options={viewOptions}
              value={selectedViewOption}
              onChange={handleViewChange}
              placeholder="Select a CogniteTimeSeries view"
              isClearable
              isLoading={loading}
              width={40}
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
              key={`${cogniteTimeSeries.space}-${cogniteTimeSeries.externalId}-${cogniteTimeSeries.version}`}
              loadOptions={searchTimeseries}
              defaultOptions
              value={getCurrentTimeseriesValue()}
              onChange={handleTimeseriesSelection}
              placeholder="Search timeseries by name/description"
              isClearable
              width={40}
              noOptionsMessage="No timeseries found"
              inputId={`cognite-timeseries-search-${query.refId}`}
              formatOptionLabel={(option: SelectableValue & { type?: string }) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{option.label}</span>
                  {option.type && (
                    <Badge text={option.type} color={getTypeBadgeColor(option.type)} />
                  )}
                </div>
              )}
            />
          </InlineField>
          {cogniteTimeSeries.instanceId && timeSeriesType && (!isStateType || stateTsUiActive) && (
            <InlineField transparent style={{ alignItems: 'center' }}>
              <Badge text={timeSeriesType} color={getTypeBadgeColor(timeSeriesType)} />
            </InlineField>
          )}
        </InlineFieldRow>

        {cogniteTimeSeries.instanceId && isStateType && !stateTimeSeriesFeatureEnabled && (
          <Alert title="Unsupported time series type" severity="info">
            State time series are not enabled for this data source. Ask an administrator to enable &quot;State time series (beta)&quot; in the data source Features tab.
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

        {/* Activity overlay — not offered for state TS unless the beta feature is enabled */}
        {cogniteTimeSeries.instanceId && (!isStateType || stateTsUiActive) && (
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
                    <Select
                      options={activityViewOptions}
                      value={selectedActivityViewOption}
                      onChange={handleActivityViewChange}
                      placeholder="Select a CogniteActivity view"
                      isClearable
                      isLoading={loadingActivityViews}
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
                labelContext="cdmNumeric"
              />
            )}
          </>
        )}

        {stateTsUiActive && (
          <>
            <InlineFieldRow>
              <InlineField
                label="Latest value"
                labelWidth={14}
                tooltip="Fetch the latest data point in the provided time range"
              >
                <InlineSwitch
                  label="Latest value"
                  id={`latest-value-${query.refId}`}
                  value={query.latestValue}
                  onChange={({ currentTarget }) => onQueryChange({ latestValue: currentTarget.checked })}
                />
              </InlineField>
              {(query.latestValue || query.aggregation === 'dominantState' || query.aggregation === 'none') && (
                <InlineField
                  label="Numeric value"
                  labelWidth={16}
                  tooltip="Display the numeric state code instead of the textual state label"
                >
                  <InlineSwitch
                    label="Numeric value"
                    id={`state-display-numeric-${query.refId}`}
                    value={!!cogniteTimeSeries.displayAsNumeric}
                    onChange={({ currentTarget }) =>
                      onQueryChange({
                        cogniteTimeSeries: {
                          ...cogniteTimeSeries,
                          displayAsNumeric: currentTarget.checked,
                        },
                      })
                    }
                  />
                </InlineField>
              )}
              {stateSetStates.length > 0 && (
                <InlineField transparent>
                  <Toggletip
                    closeButton={false}
                    content={
                      <div style={{ maxHeight: '240px', overflowY: 'auto', display: 'inline-block', margin: '-8px 0' }}>
                        <table style={{ borderCollapse: 'collapse', fontSize: '12px' }}>
                          <tbody>
                            {stateSetStates.map((s) => (
                              <tr key={s.numericValue}>
                                <td style={{
                                  padding: '4px 16px 4px 0',
                                  textAlign: 'left',
                                  fontVariantNumeric: 'tabular-nums',
                                  color: 'rgba(204, 204, 220, 0.65)',
                                }}>
                                  {s.numericValue}
                                </td>
                                <td style={{ padding: '4px 0', textAlign: 'left' }}>{s.stringValue}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    }
                    placement="right"
                  >
                    <Button
                      variant="secondary"
                      size="md"
                      disabled={loadingStateSet}
                      style={{ fontSize: '12px' }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        View state set
                        <Tooltip content="Show the integer-to-label mapping for each entry in this state set.">
                          <Icon name="info-circle" size="sm" />
                        </Tooltip>
                      </span>
                    </Button>
                  </Toggletip>
                </InlineField>
              )}
            </InlineFieldRow>
            {!query.latestValue && (
              <CommonEditors
                {...{ query, onQueryChange }}
                hideAggregation={false}
                isStateType
                labelContext="cdmState"
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
      {query.latestValue && (!isStateType || stateTsUiActive) && (
        <LabelEditor
          {...{ onQueryChange, query }}
          labelContext={
            isStateType && stateTsUiActive ? 'cdmState' : 'cdmNumeric'
          }
        />
      )}
    </div>
  );
};
