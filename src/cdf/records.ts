import { DataFrame, FieldType, MutableDataFrame } from '@grafana/data';
import { Connector } from '../connector';
import { CacheTime, RECORDS_PAGE_LIMIT } from '../constants';
import {
  DAY,
  HOUR,
  MINUTE,
  SECOND,
  parseDurationMs,
} from './timeExpression';
import {
  HttpMethod,
  RecordsBucket,
  RecordsFilterOperator,
  RecordsFilterRow,
  RecordsMetric,
  RecordsQuery,
  RecordsSortRow,
  Tuple,
} from '../types';
import { INSTANCE_REF_HINT, parseInstanceRef } from './instanceRef';
import {
  RecordsAggregateDefinition,
  RecordsAggregateRequest,
  RecordsAggregateResponse,
  RecordsAggregateResultNode,
  RecordsAggregateTree,
  RecordsFilterDefinition,
  RecordsFilterRequest,
  RecordsItem,
  RecordsPropertyRef,
  RecordsSortSpec,
  RecordsTyping,
  RecordViewDefinition,
  RecordViewProperty,
  StreamDefinition,
} from '../types/records';

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

export function fetchRecordViews(
  connector: Connector,
  limit = 1000
): Promise<RecordViewDefinition[]> {
  return connector.fetchItems<RecordViewDefinition>({
    method: HttpMethod.GET,
    path: '/models/views',
    data: undefined,
    params: {
      usedFor: 'record',
      includeGlobal: true,
      allVersions: false,
      limit,
    },
    cacheTime: CacheTime.ResourceByIds,
  });
}

export async function fetchStream(
  connector: Connector,
  streamId: string
): Promise<StreamDefinition> {
  const { data } = await connector.fetchData<{ data: StreamDefinition }>({
    method: HttpMethod.GET,
    path: `/streams/${encodeURIComponent(streamId)}`,
    data: undefined,
    cacheTime: CacheTime.ResourceByIds,
  });
  return data;
}

// ---------------------------------------------------------------------------
// View schema helpers
// ---------------------------------------------------------------------------

export const viewSourceKey = (view: { externalId: string; version: string }) =>
  `${view.externalId}/${view.version}`;

/**
 * Property reference as the records API expects it. Top-level properties use a
 * single segment; everything else is resolved through the selected view.
 */
export function viewPropertyRef(
  view: { space: string; externalId: string; version: string },
  property: string
): RecordsPropertyRef {
  return isTopLevelProperty(property)
    ? [property]
    : [view.space, viewSourceKey(view), property];
}

/**
 * Every record carries these regardless of the view. They are reserved identifiers
 * in data modeling, so a view property can never shadow one, and they are referenced
 * with a single-segment path instead of a view path.
 *
 * The API accepts them in different places depending on the property, so each entry
 * states exactly where it is allowed rather than assuming they behave like view
 * properties (notably: exists/containsAll/containsAny are container-only).
 */
export interface TopLevelProperty {
  name: string;
  type: string;
  operators: RecordsFilterOperator[];
  /** Valid as a timeHistogram axis. */
  timeBucket?: boolean;
  /** Valid as a uniqueValues bucket. */
  valuesBucket?: boolean;
  /** Valid as a min/max metric property. */
  minMax?: boolean;
}

export const TOP_LEVEL_PROPERTIES: TopLevelProperty[] = [
  { name: 'space', type: 'text', operators: ['equals', 'in', 'prefix'], valuesBucket: true },
  { name: 'externalId', type: 'text', operators: ['equals', 'in', 'prefix'] },
  {
    name: 'createdTime',
    type: 'timestamp',
    operators: ['range', 'equals', 'in'],
    timeBucket: true,
    minMax: true,
  },
  {
    name: 'lastUpdatedTime',
    type: 'timestamp',
    operators: ['range', 'equals', 'in'],
    timeBucket: true,
    minMax: true,
  },
];

const TOP_LEVEL_BY_NAME = new Map(TOP_LEVEL_PROPERTIES.map((p) => [p.name, p]));

export const topLevelProperty = (name?: string): TopLevelProperty | undefined =>
  name ? TOP_LEVEL_BY_NAME.get(name) : undefined;

export const isTopLevelProperty = (name?: string) => !!topLevelProperty(name);

const NUMERIC_TYPES = ['float32', 'float64', 'int32', 'int64'];
const TIME_TYPES = ['timestamp', 'date'];

export const isNumericType = (type?: string) =>
  !!type && NUMERIC_TYPES.includes(type);
export const isTimeType = (type?: string) => !!type && TIME_TYPES.includes(type);

/**
 * Operators that make sense for a property, so the operator dropdown never offers
 * a combination the API would reject.
 */
