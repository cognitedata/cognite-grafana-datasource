/** Builds /records/filter requests: filters, sort, unit conversion, the time window and the stream rules. */
import { RECORDS_PAGE_LIMIT } from '../../constants';
import {
  DAY,
  HOUR,
  MINUTE,
  SECOND,
  evaluateTimeExpression,
  parseDurationMs,
} from '../timeExpression';
import { RecordsFilterRow, RecordsQuery, RecordsSortRow, Tuple } from '../../types';
import { INSTANCE_REF_HINT, parseInstanceRef } from '../instanceRef';
import {
  RecordsFilterDefinition,
  RecordsFilterRequest,
  RecordsSortSpec,
  RecordsTargetUnits,
  StreamDefinition,
} from '../../types/records';
import { isNumericType, isTopLevelProperty, viewPropertyRef } from './schema';

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

export const hasText = (v?: string) => typeof v === 'string' && v.trim() !== '';

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

/**
 * Builds the targetUnits clause. Property references are view paths — the same
 * form used by filters, sort targets and aggregates — because the API matches
 * targetUnits by exact reference: a container path alongside a view-path query
 * returns 200 and quietly performs no conversion.
 *
 * unitSystem and per-property targetUnits are a oneOf in the API; the system
 * wins when both are somehow set, so a stale saved query can never send both.
 */
export function buildTargetUnits(
  query: RecordsQuery
): RecordsTargetUnits | undefined {
  const { view } = query;
  if (!view) {
    return undefined;
  }
  if (hasText(query.unitSystem)) {
    return { unitSystemName: query.unitSystem!.trim() };
  }
  const properties = (query.targetUnits ?? [])
    .filter((entry) => hasText(entry?.property) && hasText(entry?.unitExternalId))
    .map((entry) => ({
      property: viewPropertyRef(view, entry.property),
      unit: { externalId: entry.unitExternalId.trim() },
    }));
  return properties.length ? { properties } : undefined;
}

export interface RecordsBuildOptions {
  /** Panel resolution target; drives the "auto" bucket interval. */
  maxDataPoints?: number;
  /** The selected view's stream limit, for {{maxFilteringInterval}}. */
  maxFilteringIntervalMs?: number;
  /** Injected so "{{now}}" is reproducible in tests. */
  now?: number;
  /** CDF project, so the preview shows the real URL rather than a placeholder. */
  project?: string;
}

export interface RecordsTimeWindow {
  gte: number;
  lte: number;
}

/**
 * The bounds a custom window starts from until the user edits them: the latest slice
 * a stream with a filtering limit accepts, or the dashboard range on a stream without
 * one, where {{maxFilteringInterval}} has nothing to resolve to.
 */
export const defaultWindowBounds = (maxFilteringIntervalMs?: number) => ({
  from: maxFilteringIntervalMs ? '{{endTime}} - {{maxFilteringInterval}}' : '{{startTime}}',
  to: '{{endTime}}',
});

/** A custom window's bounds, with the stream's defaults for any left unset. */
export function windowBounds(
  query: Pick<RecordsQuery, 'timeFilterFrom' | 'timeFilterTo'>,
  maxFilteringIntervalMs?: number
): { from: string; to: string } {
  const defaults = defaultWindowBounds(maxFilteringIntervalMs);
  return {
    from: query.timeFilterFrom ?? defaults.from,
    to: query.timeFilterTo ?? defaults.to,
  };
}

/**
 * Resolves the lastUpdatedTime window for a query. "custom" evaluates the user's
 * expressions; anything that fails to resolve is reported rather than silently
 * dropped, because a missing window is a hard error on immutable streams.
 */
