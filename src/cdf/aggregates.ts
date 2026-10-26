import { SelectableValue } from '@grafana/data';

/** A CogniteTimeSeries `type`. It decides which aggregates CDF accepts and what they return. */
export type TimeSeriesKind = 'numeric' | 'string' | 'state';

export const isTimeSeriesKind = (value: unknown): value is TimeSeriesKind =>
  value === 'numeric' || value === 'string' || value === 'state';

type AggregateOption = SelectableValue<string> & { value: string; label: string };

const NONE: AggregateOption = { value: 'none', label: 'None', description: 'Raw data points, not aggregated' };

const COUNT: AggregateOption = { value: 'count', label: 'Count', description: 'Data points in each interval' };
const INTERPOLATION: AggregateOption[] = [
  {
    value: 'interpolation',
    label: 'Interpolation',
    description: 'The value at the start of each interval, linear or stepwise as the series is',
  },
  {
    value: 'stepInterpolation',
    label: 'Step Interpolation',
    description: 'The value at the start of each interval, as if the series were stepwise',
  },
];

/** Counts and durations per status code: any type of series. */
const STATUS: AggregateOption[] = [
  { value: 'countGood', label: 'Count (good)', description: 'Data points with a good status' },
  { value: 'countUncertain', label: 'Count (uncertain)', description: 'Data points with an uncertain status' },
  { value: 'countBad', label: 'Count (bad)', description: 'Data points with a bad status' },
  { value: 'durationGood', label: 'Duration (good)', description: 'Time with a good status, in milliseconds' },
  { value: 'durationUncertain', label: 'Duration (uncertain)', description: 'Time with an uncertain status, in milliseconds' },
  { value: 'durationBad', label: 'Duration (bad)', description: 'Time with a bad status, in milliseconds' },
];

/**
 * The aggregates the editor always offered for numeric series, as the legacy (id and
 * externalId) tabs still do.
 */
export const NUMERIC_AGGREGATES: AggregateOption[] = [
  NONE,
  { value: 'average', label: 'Average', description: 'Time-weighted average of each interval' },
  { value: 'max', label: 'Max', description: 'Highest data point in each interval' },
  { value: 'min', label: 'Min', description: 'Lowest data point in each interval' },
  COUNT,
  { value: 'sum', label: 'Sum', description: 'Sum of the data points in each interval' },
  ...INTERPOLATION,
  {
    value: 'continuousVariance',
    label: 'Continuous Variance',
    description: 'Variance of the series, interpolated between data points',
  },
  { value: 'discreteVariance', label: 'Discrete Variance', description: 'Variance of the data points themselves' },
  {
    value: 'totalVariation',
    label: 'Total Variation',
    description: 'Sum of the changes between data points (deprecated)',
  },
];

/** The aggregates CDF accepts for each type of series, in the order the editor lists them. */
const AGGREGATES_BY_KIND: Record<TimeSeriesKind, AggregateOption[]> = {
  // The list the editor always offered, with the status aggregates after it.
  numeric: [...NUMERIC_AGGREGATES, ...STATUS],
  // Aggregates on string and state series are still in preview in CDF: raw values only.
  string: [NONE],
  state: [NONE],
};

/** Aggregates every type of series has; the rest belong to one type. */
const COMMON_AGGREGATES = new Set([COUNT, ...INTERPOLATION, ...STATUS].map(({ value }) => value));

const KIND_GROUP_LABELS: Record<TimeSeriesKind, string> = { numeric: 'Numeric', string: 'String', state: 'State' };

/**
 * The editor's options for a series of this type, grouped: None, then the aggregates
 * only this type has, then those every type has. Numeric when the type is not known.
 * Without None for an editor that offers raw data points as a mode of its own.
 */