export function operatorsForType(
  type?: string,
  isList?: boolean,
  property?: string
): RecordsFilterOperator[] {
  const topLevel = topLevelProperty(property);
  if (topLevel) {
    return topLevel.operators;
  }
  if (isList) {
    return ['containsAny', 'containsAll', 'exists'];
  }
  if (!type) {
    return ['equals', 'in', 'range', 'prefix', 'exists'];
  }
  if (type === 'enum') {
    return ['in', 'equals', 'exists'];
  }
  if (type === 'boolean') {
    return ['equals', 'exists'];
  }
  if (type === 'direct') {
    return ['equals', 'in', 'exists'];
  }
  if (isNumericType(type) || isTimeType(type)) {
    return ['range', 'equals', 'in', 'exists'];
  }
  // text and anything else
  return ['equals', 'in', 'prefix', 'exists'];
}

/**
 * Coerces a UI string into the JSON type the API expects for that property.
 *
 * Throws for a direct relation the reference parser rejects: the API answers a
 * malformed reference with 200 and zero rows, so failing loudly here is the only way
 * the user learns why the panel is empty.
 */
function coerceValue(raw: string, type?: string, property?: string): unknown {
  const value = raw.trim();
  if (isNumericType(type)) {
    const n = Number(value);
    return Number.isFinite(n) ? n : value;
  }
  if (type === 'boolean') {
    return value.toLowerCase() === 'true';
  }
  if (type === 'timestamp' && /^-?\d+$/.test(value)) {
    // `$__from`/`$__to` interpolate to epoch-ms digits. View timestamps accept only
    // ISO-8601 (the API answers digits, as string or number, with a 400); top-level
    // record timestamps accept epoch ms. Anything else, ISO included, is accepted
    // by both as typed, so it passes through untouched.
    return isTopLevelProperty(property) ? Number(value) : new Date(Number(value)).toISOString();
  }
  if (type === 'direct') {
    const ref = parseInstanceRef(value);
    if (!ref) {
      throw new Error(
        `Filter on "${property ?? 'direct relation'}" needs an instance reference like ` +
          `${INSTANCE_REF_HINT}, but got: ${value}`
      );
    }
    return ref;
  }
  return value;
}

// ---------------------------------------------------------------------------
// Request builders (pure — variable interpolation happens before these run)
// ---------------------------------------------------------------------------

const hasText = (v?: string) => typeof v === 'string' && v.trim() !== '';

/** Builds a single filter leaf, or null when the row is incomplete. */
export function buildFilterLeaf(
  row: RecordsFilterRow,
  view: { space: string; externalId: string; version: string }
): RecordsFilterDefinition | null {
  const leaf = buildPositiveLeaf(row, view);
  if (!leaf) {
    return null;
  }
  // Negation wraps the finished leaf, so every operator gets it for free -- an
  // incomplete row stays skipped rather than becoming "not nothing".
  return row.negate ? { not: leaf } : leaf;
}

function buildPositiveLeaf(
  row: RecordsFilterRow,
  view: { space: string; externalId: string; version: string }
): RecordsFilterDefinition | null {
  if (!row?.property) {
    return null;
  }
  const property = viewPropertyRef(view, row.property);
  const { propertyType: type } = row;

  switch (row.operator) {
    case 'exists':
      return { exists: { property } };
    case 'equals':
      return hasText(row.value)
        ? { equals: { property, value: coerceValue(row.value!, type, row.property) } }
        : null;
    case 'prefix':
      return hasText(row.value) ? { prefix: { property, value: row.value!.trim() } } : null;
    case 'in':
    case 'containsAll':
    case 'containsAny': {
      const values = (row.values ?? [])
        .filter(hasText)
        .map((v) => coerceValue(v, type, row.property));
      if (!values.length) {
        return null;
      }
      return row.operator === 'in'
        ? { in: { property, values } }
        : row.operator === 'containsAll'
          ? { containsAll: { property, values } }
          : { containsAny: { property, values } };
    }
    case 'range': {
      const bounds: Record<string, unknown> = {};
      (['gte', 'lte'] as const).forEach((key) => {
        if (hasText(row[key])) {
          bounds[key] = coerceValue(row[key]!, type, row.property);
        }
      });
      return Object.keys(bounds).length ? { range: { property, ...bounds } } : null;
    }
    default:
      return null;
  }
}

export function buildFilter(
  query: RecordsQuery
): RecordsFilterDefinition | undefined {
  const { view, filters } = query;
  if (!view) {
    return undefined;
  }
  const leaves = (filters ?? [])
    .map((row) => buildFilterLeaf(row, view))
    .filter((leaf): leaf is RecordsFilterDefinition => leaf !== null);

  if (!leaves.length) {
    return undefined;
  }
  return leaves.length === 1 ? leaves[0] : { and: leaves };
}

/** Sort rows the API cannot be asked about, because their container is unknown. */
export function unmappedSortRows(sort: RecordsSortRow[] | undefined): string[] {
  return (sort ?? [])
    .filter(
      (row) =>
        row?.property &&
        !isTopLevelProperty(row.property) &&
        !(row.containerSpace && row.containerExternalId && row.containerPropertyIdentifier)
    )
    .map((row) => row.property);
}

/**
 * Sort must reference the underlying container property: the records API rejects
 * view paths in `sort`. Rows carry the mapping, resolved when the property is
 * picked and re-resolved on view switch.
 */
