// DMS API types
export interface DMSSpace {
  space: string;
  name?: string;
  description?: string;
  createdTime: number;
  lastUpdatedTime: number;
}

export interface DMSView {
  space: string;
  externalId: string;
  version: string;
  name?: string;
  description?: string;
  createdTime: number;
  lastUpdatedTime: number;
}

export interface DMSInstanceId {
  space: string;
  externalId: string;
}

export interface DMSFilter {
  and?: DMSFilter[];
  or?: DMSFilter[];
  not?: DMSFilter;
  equals?: {
    property: string[];
    value: any;
  };
  in?: {
    property: string[];
    values: any[];
  };
  range?: {
    property: string[];
    gte?: any;
    gt?: any;
    lte?: any;
    lt?: any;
  };
  inSpace?: string;
}

/**
 * How multiple search terms combine. 'OR' (the API default) matches an instance
 * carrying any one term; 'AND' requires all of them, across the searched fields.
 */
export type DMSSearchOperator = 'AND' | 'OR';

export interface DMSSearchRequest {
  view: {
    type: 'view';
    space: string;
    externalId: string;
    version: string;
  };
  query?: string;
  filter?: DMSFilter;
  limit?: number;
  properties?: string[];
  operator?: DMSSearchOperator;
}

export interface DMSSearchResponse {
  items: DMSInstance[];
}

export interface DMSInstance {
  instanceType: 'node' | 'edge';
  space: string;
  externalId: string;
  version: number;
  lastUpdatedTime: number;
  createdTime: number;
  deletedTime?: number;
  properties?: {
    [space: string]: {
      [view: string]: {
        [property: string]: any;
      };
    };
  };
}

export interface DMSListRequest {
  sources: Array<{
    source: {
      type: 'view';
      space: string;
      externalId: string;
      version: string;
    };
  }>;
  instanceType?: 'node' | 'edge';
  limit?: number;
  cursor?: string;
  filter?: DMSFilter;
}

export interface DMSListResponse {
  items: DMSInstance[];
  nextCursor?: string;
}

export interface CogniteUnit {
  space: string;
  externalId: string;
  name: string;
  description?: string;
  symbol?: string;
  quantity?: string;
  source?: string;
  sourceReference?: string;
}

export interface DMSViewProperty {
  type: { type: string; list?: boolean };
  nullable?: boolean;
  immutable?: boolean;
  description?: string;
  name?: string;
}

export interface DMSViewWithProperties {
  space: string;
  externalId: string;
  version: string;
  properties?: Record<string, DMSViewProperty>;
}

/** A reference to a data modelling view. */
export interface ViewRef {
  space: string;
  externalId: string;
  version: string;
}

// Container inspect API types
export type InvolvedView = ViewRef;

export interface ContainerInspectResponse {
  items: Array<{
    space: string;
    externalId: string;
    inspectionResults: {
      involvedViews: InvolvedView[];
    };
  }>;
}

// CogniteActivity interface based on Core Data Model
export interface CogniteActivity {
  space: string;
  externalId: string;
  version?: number;
  lastUpdatedTime?: number;
  createdTime?: number;
  name?: string;
  description?: string;
  // Actual time fields (ISO strings from DMS API)
  startTime?: string;
  endTime?: string;
  // Scheduled time fields (ISO strings from DMS API)
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  // Additional metadata
  type?: string;
  [key: string]: any; // Allow additional properties from DMS
}