export function aggregateGroupsFor(
  kind: TimeSeriesKind = 'numeric',
  { withNone = true }: { withNone?: boolean } = {}
): Array<SelectableValue<string>> {
  const options = AGGREGATES_BY_KIND[kind];
  const own = options.filter(({ value }) => value !== 'none' && !COMMON_AGGREGATES.has(value));
  const common = options.filter(({ value }) => COMMON_AGGREGATES.has(value));
  return [
    ...(withNone ? options.filter(({ value }) => value === 'none') : []),
    ...(own.length ? [{ label: KIND_GROUP_LABELS[kind], options: own }] : []),
    ...(common.length ? [{ label: 'Common', options: common }] : []),
  ];
}

/** How a CDM tab reads data points: aggregated per interval, as stored, or the latest only. */
export type DatapointsMode = 'aggregate' | 'raw' | 'latest';

type DatapointsQuery = { aggregation?: string; latestValue?: boolean };

export const datapointsModeOf = ({ aggregation, latestValue }: DatapointsQuery): DatapointsMode =>
  latestValue ? 'latest' : !aggregation || aggregation === 'none' ? 'raw' : 'aggregate';

/** Whether a series of this type can be aggregated at all. */
export const canAggregate = (kind: TimeSeriesKind = 'numeric'): boolean =>
  AGGREGATES_BY_KIND[kind].some(({ value }) => value !== 'none');

/** The first aggregate the type's list offers: what Aggregate mode starts on. */
export const firstAggregateFor = (kind: TimeSeriesKind = 'numeric'): string =>
  AGGREGATES_BY_KIND[kind].find(({ value }) => value !== 'none')?.value ?? 'none';

/**
 * The query fields a mode sets. Aggregate keeps an aggregation the type accepts, else
 * the one the query had before Raw (`previous`), else the type's first; the saved
 * aggregation is left alone by Latest, so switching back finds it again.
 */
export function datapointsModePatch(
  mode: DatapointsMode,
  { aggregation, latestValue }: DatapointsQuery,
  kind?: TimeSeriesKind,
  previous?: string
): DatapointsQuery {
  if (mode === 'latest') {
    return { latestValue: true };
  }
  const off = latestValue ? { latestValue: false } : {};
  if (mode === 'raw') {
    return { ...off, aggregation: 'none' };
  }
  const usable = (candidate?: string): candidate is string =>
    !!candidate && candidate !== 'none' && isAggregateAllowed(kind ?? 'numeric', candidate);
  return {
    ...off,
    aggregation: usable(aggregation) ? aggregation : usable(previous) ? previous : firstAggregateFor(kind),
  };
}

/** The editor's options for a series of this type; numeric when the type is not known yet. */
export const aggregateOptionsFor = (kind?: TimeSeriesKind): AggregateOption[] =>
  AGGREGATES_BY_KIND[kind ?? 'numeric'];

export const isAggregateAllowed = (kind: TimeSeriesKind, aggregation?: string): boolean =>
  !aggregation || AGGREGATES_BY_KIND[kind].some((option) => option.value === aggregation);

/** What a query switches to when its series' type does not accept its aggregation. */
export const defaultAggregationFor = (kind: TimeSeriesKind): string =>
  kind === 'numeric' ? 'average' : 'none';

const DURATION_AGGREGATES = new Set(['durationGood', 'durationUncertain', 'durationBad']);

/** Aggregates whose values are milliseconds. */
export const isDurationAggregate = (aggregation?: string) =>
  !!aggregation && DURATION_AGGREGATES.has(aggregation);

/** Aggregates that return a series' own values rather than a number computed from them. */
export const returnsSeriesValues = (aggregation?: string) =>
  !aggregation || aggregation === 'none' || aggregation === 'interpolation' || aggregation === 'stepInterpolation';

export function unavailableAggregateMessage(kind: TimeSeriesKind, aggregation: string): string {
  const label =
    Object.values(AGGREGATES_BY_KIND)
      .flat()
      .find((option) => option.value === aggregation)?.label ?? aggregation;
  const choices = AGGREGATES_BY_KIND[kind]
    .filter((option) => option.value !== 'none')
    .map((option) => option.label)
    .join(', ');
  return choices
    ? `${label} is not available for ${kind} time series. Choose None (raw data points) or one of: ${choices}.`
    : `${label} is not available for ${kind} time series. Choose None (raw data points).`;
}