export function buildSort(
  sort: RecordsSortRow[] | undefined
): RecordsSortSpec[] | undefined {
  const specs = (sort ?? [])
    .map((row): RecordsSortSpec | null => {
      if (!row?.property) {
        return null;
      }
      // Top-level properties sort by their single-segment path; only view
      // properties need resolving down to their container.
      if (isTopLevelProperty(row.property)) {
        return {
          property: [row.property],
          direction: row.direction === 'desc' ? 'descending' : 'ascending',
        };
      }
      // Stored at edit time, and re-resolved when the view changes. Resolving here
      // from a viewDef the datasource does not have would make the request preview
      // disagree with the request actually sent.
      const { containerSpace, containerExternalId, containerPropertyIdentifier } = row;
      if (!containerSpace || !containerExternalId || !containerPropertyIdentifier) {
        return null;
      }
      return {
        property: [containerSpace, containerExternalId, containerPropertyIdentifier],
        direction: row.direction === 'desc' ? 'descending' : 'ascending',
      };
    })
    .filter((spec): spec is RecordsSortSpec => spec !== null);

  return specs.length ? specs.slice(0, 5) : undefined;
}

export interface RecordsBuildOptions {
  /** Panel resolution target; drives the "auto" bucket interval. */
  maxDataPoints?: number;
  /** The selected view's stream limit, which the time range must stay within. */
  maxFilteringIntervalMs?: number;
  /** CDF project, so the preview shows the real URL rather than a placeholder. */
  project?: string;
}

export interface RecordsTimeWindow {
  gte: number;
  lte: number;
}

/** Resolves the lastUpdatedTime window for a query: the dashboard range, or none. */
export function resolveTimeWindow(
  query: RecordsQuery,
  range: Tuple<number> | null
): RecordsTimeWindow | undefined {
  if (query.timeFilterMode === 'none' || !range) {
    return undefined;
  }
  return { gte: range[0], lte: range[1] };
}

// ---------------------------------------------------------------------------
// Stream rules -- shared by the datasource and the request preview, so the preview
// is the request that is sent
// ---------------------------------------------------------------------------

const IMMUTABLE_TIME_RANGE_WARNING =
  `This stream is immutable, so the CDF requires a time range. ` +
  `The dashboard time range was applied to lastUpdatedTime.`;

/** Build options a stream implies: its filtering limit. */
export const streamBuildOptions = (
  stream: StreamDefinition | null,
  options: RecordsBuildOptions = {}
): RecordsBuildOptions => ({
  ...options,
  maxFilteringIntervalMs:
    parseIsoDurationMs(stream?.settings?.limits?.maxFilteringInterval) ??
    options.maxFilteringIntervalMs,
});

/**
 * The query the datasource actually runs on a stream. Stream metadata is advisory:
 * without it the query runs as configured.
 */
export function applyStreamConstraints(
  query: RecordsQuery,
  stream: StreamDefinition | null,
  range: Tuple<number>,
  options: RecordsBuildOptions
): { query: RecordsQuery; warnings: string[] } {
  const warnings: string[] = [];
  if (!stream) {
    return { query, warnings };
  }

  let effective = query;
  const immutable = stream.type === 'Immutable';
  if (immutable && query.timeFilterMode === 'none') {
    warnings.push(IMMUTABLE_TIME_RANGE_WARNING);
    effective = { ...query, timeFilterMode: 'dashboard' };
  }

  if (effective.timeFilterMode !== 'none') {
    const maxInterval = options.maxFilteringIntervalMs ?? null;
    const span = range[1] - range[0];
    if (maxInterval && span > maxInterval) {
      const days = (ms: number) => Math.round(ms / (24 * 60 * 60 * 1000));
      warnings.push(
        `The dashboard time range spans ${days(span)} days, but stream "${stream.externalId}" ` +
          `accepts at most ${days(maxInterval)} days per request. Shorten the time range.`
      );
    }
  }

  return { query: effective, warnings };
}

export function buildRecordsFilterRequest(
  query: RecordsQuery,
  range: Tuple<number> | null
): RecordsFilterRequest {
  const { view } = query;
  if (!view) {
    throw new Error('A record view must be selected before building a request.');
  }
  // The API rejects reserved identifiers in `sources[].properties` with a 400, and
  // returns space/externalId/createdTime/lastUpdatedTime on every record regardless,
  // so a selected top-level property is dropped from the request rather than sent.
  const columns = (query.columns ?? []).filter(hasText).filter((c) => !isTopLevelProperty(c));
  const lastUpdatedTime = resolveTimeWindow(query, range);
  // Built once each: `buildFilter` can throw on a malformed value, and calling it
  // twice ran that failure path twice.
  const filter = buildFilter(query);
  const sort = buildSort(query.sort);

  return {
    ...(lastUpdatedTime && { lastUpdatedTime }),
    sources: [
      {
        source: {
          type: 'view',
          space: view.space,
          externalId: view.externalId,
          version: view.version,
        },
        properties: columns.length ? columns : ['*'],
      },
    ],
    ...(filter && { filter }),
    ...(sort && { sort }),
    limit: Math.min(Math.max(query.limit || RECORDS_PAGE_LIMIT, 1), RECORDS_PAGE_LIMIT),
    includeTyping: true,
  };
}

