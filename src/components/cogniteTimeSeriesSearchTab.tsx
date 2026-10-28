import React, { useState, useEffect, useMemo } from 'react';
import { EditorField, EditorFieldGroup, EditorRow, EditorRows } from '@grafana/plugin-ui';
import { Select, Alert, Badge, BadgeColor, InlineSwitch, RadioButtonGroup, Stack } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { CogniteActivityQuery, defaultCogniteActivityQuery, SelectedProps } from '../types';
import { getCogniteUnitIndex, getTimeSeriesProperties, stringifyError } from '../cdf/client';
import { storageUnitLabel, targetUnitApplies, unitDisplayName } from '../cdf/units';
import { encodeInstanceRef, InstancePicker, PickedInstance } from './common/InstancePicker';
import { ViewPicker } from './common/ViewPicker';
import { CogniteUnit, InvolvedView } from '../types/dms';
import { LABEL_TOOLTIP } from './commonEditors';
import { Connector } from '../connector';
import { defaultAggregationFor, isAggregateAllowed, isTimeSeriesKind } from '../cdf/aggregates';
import { DatapointsFields } from './common/DatapointsFields';
import { LabelField } from './common/LabelField';

interface CogniteTimeSeriesSearchTabProps extends SelectedProps {
  connector: Connector;
  /** The panel's interval, for showing what an auto granularity resolves to. */
  intervalMs?: number;
}

const TYPE_BADGE_COLORS: Record<string, BadgeColor> = {
  numeric: 'blue',
  string: 'orange',
  state: 'purple',
};

export const getTypeBadgeColor = (type: string): BadgeColor =>
  TYPE_BADGE_COLORS[type] ?? 'darkgrey';

type ActivityTimes = 'actual' | 'scheduled';

const ACTIVITY_TIMES_OPTIONS: Array<{ label: string; value: ActivityTimes; description: string }> = [
  { label: 'Actual', value: 'actual', description: 'startTime and endTime' },
  { label: 'Scheduled', value: 'scheduled', description: 'scheduledStartTime and scheduledEndTime' },
];

interface ActivitiesRowProps {
  refId: string;
  connector: Connector;
  activityQuery?: CogniteActivityQuery;
  onChange: (activityQuery: CogniteActivityQuery) => void;
}

/**
 * The activity overlay: a switch that gates the view the activities come from and
 * which of their times are drawn.
 */
const ActivitiesRow = ({ refId, connector, activityQuery, onChange }: ActivitiesRowProps) => {
  const enabled = activityQuery?.enabled || false;
  // A query saved before the overlay existed has no activity query yet.
  const patch = (fields: Partial<CogniteActivityQuery>) =>
    onChange({ ...defaultCogniteActivityQuery, ...activityQuery, ...fields });
  return (
    <EditorRow>
      <EditorFieldGroup>
        <EditorField
          label="Activities"
          tooltip="Overlay activities from a CogniteActivity view on the time series chart."
          htmlFor={`overlay-activities-${refId}`}
        >
          <InlineSwitch
            id={`overlay-activities-${refId}`}
            label="Activities"
            value={enabled}
            onChange={({ currentTarget }) => patch({ enabled: currentTarget.checked })}
          />
        </EditorField>
        {enabled && (
          <>
            <EditorField
              label="Activity view"
              tooltip="The CogniteActivity view the activities are read from."
              htmlFor={`activity-view-${refId}`}
            >
              <ViewPicker
                inputId={`activity-view-${refId}`}
                connector={connector}
                container="CogniteActivity"
                value={activityQuery}
                onChange={(view: InvolvedView | null) =>
                  patch({
                    space: view?.space || 'cdf_cdm',
                    externalId: view?.externalId || 'CogniteActivity',
                    version: view?.version || 'v1',
                  })
                }
                placeholder="Select a CogniteActivity view"
                isClearable
                width={40}
              />
            </EditorField>
            <EditorField
              label="Times"
              tooltip="Which times of each activity are drawn: the actual start and end, or the scheduled ones."
            >
              <RadioButtonGroup
                options={ACTIVITY_TIMES_OPTIONS}
                value={activityQuery?.useScheduledTime ? 'scheduled' : 'actual'}
                onChange={(next) => patch({ useScheduledTime: next === 'scheduled' })}
                aria-label="Activity times"
              />
            </EditorField>
          </>
        )}
      </EditorFieldGroup>
    </EditorRow>
  );
};

