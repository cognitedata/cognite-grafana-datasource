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
  RecordsFilterOperator,
  RecordsFilterRow,
  RecordsQuery,
  RecordsSortRow,
  Tuple,
} from '../types';
import { INSTANCE_REF_HINT, parseInstanceRef } from './instanceRef';
import {
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
}

export const TOP_LEVEL_PROPERTIES: TopLevelProperty[] = [
  { name: 'space', type: 'text', operators: ['equals', 'in', 'prefix'] },
  { name: 'externalId', type: 'text', operators: ['equals', 'in', 'prefix'] },
  { name: 'createdTime', type: 'timestamp', operators: ['range', 'equals', 'in'] },
  { name: 'lastUpdatedTime', type: 'timestamp', operators: ['range', 'equals', 'in'] },
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
  const { view } = query;
  if (!view?.streamId) {
    return null;
  }
  const project = options.project?.trim() || '{project}';
  const path = `POST /api/v1/projects/${project}/streams/${view.streamId}/records/filter`;
  // The datasource's own steps, in its order: the query arrives interpolated, the
  // stream's options and rules apply, then the same builder runs.
  const buildOptions = streamBuildOptions(stream, options);
  const effective = range ? applyStreamConstraints(query, stream, range, buildOptions).query : query;
  try {
    const body = buildRecordsFilterRequest(effective, range);
    return { path, body: JSON.stringify(body, null, 2) };
  } catch (error) {
    return { path, body: '', error: String(error) };
  }
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
 * `{ space, externalId }` and would otherwise stringify to "[object Object]".
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