/** Aggregate identifiers the API reserves or rejects. */
const RESERVED_METRIC_NAMES = ['_count', '_bucket_count'];

export function validateMetricName(
  name: string,
  otherNames: string[] = []
): string | null {
  const trimmed = (name ?? '').trim();
  if (!trimmed) {
    return 'Name is required';
  }
  if (/[.[\]>]/.test(trimmed)) {
    return 'Name cannot contain . [ ] or >';
  }
  if (RESERVED_METRIC_NAMES.includes(trimmed)) {
    return `"${trimmed}" is reserved by the API`;
  }
  // The response walker treats every `bucket_*` key as a nesting level, so a metric
  // named this way is accepted, sent, and then silently dropped from the frame.
  if (trimmed.startsWith('bucket_')) {
    return '"bucket_" is a reserved prefix';
  }
  if (otherNames.filter((n) => n === trimmed).length > 0) {
    return 'Names must be unique';
  }
  return null;
}

/**
 * The records API accepts exactly `[1-9][0-9]*(ms|s|m|h|d)` for fixedInterval —
 * verified against the API, which rejects `5w`/`5M`/`5y` outright. Grafana's
 * `$__interval` happily produces values outside that set, so everything is
 * normalised through here before it reaches a request.
 */
const FIXED_INTERVAL_PATTERN = /^(\d+)(ms|s|m|h|d|w|M|y)$/;

/** The API rejects a histogram that would produce more buckets than this. */
export const MAX_HISTOGRAM_BUCKETS = 10000;

/** The API rejects a uniqueValues size above this ("Size is too large"). */
export const MAX_UNIQUE_VALUES_SIZE = 10000;

/** A uniqueValues size the API accepts: a whole number from 1 to the maximum. */
export function clampBucketSize(size: number): number {
  const whole = Math.floor(Number(size));
  if (!Number.isFinite(whole) || whole < 1) {
    return 10;
  }
  return Math.min(whole, MAX_UNIQUE_VALUES_SIZE);
}

/**
 * Candidate auto intervals, ascending. Every entry is expressible in the API's
 * fixedInterval grammar and reads as a "round" number on a time axis.
 */
const AUTO_INTERVAL_LADDER_MS = [
  10, 20, 50, 100, 200, 500,
  SECOND, 2 * SECOND, 5 * SECOND, 10 * SECOND, 15 * SECOND, 30 * SECOND,
  MINUTE, 2 * MINUTE, 5 * MINUTE, 10 * MINUTE, 15 * MINUTE, 30 * MINUTE,
  HOUR, 2 * HOUR, 3 * HOUR, 6 * HOUR, 12 * HOUR,
  DAY, 2 * DAY, 7 * DAY, 14 * DAY, 30 * DAY, 90 * DAY, 180 * DAY, 365 * DAY,
];

/** Renders a duration using the largest unit that divides it evenly. */
export function formatFixedInterval(ms: number): string {
  const amount = Math.max(1, Math.round(ms));
  for (const [unitMs, suffix] of [
    [DAY, 'd'],
    [HOUR, 'h'],
    [MINUTE, 'm'],
    [SECOND, 's'],
  ] as Array<[number, string]>) {
    if (amount % unitMs === 0) {
      return `${amount / unitMs}${suffix}`;
    }
  }
  return `${amount}ms`;
}

/**
 * Picks a bucket size for "auto": the smallest ladder step that both hits the
 * panel's resolution target and stays under the API's bucket ceiling. Because it
 * derives from the time range, it re-resolves whenever the range changes.
 */
export function computeAutoInterval(
  spanMs: number,
  maxDataPoints?: number
): string {
  const span = Math.max(spanMs || 0, 1);
  const points = Math.max(maxDataPoints || 0, 1);
  const target = span / points;
  const ceiling = span / MAX_HISTOGRAM_BUCKETS;

  const chosen =
    AUTO_INTERVAL_LADDER_MS.find((step) => step >= target && step > ceiling) ??
    AUTO_INTERVAL_LADDER_MS[AUTO_INTERVAL_LADDER_MS.length - 1];

  return formatFixedInterval(chosen);
}

/** True when the interval field is asking us to derive the value. */
export const isAutoInterval = (interval?: string) => {
  const value = (interval ?? '').trim().toLowerCase();
  return value === '' || value === 'auto' || value === '$__interval';
};

/**
 * Grafana's `$__interval` resolves to values the records API does not all accept
 * (it takes ms/s/m/h/d only). Normalise what we can and reject the rest.
 */
export function normalizeInterval(
  interval: string
): { interval?: string; warning?: string } {
  const value = (interval ?? '').trim();
  if (!value) {
    return { warning: 'A time bucket interval is required.' };
  }
  const match = FIXED_INTERVAL_PATTERN.exec(value);
  if (!match) {
    return { warning: `Interval "${value}" is not a valid fixed interval.` };
  }
  const [, amountRaw, unit] = match;
  const amount = Number(amountRaw);
  if (amount <= 0) {
    return { warning: `Interval "${value}" must be greater than zero.` };
  }
  // w/M/y are valid Grafana units but the API rejects them, so fold to days.
  if (unit === 'w') {
    return { interval: `${amount * 7}d` };
  }
  if (unit === 'M') {
    return { interval: `${amount * 30}d` };
  }
  if (unit === 'y') {
    return { interval: `${amount * 365}d` };
  }
  return { interval: `${amount}${unit}` };
}