export const CogniteTimeSeriesSearchTab: React.FC<CogniteTimeSeriesSearchTabProps> = ({
  query,
  onQueryChange,
  connector,
  intervalMs,
}) => {
  const [error, setError] = useState<string | null>(null);
  const [units, setUnits] = useState<CogniteUnit[]>([]);
  const [timeSeriesUnit, setTimeSeriesUnit] = useState<string | undefined>(undefined);
  const [timeSeriesType, setTimeSeriesType] = useState<string | undefined>(undefined);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [loadingType, setLoadingType] = useState(false);

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
        setLoadingType(true);
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
          setLoadingType(false);
        }
      } else {
        setTimeSeriesUnit(undefined);
        setTimeSeriesType(undefined);
      }
    };
    fetchProperties();
  }, [connector, instanceIdKey, cogniteTimeSeries.instanceId]);

  const kind = isTimeSeriesKind(timeSeriesType) ? timeSeriesType : undefined;

  // An aggregation the series' type refuses (Average on a string series, say) would
  // fail the query, so it gives way to that type's default. Latest reads no aggregation,
  // so the saved one is left alone there for coming back to Aggregate.
  useEffect(() => {
    if (kind && !query.latestValue && kind !== 'state' && !isAggregateAllowed(kind, query.aggregation)) {
      onQueryChange({ aggregation: defaultAggregationFor(kind) });
    }
  }, [kind, query.aggregation, query.latestValue, onQueryChange]);

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
    // A conversion chosen for the previous series only carries over to one that
    // measures the same quantity; otherwise CDF would refuse the request.
    const storageUnit = selected?.props?.unit?.externalId;
    const keepTargetUnit = targetUnitApplies(cogniteTimeSeries.targetUnit, storageUnit, unitLookup);
    onQueryChange({
      cogniteTimeSeries: {
        ...cogniteTimeSeries,
        targetUnit: keepTargetUnit ? cogniteTimeSeries.targetUnit : undefined,
        instanceId: selected?.space && selected?.externalId ? {
          // PR Feedback: We need space field here because top-level space (e.g., "cdf_cdm")
          // is used for searching/listing in DMS view, while instanceId.space
          // (e.g., "cdm_try") is where the actual selected instance lives for data queries
          space: selected.space,
          externalId: selected.externalId,
        } : undefined,
      },
      // A string series starts on its raw values, like it always did.
      ...(!query.latestValue && isTimeSeriesKind(type) && type !== 'state' && !isAggregateAllowed(type, query.aggregation)
        ? { aggregation: defaultAggregationFor(type) }
        : {}),
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

  // Shared with the Records tab so a unit reads the same way in both query editors
  const unitLookup = useMemo(
    () => new Map(units.map((unit) => [unit.externalId, unit])),
    [units]
  );
  const getUnitDisplayName = (unitExternalId?: string): string =>
    unitDisplayName(unitExternalId, unitLookup);

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

    return filteredUnits.map((unit) => ({
      label: getUnitDisplayName(unit.externalId),
      value: unit.externalId,
      description: unit.description,
    }));
  };

  const picked = !!cogniteTimeSeries.instanceId;
  // A target unit converts numeric values only; the request never carries one for
  // string or state series.
  const isUnitConversionEnabled = picked && !!timeSeriesUnit && kind === 'numeric';

  return (
    <div>
      <EditorRows>
        <EditorRow>
          <EditorFieldGroup>
            <EditorField label="View" tooltip="The CogniteTimeSeries view to search in." htmlFor={`view-${query.refId}`}>
              <ViewPicker
                inputId={`view-${query.refId}`}
                connector={connector}
                container="CogniteTimeSeries"
                value={cogniteTimeSeries}
                onChange={handleViewChange}
                placeholder="Select a CogniteTimeSeries view"
                isClearable
                width={44}
                onError={setError}
              />
            </EditorField>
            <EditorField
              label="Time series"
              tooltip="Search by name or description. The type of the picked time series decides which aggregations are offered."
              htmlFor={`cognite-timeseries-search-${query.refId}`}
            >
              <Stack gap={1} alignItems="center">
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
                  width={44}
                  noOptionsMessage="No timeseries found"
                  inputId={`cognite-timeseries-search-${query.refId}`}
                  badgeOf={(props) =>
                    props.type
                      ? { text: props.type, color: getTypeBadgeColor(props.type) }
                      : undefined
                  }
                  onError={setError}
                />
                {picked && kind && (
                  <Badge
                    text={kind}
                    color={getTypeBadgeColor(kind)}
                    tooltip="The type of the selected time series. It decides which aggregations are offered."
                    data-testid={`cognite-timeseries-type-${query.refId}`}
                  />
                )}
              </Stack>
            </EditorField>
          </EditorFieldGroup>
        </EditorRow>

        {picked && kind === 'state' ? (
          <Alert title="Unsupported time series type" severity="info">
            State time series are not currently supported in Grafana.
          </Alert>
        ) : (
          <EditorRow>
            {/* Until the type is known, a mode switch could pick an aggregate the type refuses. */}
            <DatapointsFields {...{ query, kind, intervalMs, onQueryChange }} disabled={loadingType} />
          </EditorRow>
        )}

        {/* An overlay needs a series to draw on. */}
        {picked && kind !== 'state' && (
          <ActivitiesRow
            refId={query.refId}
            connector={connector}
            activityQuery={cogniteActivityQuery}
            onChange={(next) => onQueryChange({ cogniteActivityQuery: next })}
          />
        )}

        <EditorRow>
          <EditorFieldGroup>
            {isUnitConversionEnabled && (
              <EditorField
                label="Target unit"
                optional
                tooltip={`Convert the values to this unit. Storage unit: ${getUnitDisplayName(timeSeriesUnit)}.`}
              >
                <Stack gap={1} alignItems="center">
                  <Select
                    inputId={`target-unit-${query.refId}`}
                    options={getFilteredUnits()}
                    value={cogniteTimeSeries.targetUnit || timeSeriesUnit}
                    onChange={handleTargetUnitChange}
                    placeholder="Select target unit"
                    isClearable
                    isLoading={loadingUnits}
                    width={40}
                  />
                  <Badge text={storageUnitLabel(timeSeriesUnit, unitLookup)} color="darkgrey" />
                </Stack>
              </EditorField>
            )}
            {/* Last: it names whatever the rows above produce. */}
            <LabelField
              id={`label-${query.refId}`}
              value={query.label}
              placeholder="default"
              tooltip={LABEL_TOOLTIP}
              onCommit={(label) => onQueryChange({ label })}
            />
          </EditorFieldGroup>
        </EditorRow>
      </EditorRows>

      {error && (
        <Alert title="Information" severity="info">
          {error}
        </Alert>
      )}
    </div>
  );
};
