/**
 * The Records query model: what the editor builds and a dashboard saves.
 *
 * Separate from `./records`, which describes the API's own view/stream shapes. Both
 * are re-exported from `../types`, so importers need not know which is which.
 */
import { RECORDS_PAGE_LIMIT } from "../constants";

export type RecordsQueryMode = "list" | "aggregate";

export type RecordsFilterOperator =
  | "equals"
  | "in"
  | "range"
  | "prefix"
  | "exists"
  | "containsAll"
  | "containsAny";

export interface RecordsViewRef {
  space: string;
  externalId: string;
  version: string;
  /** Derived from the record view's streamId at selection time */
  streamId: string;
}

export interface RecordsFilterRow {
  /** View property name. Empty means the row is incomplete and is skipped when building. */
  property: string;
  /** Cached from the view definition so the builder can coerce values without refetching */
  propertyType?: string;
  /**
   * Inverts this row's condition (the request wraps it in `not`). Rows are still
   * joined with AND, so this expresses "everything except…" per condition.
   */
  negate?: boolean;
  operator: RecordsFilterOperator;
  value?: string;
  values?: string[];
  gte?: string;
  lte?: string;
}

export interface RecordsSortRow {
  property: string;
  direction: "asc" | "desc";
  /**
   * The records API only sorts on container paths, never view paths. These are resolved
   * from the view definition when the row is edited; a row without them is skipped
   * and reported.
   */
  containerSpace?: string;
  containerExternalId?: string;
  containerPropertyIdentifier?: string;
}

export interface RecordsTimeBucket {
  kind: "timeHistogram";
  property: string;
  interval: string;
}

export interface RecordsValuesBucket {
  kind: "uniqueValues";
  property: string;
  size: number;
}

export type RecordsBucket = RecordsTimeBucket | RecordsValuesBucket;

export type RecordsMetricFunction = "count" | "avg" | "min" | "max" | "sum";

export interface RecordsMetric {
  /** Aggregate identifier in the request and the column name in the frame */
  name: string;
  function: RecordsMetricFunction;
  property?: string;
}

/**
 * How the lastUpdatedTime window is chosen. Immutable streams always need one
 */
export type RecordsTimeFilterMode = "dashboard" | "none";

/**
 * One property converted to a specific unit. The property is referenced exactly
 * as it is elsewhere in the request (a view path) — the API matches targetUnits
 * by reference, so a container path against a view-path query is accepted and
 * then silently ignored.
 */
export interface RecordsTargetUnit {
  property: string;
  /** CogniteUnit externalId, e.g. "pressure:psi". */
  unitExternalId: string;
}

export interface RecordsQuery {
  view?: RecordsViewRef;
  mode: RecordsQueryMode;
  /** Flat rows, combined with AND */
  filters: RecordsFilterRow[];
  sort: RecordsSortRow[];
  limit: number;
  /** Empty means all view properties */
  columns: string[];
  /** Ordered outermost first; order is the nesting order in the aggregate tree */
  buckets: RecordsBucket[];
  metrics: RecordsMetric[];
  timeFilterMode: RecordsTimeFilterMode;
  /**
   * Unit conversion. The API models these as a oneOf, so at most one applies:
   * a unit system converts everything convertible, target units convert
   * named properties. Absent/empty means values come back in storage units.
   */
  unitSystem?: string;
  targetUnits?: RecordsTargetUnit[];
  /**
   * Drops the "(unit)" suffix from series and column names. Absent means the
   * suffix is appended, which is the default.
   */
  hideUnitSuffix?: boolean;
}

export const defaultRecordsQuery: RecordsQuery = {
  mode: "list",
  filters: [],
  sort: [],
  limit: RECORDS_PAGE_LIMIT,
  columns: [],
  buckets: [],
  metrics: [{ name: "count", function: "count" }],
  timeFilterMode: "dashboard",
};