/** Deterministic node names so the response walker can find its way back down. */
export const bucketNodeName = (index: number) => `bucket_${index}`;

function metricDefinition(
  metric: RecordsMetric,
  view: { space: string; externalId: string; version: string }
): RecordsAggregateDefinition | null {
  if (metric.function === 'count') {
    return { count: {} };
  }
  if (!metric.property) {
    return null;
  }
  const property = viewPropertyRef(view, metric.property);
  switch (metric.function) {
    case 'avg':
      return { avg: { property } };
    case 'min':
      return { min: { property } };
    case 'max':
      return { max: { property } };
    case 'sum':
      return { sum: { property } };
    default:
      return null;
  }
}

export function buildRecordsAggregateRequest(
  query: RecordsQuery,
  range: Tuple<number> | null,
  options: RecordsBuildOptions = {}
): { request: RecordsAggregateRequest; warnings: string[] } {
  const { view } = query;
  if (!view) {
    throw new Error('A record view must be selected before building a request.');
  }
  const warnings: string[] = [];

  // Metrics form the innermost level of the tree.
  const metricTree: RecordsAggregateTree = {};
  const usedNames: string[] = [];
  (query.metrics ?? []).forEach((metric) => {
    const nameError = validateMetricName(metric.name, usedNames);
    if (nameError) {
      warnings.push(`Metric "${metric.name}" was skipped: ${nameError.toLowerCase()}.`);
      return;
    }
    const definition = metricDefinition(metric, view);
    if (!definition) {
      warnings.push(
        `Metric "${metric.name}" was skipped: ${metric.function} requires a property.`
      );
      return;
    }
    usedNames.push(metric.name.trim());
    metricTree[metric.name.trim()] = definition;
  });

  if (!Object.keys(metricTree).length) {
    // Every bucket already reports `count`, so an empty Compute list still returns
    // something useful rather than a rejected request.
    metricTree.count = { count: {} };
  }

  // The query window, which also bounds every time bucket.
  const boundsWindow = resolveTimeWindow(query, range);

  // Fold buckets right-to-left so buckets[0] ends up outermost.
  const buckets = (query.buckets ?? []).filter((b) => b?.property);
  let aggregates: RecordsAggregateTree = metricTree;
  // Each time bucket is bounded to the window by a range filter on its axis, so
  // only buckets inside the panel come back and the bucket count stays bounded.
  // Not hardBounds: on a view property the API answers 500 when no record falls
  // inside them, where a range filter returns no buckets. The filter also takes
  // ISO-8601 only for a view timestamp, so the bounds are sent in that form.
  const axisFilters: RecordsFilterDefinition[] = [];
  for (let i = buckets.length - 1; i >= 0; i -= 1) {
    const bucket = buckets[i];
    const property = viewPropertyRef(view, bucket.property);
    let definition: RecordsAggregateDefinition | null = null;

    if (bucket.kind === 'timeHistogram') {
      if (boundsWindow) {
        axisFilters.push({
          range: {
            property,
            gte: new Date(boundsWindow.gte).toISOString(),
            lte: new Date(boundsWindow.lte).toISOString(),
          },
        });
      }
      const spanMs = boundsWindow
        ? boundsWindow.lte - boundsWindow.gte
        : range
          ? range[1] - range[0]
          : 0;
      // "auto" is resolved here rather than by Grafana, because $__interval can
      // land on units the API rejects and on bucket counts it refuses to serve.
      const autoInterval = () => computeAutoInterval(spanMs, options.maxDataPoints);
      const resolved = isAutoInterval(bucket.interval)
        ? { interval: autoInterval() }
        : normalizeInterval(bucket.interval);
      // Every level must stay in the tree: the response walker finds levels by
      // index, so dropping one would misalign it and lose all the levels below.
      let fixedInterval = resolved.interval;
      if (resolved.warning || !fixedInterval) {
        fixedInterval = autoInterval();
        warnings.push(`${resolved.warning} Using ${fixedInterval} (auto) instead.`);
      }
      definition = {
        timeHistogram: {
          property,
          fixedInterval,
          aggregates,
        },
      };
    } else {
      definition = {
        uniqueValues: {
          property,
          size: clampBucketSize(bucket.size),
          aggregates,
        },
      };
    }

    if (definition) {
      aggregates = { [bucketNodeName(i)]: definition };
    }
  }

  const leaves = [buildFilter(query), ...axisFilters].filter(
    (leaf): leaf is RecordsFilterDefinition => !!leaf
  );
  const filter = leaves.length > 1 ? { and: leaves } : leaves[0];

  return {
    request: {
      ...(boundsWindow && { lastUpdatedTime: boundsWindow }),
      ...(filter && { filter }),
      aggregates,
      includeTyping: true,
    },
    warnings,
  };
}

