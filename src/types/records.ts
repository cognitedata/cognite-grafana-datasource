// Records API types.
// Reference: POST /api/v1/projects/{project}/streams/{streamId}/records/{filter,aggregate}

/** A property type as declared on a record container and exposed through a record view. */
export interface RecordPropertyType {
  type: string; // 'text' | 'boolean' | 'float64' | 'int64' | 'timestamp' | 'date' | 'json' | 'direct' | 'enum' | ...
  list?: boolean;
  /** Present for enum properties; keys are the allowed values */
  values?: Record<string, { name?: string; description?: string }>;
  /**
   * Present for direct relations that declare a target: the view whose instances the
   * relation points at. The editor searches it to offer real instances to filter on.
   */
  source?: { type: 'view'; space: string; externalId: string; version: string };
}

export interface RecordViewProperty {
  name?: string;
  description?: string;
  type: RecordPropertyType;
  /** The container this view property is mapped from */
  container?: { type: 'container'; space: string; externalId: string };
  /** The property identifier inside that container */
  containerPropertyIdentifier?: string;
}

export interface RecordViewDefinition {
  space: string;
  externalId: string;
  version: string;
  name?: string;
  description?: string;
  usedFor: 'record';
  /** The stream this view reads from. The API models it as an array with exactly one entry. */
  streamId: string[];
  properties: Record<string, RecordViewProperty>;
  mappedContainers?: Array<{ type: 'container'; space: string; externalId: string }>;
  filter?: unknown;
  createdTime?: number;
  lastUpdatedTime?: number;
}

export interface StreamDefinition {
  externalId: string;
  createdTime?: number;
  createdFromTemplate?: string;
  type: 'Immutable' | 'Mutable';
  settings?: {
    lifecycle?: { dataDeletedAfter?: string; retainedAfterSoftDelete?: string };
    limits?: {
      maxRecordsTotal?: { provisioned: number; consumed?: number };
      maxGigaBytesTotal?: { provisioned: number; consumed?: number };
      /** ISO-8601 duration, e.g. "P1Y" or "P7D". Absent on mutable streams. */
      maxFilteringInterval?: string;
    };
  };
}

export interface RecordsViewSource {
  type: 'view';
  space: string;
  externalId: string;
  version: string;
}

export interface RecordsSourceSelector {
  source: RecordsViewSource;
  properties: string[];
}

export type RecordsPropertyRef = string[];

export interface RecordsFilterDefinition {
  and?: RecordsFilterDefinition[];
  or?: RecordsFilterDefinition[];
  not?: RecordsFilterDefinition;
  equals?: { property: RecordsPropertyRef; value: unknown };
  in?: { property: RecordsPropertyRef; values: unknown[] };
  range?: {
    property: RecordsPropertyRef;
    gte?: unknown;
    gt?: unknown;
    lte?: unknown;
    lt?: unknown;
  };
  prefix?: { property: RecordsPropertyRef; value: string };
  exists?: { property: RecordsPropertyRef };
  containsAll?: { property: RecordsPropertyRef; values: unknown[] };
  containsAny?: { property: RecordsPropertyRef; values: unknown[] };
  matchAll?: Record<string, never>;
}

export interface RecordsTimeRange {
  gte?: number | string;
  gt?: number | string;
  lte?: number | string;
  lt?: number | string;
}

export interface RecordsSortSpec {
  property: RecordsPropertyRef;
  direction: 'ascending' | 'descending';
}

export interface RecordsFilterRequest {
  lastUpdatedTime?: RecordsTimeRange;
  sources: RecordsSourceSelector[];
  filter?: RecordsFilterDefinition;
  sort?: RecordsSortSpec[];
  limit: number;
  includeTyping?: boolean;
}

/** Nested typing block: typing[space][viewExternalId/version][property] */
export type RecordsTyping = Record<
  string,
  Record<string, Record<string, RecordViewProperty>>
>;

export interface RecordsItem {
  space: string;
  externalId: string;
  createdTime: number;
  lastUpdatedTime: number;
  /** properties[space][viewExternalId/version][property] */
  properties?: Record<string, Record<string, Record<string, any>>>;
}

export interface RecordsFilterResponse {
  items: RecordsItem[];
  typing?: RecordsTyping;
}
