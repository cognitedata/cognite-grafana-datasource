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
}

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