/**
 * The request the datasource sends for a query, rendered for the editor's read-only
 * preview so it can be copied and replayed as is. The query must arrive interpolated,
 * as the datasource interpolates it. Kept here so it can be tested directly.
 */
export interface RecordsRequestPreviewParts {
  /** e.g. "POST /api/v1/projects/my-project/streams/my-stream/records/filter" */
  path: string;
  /** Pretty-printed JSON request body; empty when the builder failed */
  body: string;
  error?: string;
}

/** Structured preview so the editor can style the path and body separately. */
export function buildRequestPreviewParts(
  query: RecordsQuery,
  range: Tuple<number> | null,
  options: RecordsBuildOptions = {},
  stream: StreamDefinition | null = null
): RecordsRequestPreviewParts | null {
  const { view, mode } = query;
  if (!view?.streamId) {
    return null;
  }
  const endpoint = mode === 'aggregate' ? 'aggregate' : 'filter';
  const project = options.project?.trim() || '{project}';
  const path = `POST /api/v1/projects/${project}/streams/${view.streamId}/records/${endpoint}`;
  // The datasource's own steps, in its order: the query arrives interpolated, the
  // stream's options and rules apply, then the same builder runs.
  const buildOptions = streamBuildOptions(stream, options);
  const effective = range ? applyStreamConstraints(query, stream, range, buildOptions).query : query;
  try {
    const body =
      mode === 'aggregate'
        ? buildRecordsAggregateRequest(effective, range, buildOptions).request
        : buildRecordsFilterRequest(effective, range);
    return { path, body: JSON.stringify(body, null, 2) };
  } catch (error) {
    return { path, body: '', error: String(error) };
  }
}


/**
 * The frame shape recordsAggregateToDataFrames will produce for this bucket
 * configuration — mirrors its exact filtering and grouping rules so the
 * editor's shape hint can never disagree with the actual result.
 */
export type RecordsResultShape =
  | { kind: 'timeseries'; seriesBy: string[] }
  | { kind: 'table'; groupBy: string[] }
  | { kind: 'single' };

export function deriveResultShape(buckets: RecordsBucket[]): RecordsResultShape {
  const complete = (buckets ?? []).filter((b) => b?.property);
  if (!complete.length) {
    return { kind: 'single' };
  }
  const hasTimeBucket = complete.some((b) => b.kind === 'timeHistogram');
  const labelKeys = complete
    .filter((b) => b.kind === 'uniqueValues')
    .map((b) => b.property);
  return hasTimeBucket
    ? { kind: 'timeseries', seriesBy: labelKeys }
    : { kind: 'table', groupBy: labelKeys };
}

// ---------------------------------------------------------------------------
// ISO-8601 duration parsing (only used for the maxFilteringInterval warning)
// ---------------------------------------------------------------------------

/**
 * Renders a stream limit like "PT168H" as "7 days". The API speaks ISO-8601
 * durations; nobody reading a badge should have to decode one.
 */
export function formatDurationHuman(duration?: string): string | undefined {
  const ms = parseIsoDurationMs(duration);
  if (ms === null) {
    return duration || undefined;
  }
  const units: Array<[number, string]> = [
    [DAY, 'day'],
    [HOUR, 'hour'],
    [MINUTE, 'minute'],
    [SECOND, 'second'],
  ];
  for (const [size, name] of units) {
    if (ms >= size) {
      // Show one decimal only when the value does not divide evenly.
      const value = ms / size;
      const rendered = Number.isInteger(value) ? String(value) : value.toFixed(1);
      return `${rendered} ${name}${value === 1 ? '' : 's'}`;
    }
  }
  return `${ms} ms`;
}

/** Approximates months/years -- good enough for a guardrail warning, never for a request. */
export function parseIsoDurationMs(duration?: string): number | null {
  return duration ? parseDurationMs(duration) : null;
}

// ---------------------------------------------------------------------------
// Response → DataFrame
// ---------------------------------------------------------------------------

function fieldTypeFor(property?: RecordViewProperty): FieldType {
  const type = property?.type?.type;
  if (property?.type?.list) {
    return FieldType.other;
  }
  // `timestamp` is a real instant, so it becomes epoch ms and Grafana renders it in
  // the dashboard timezone. `date` is a calendar date with no instant behind it --
  // typing it as time would make Grafana shift it and show the previous day west of
  // UTC, so it is passed through as the string the API stored.
  if (type === 'timestamp') {
    return FieldType.time;
  }
  if (isNumericType(type)) {
    return FieldType.number;
  }
  if (type === 'boolean') {
    return FieldType.boolean;
  }
  if (type === 'json') {
    return FieldType.other;
  }
  return FieldType.string;
}

/**
 * How a non-scalar property value reads in a frame. Direct relations come back as
 * `{ space, externalId }` -- both as record properties and as uniqueValues bucket
 * values -- and would otherwise stringify to "[object Object]".
 */
export function formatComplexValue(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value !== 'object') {
    return String(value);
  }
  if (value.space && value.externalId) {
    return `${value.space}:${value.externalId}`;
  }
  return JSON.stringify(value);
}