export function resolveTimeWindow(
  query: RecordsQuery,
  range: Tuple<number> | null,
  options: RecordsBuildOptions = {}
): { window?: RecordsTimeWindow; warnings: string[] } {
  const warnings: string[] = [];
  const mode = query.timeFilterMode ?? 'dashboard';

  if (mode === 'none') {
    return { warnings };
  }

  if (mode === 'custom') {
    const ctx = {
      startTime: range ? range[0] : undefined,
      endTime: range ? range[1] : undefined,
      now: options.now,
      maxFilteringIntervalMs: options.maxFilteringIntervalMs,
    };
    const bounds = windowBounds(query, options.maxFilteringIntervalMs);
    const from = evaluateTimeExpression(bounds.from, ctx);
    const to = evaluateTimeExpression(bounds.to, ctx);

    if (from.error) {
      warnings.push(`Time filter "from" is invalid: ${from.error}.`);
    }
    if (to.error) {
      warnings.push(`Time filter "to" is invalid: ${to.error}.`);
    }
    if (from.ms === undefined || to.ms === undefined) {
      return { warnings };
    }
    if (from.ms >= to.ms) {
      warnings.push('Time filter "from" must be earlier than "to".');
      return { warnings };
    }
    return { window: { gte: from.ms, lte: to.ms }, warnings };
  }

  if (!range) {
    return { warnings };
  }
  return { window: { gte: range[0], lte: range[1] }, warnings };
}

// ---------------------------------------------------------------------------
// Stream rules -- shared by the datasource and the request preview, so the preview
// is the request that is sent
// ---------------------------------------------------------------------------

const IMMUTABLE_TIME_RANGE_WARNING =
  `This stream is immutable, so the CDF requires a time range. ` +
  `The dashboard time range was applied to lastUpdatedTime.`;
const CUSTOM_WINDOW_FALLBACK_WARNING =
  'The custom time window could not be resolved, so the dashboard time range was used instead.';

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
  let effective = query;

  // A custom window that does not resolve falls back to the dashboard range on every
  // stream, whether or not its metadata could be read: an immutable stream rejects a
  // request without a window, and on a mutable one dropping it would read the whole
  // stream instead of the range the user meant. The reasons are kept in the warning.
  if (effective.timeFilterMode === 'custom') {
    const resolved = resolveTimeWindow(effective, range, options);
    if (!resolved.window) {
      warnings.push(...resolved.warnings, CUSTOM_WINDOW_FALLBACK_WARNING);
      effective = { ...effective, timeFilterMode: 'dashboard' };
    }
  }

  if (!stream) {
    return { query: effective, warnings };
  }

  const immutable = stream.type === 'Immutable';
  if (immutable && effective.timeFilterMode === 'none') {
    warnings.push(IMMUTABLE_TIME_RANGE_WARNING);
    effective = { ...effective, timeFilterMode: 'dashboard' };
  }

  if (effective.timeFilterMode !== 'none') {
    const maxInterval = options.maxFilteringIntervalMs ?? null;
    const window = resolveTimeWindow(effective, range, options).window;
    const span = window ? window.lte - window.gte : range[1] - range[0];
    if (maxInterval && span > maxInterval) {
      const days = (ms: number) => Math.round(ms / (24 * 60 * 60 * 1000));
      const custom = effective.timeFilterMode === 'custom';
      warnings.push(
        `The ${custom ? 'custom time window' : 'dashboard time range'} spans ${days(span)} days, ` +
          `but stream "${stream.externalId}" accepts at most ${days(maxInterval)} days per request. ` +
          (custom ? 'Narrow the window bounds.' : 'Shorten the time range.')
      );
    }
  }

  return { query: effective, warnings };
}

export function buildRecordsFilterRequest(
  query: RecordsQuery,
  range: Tuple<number> | null,
  options: RecordsBuildOptions = {}
): RecordsFilterRequest {
  const { view } = query;
  if (!view) {
    throw new Error('A record view must be selected before building a request.');
  }
  // The API rejects reserved identifiers in `sources[].properties` with a 400, and
  // returns space/externalId/createdTime/lastUpdatedTime on every record regardless,
  // so a selected top-level property is dropped from the request rather than sent.
  const columns = (query.columns ?? []).filter(hasText).filter((c) => !isTopLevelProperty(c));
  const { window: lastUpdatedTime } = resolveTimeWindow(query, range, options);
  // Built once each: `buildFilter` can throw on a malformed value, and calling it
  // twice ran that failure path twice.
  const filter = buildFilter(query);
  const sort = buildSort(query.sort);
  const targetUnits = buildTargetUnits(query);

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
    ...(targetUnits && { targetUnits }),
    includeTyping: true,
  };
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

/**
 * Approximates months/years -- good enough for a guardrail warning, never for a
 * request. Delegates to the time-expression parser so a stream limit and a custom
 * window agree on what a duration means.
 */
export function parseIsoDurationMs(duration?: string): number | null {
  return duration ? parseDurationMs(duration) : null;
}