function normalizeValue(value: any, fieldType: FieldType): any {
  if (value === null || value === undefined) {
    return null;
  }
  if (fieldType === FieldType.time) {
    if (typeof value === 'number') {
      return value;
    }
    // Everything CDF stores is UTC. A string without an offset would otherwise be
    // parsed as browser-local time, silently skewing the frame by the viewer's offset.
    const iso = /(Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : `${value}Z`;
    const parsed = new Date(iso).getTime();
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (fieldType === FieldType.string && typeof value === 'object') {
    return formatComplexValue(value);
  }
  return value;
}

/** Flattens `properties[space][view/version]` into one row per record. */
export function recordsToDataFrame(
  items: RecordsItem[],
  typing: RecordsTyping | undefined,
  query: RecordsQuery,
  refId?: string
): DataFrame {
  const { view } = query;
  const sourceKey = view ? viewSourceKey(view) : '';
  const space = view?.space ?? '';
  const viewTyping = typing?.[space]?.[sourceKey];

  const propsOf = (item: RecordsItem) =>
    item.properties?.[space]?.[sourceKey] ?? {};

  // The selection drives the frame, mixing view properties with the record's own
  // top-level ones. Those never reach `sources[].properties` (the API 400s on
  // reserved identifiers) but they are on every record, so they are free to render.
  const selected = (query.columns ?? []).filter(hasText);
  const columnNames = selected.length
    ? selected
    : // Nothing selected means everything: the record's identity, whatever view
      // properties the records carry, then the record's timestamps.
      [
        'externalId',
        'space',
        ...Array.from(
          items.reduce((acc, item) => {
            Object.keys(propsOf(item)).forEach((k) => acc.add(k));
            return acc;
          }, new Set<string>(
            // A zero-row response carries no properties to learn from, so the
            // response typing supplies them instead. Without this an empty result
            // produced a differently-shaped frame from a non-empty one, breaking
            // panels and transformations keyed on the property fields.
            items.length ? [] : Object.keys(viewTyping ?? {})
          ))
        ),
        'lastUpdatedTime',
        'createdTime',
      ];

  const frame = new MutableDataFrame({
    refId,
    name: view ? `${view.externalId}/${view.version}` : 'records',
    fields: [],
  });

  const typeOf = (name: string): FieldType => {
    const topLevel = topLevelProperty(name);
    if (topLevel) {
      return topLevel.type === 'timestamp' ? FieldType.time : FieldType.string;
    }
    return fieldTypeFor(viewTyping?.[name]);
  };

  columnNames.forEach((name) => {
    frame.addField({ name, type: typeOf(name) });
  });

  items.forEach((item) => {
    const properties = propsOf(item);
    const row: Record<string, any> = {};
    columnNames.forEach((name) => {
      const raw = topLevelProperty(name)
        ? (item as Record<string, any>)[name]
        : properties[name];
      row[name] = normalizeValue(raw, typeOf(name));
    });
    frame.add(row);
  });

  return frame;
}

interface FlatAggregateRow {
  /** Bucket values keyed by the bucket's property name; time buckets use epoch ms. */
  keys: Record<string, any>;
  timestamp?: number;
  /** Numbers, or an ISO-8601 string for min/max over a timestamp. */
  metrics: Record<string, number | string | null>;
}

function metricValue(node: RecordsAggregateResultNode): number | string | null {
  const keys = ['avg', 'min', 'max', 'sum', 'count'] as const;
  for (const key of keys) {
    const value = node[key];
    if (typeof value === 'number' || typeof value === 'string') {
      return value;
    }
  }
  return null;
}

/**
 * Walks the nested bucket tree, emitting one flat row per innermost bucket.
 *
 * Only the metrics the user configured become columns. The API also reports a
 * record count on every bucket, but surfacing it unasked would add a duplicate
 * column whenever the user already has a Count metric — and in a time series
 * panel every numeric field is a series, so it would draw a phantom line too.
 * An empty Compute list already gets a count metric from the request builder.
 */
function flattenAggregates(
  node: Record<string, RecordsAggregateResultNode>,
  buckets: RecordsBucket[],
  depth: number,
  keys: Record<string, any>,
  timestamp: number | undefined,
  rows: FlatAggregateRow[]
): void {
  const bucket = buckets[depth];
  const bucketNode = bucket ? node?.[bucketNodeName(depth)] : undefined;

  if (bucket && bucketNode) {
    if (bucket.kind === 'timeHistogram') {
      (bucketNode.timeHistogramBuckets ?? []).forEach((b) => {
        flattenAggregates(
          b.aggregates ?? {},
          buckets,
          depth + 1,
          keys,
          new Date(b.intervalStart).getTime(),
          rows
        );
      });
      return;
    }
    (bucketNode.uniqueValueBuckets ?? []).forEach((b) => {
      flattenAggregates(
        b.aggregates ?? {},
        buckets,
        depth + 1,
        { ...keys, [bucket.property]: b.value },
        timestamp,
        rows
      );
    });
    return;
  }

  // Innermost level: collect the metric values.
  const metrics: Record<string, number | string | null> = {};
  Object.entries(node ?? {}).forEach(([name, value]) => {
    if (name.startsWith('bucket_')) {
      return;
    }
    metrics[name] = metricValue(value);
  });
  rows.push({ keys, timestamp, metrics });
}

/**
 * The metrics whose result is an instant: min or max over a timestamp property. The
 * API returns those as ISO-8601 strings, so they become time fields, not numbers.
 */
function timestampMetricNames(
  query: RecordsQuery,
  typing: RecordsTyping | undefined
): Set<string> {
  const viewTyping = query.view
    ? typing?.[query.view.space]?.[viewSourceKey(query.view)]
    : undefined;
  const typeOf = (property: string) =>
    topLevelProperty(property)?.type ?? viewTyping?.[property]?.type?.type;
  return new Set(
    (query.metrics ?? [])
      .filter((m) => m.function === 'min' || m.function === 'max')
      .filter((m) => !!m.property && typeOf(m.property) === 'timestamp')
      .map((m) => m.name.trim())
  );
}

/**
 * Aggregate results become labeled time series when a time bucket is present, so
 * time series panels render them without a transform; otherwise one table frame.
 */
export function recordsAggregateToDataFrames(
  response: RecordsAggregateResponse,
  query: RecordsQuery,
  refId?: string
): DataFrame[] {
  const buckets = (query.buckets ?? []).filter((b) => b?.property);
  const rows: FlatAggregateRow[] = [];
  flattenAggregates(response.aggregates ?? {}, buckets, 0, {}, undefined, rows);

  if (!rows.length) {
    return [new MutableDataFrame({ refId, fields: [] })];
  }

  const metricNames = Array.from(
    rows.reduce((acc, row) => {
      Object.keys(row.metrics).forEach((name) => acc.add(name));
      return acc;
    }, new Set<string>())
  );
  const timeMetrics = timestampMetricNames(query, response.typing);
  const metricType = (name: string) =>
    timeMetrics.has(name) ? FieldType.time : FieldType.number;
  // A bucket with no values for the property reports 0 rather than null, for a
  // timestamp too, where a real result is always a string. So only a string is read
  // as an instant, and the 0 becomes an empty cell instead of 1 January 1970.
  const metricCell = (row: FlatAggregateRow, name: string) => {
    const value = row.metrics[name];
    if (timeMetrics.has(name)) {
      return typeof value === 'string' ? normalizeValue(value, FieldType.time) : null;
    }
    return typeof value === 'number' ? value : null;
  };
  const hasTimeBucket = buckets.some((b) => b.kind === 'timeHistogram');
  const labelKeys = buckets
    .filter((b) => b.kind === 'uniqueValues')
    .map((b) => b.property);

  if (!hasTimeBucket) {
    const frame = new MutableDataFrame({ refId, name: 'aggregates', fields: [] });
    labelKeys.forEach((key) => frame.addField({ name: key, type: FieldType.string }));
    metricNames.forEach((name) => {
      frame.addField({ name: name, type: metricType(name) });
    });
    rows.forEach((row) => {
      const out: Record<string, any> = {};
      labelKeys.forEach((key) => {
        // Bucket values are objects for direct relations, so they are rendered the
        // same way the property itself is rendered in a list frame.
        out[key] = key in row.keys ? formatComplexValue(row.keys[key]) : null;
      });
      metricNames.forEach((name) => {
        out[name] = metricCell(row, name);
      });
      frame.add(out);
    });
    return [frame];
  }

  // One frame per distinct combination of non-time bucket values.
  const groups = new Map<string, FlatAggregateRow[]>();
  rows.forEach((row) => {
    const key = labelKeys.map((k) => formatComplexValue(row.keys[k])).join(' · ');
    const existing = groups.get(key);
    if (existing) {
      existing.push(row);
    } else {
      groups.set(key, [row]);
    }
  });

  return Array.from(groups.entries()).map(([groupKey, groupRows]) => {
    const labels = labelKeys.reduce<Record<string, string>>((acc, key) => {
      acc[key] = formatComplexValue(groupRows[0].keys[key]);
      return acc;
    }, {});

    const sorted = [...groupRows].sort(
      (a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0)
    );
    const frame = new MutableDataFrame({
      refId,
      name: groupKey || 'aggregates',
      fields: [],
    });
    frame.addField({ name: 'time', type: FieldType.time });
    metricNames.forEach((name) => {
      frame.addField({
        name,
        type: metricType(name),
        // Labels are kept so "group by label" transformations and series overrides
        // can match on the bucket value...
        labels: labelKeys.length ? labels : undefined,
        config: {
          // ...but the series name is set explicitly, because Grafana would otherwise
          // compose it from the frame name, the field name and the labels, printing
          // the bucket value twice ("i=10523 duration (s) i=10523").
          displayNameFromDS: groupKey ? `${groupKey} · ${name}` : name,
        },
      });
    });
    sorted.forEach((row) => {
      const out: Record<string, any> = { time: row.timestamp ?? null };
      metricNames.forEach((name) => {
        out[name] = metricCell(row, name);
      });
      frame.add(out);
    });
    return frame;
  });
}
