// eslint-disable-next-line max-classes-per-file
import {
  DataQueryRequest,
  TimeSeries,
  DataQuery,
  DataSourceJsonData,
  TableData,
  MutableDataFrame,
} from '@grafana/data';
import { Datapoints, Items, IdEither, Limit } from './cdf/types';

export enum Tab {
  Timeseries = 'Timeseries',
  Asset = 'Asset',
  Custom = 'Custom',
  Event = 'Event',
  Relationships = 'Relationships',
  Templates = 'Templates',
}

export const TabTitles = {
  [Tab.Timeseries]: 'Time series search',
  [Tab.Asset]: 'Time series from asset',
  [Tab.Custom]: 'Time series custom query',
  [Tab.Event]: 'Events',
  [Tab.Relationships]: 'Relationships',
  [Tab.Templates]: 'Templates',
};

const defaultAssetQuery: AssetQuery = {
  includeSubtrees: false,
  target: '',
};

const defaultEventQuery: EventQuery = {
  expr: '',
  columns: ['externalId', 'type', 'subtype', 'description', 'startTime', 'endTime'],
  activeAtTimeRange: true,
  eventQuery: `
{
  "and": [
    {
      "or": [
        {
          "equals": {
            "property": [
              "type"
            ],
            "value": "foobar"
          }
        },
        {
          "prefix": {
            "property": [
              "externalId"
            ],
            "value": "hello"
          }
        }
      ]
    },
    {
      "not": {
        "range": {
          "property": [
            "startTime"
          ],
          "gte": 0,
          "lte": 100
        }
      }
    },
    {
      "in": {
        "property": [
          "metadata",
          "metadata_D"
        ],
        "values": [
          "hello",
          "world"
        ]
      }
    }
  ]
}
  `,
};

export const defaultRelationshipsQuery: RelationshipsQuery = {
  dataSetIds: [],
  labels: {
    containsAny: [],
  },
  isActiveAtTime: false,
  limit: 1000,
};
export interface RelationshipsSelectableValue {
  value?: string | number;
  label?: string;
}

export interface RelationshipsQuery {
  dataSetIds?: {
    id: number;
    value?: string;
  }[];
  labels?: {
    containsAny: {
      externalId: string;
      value?: string;
    }[];
  };
  isActiveAtTime?: boolean;
  activeAtTime?: {
    max: number;
    min: number;
  };
  sourceExternalIds?: string[];
  targetTypes?: string[];
  limit: number;
}
export const defaultTemplateQuery: TemplateQuery = {
  groupExternalId: undefined,
  version: undefined,
  graphQlQuery: `
query {
  wellQuery {
    items {
      name,
      pressure {
        datapoints(start: $__from, end: $__to, limit: 50) {
          timestamp,
          value
        }
      }
    }
  }
}`,
  dataPath: 'wellQuery.items',
  datapointsPath: 'pressure.datapoints',
  groupBy: 'name',
};

export const defaultQuery: Partial<CogniteQuery> = {
  target: '',
  latestValue: false,
  aggregation: 'average',
  granularity: '',
  label: '',
  tab: Tab.Timeseries,
  expr: '',
  assetQuery: defaultAssetQuery,
  eventQuery: defaultEventQuery,
  relationshipsQuery: defaultRelationshipsQuery,
  templateQuery: defaultTemplateQuery,
};

/**
 * These are options configured for each DataSource instance
 */

export interface CogniteDataSourceOptions extends DataSourceJsonData {
  cogniteApiUrl?: string;
  cogniteProject: string;
  oauthPassThru?: boolean;
  oauthClientCreds?: boolean;
  oauthTokenUrl?: string;
  oauthClientId?: string;
  oauthScope?: string;
  enableTemplates?: boolean;
  featureFlags: { [s: string]: boolean };
}

export interface CogniteSecureJsonData {
  cogniteDataPlatformApiKey?: string;
  oauthClientSecret?: string;
}

/**
 * Value that is used in the backend, but never sent over HTTP to the frontend
 */
export function isError(maybeError: DataQueryError | any): maybeError is DataQueryError {
  return (<DataQueryError>maybeError).error !== undefined;
}

export type QueryResponse = DataResponse<(TimeSeries | TableData | MutableDataFrame)[]>;

export interface MetricDescription {
  readonly text: string;
  readonly value: number | string;
}

export interface AssetQuery {
  target: string;
  includeSubtrees: boolean;
}

export interface EventQuery {
  expr: string;
  activeAtTimeRange: boolean;
  columns: string[];
  eventQuery: string;
}

export type CogniteQuery = CogniteQueryBase & CogniteTargetObj;

export interface CogniteQueryBase extends DataQuery {
  aggregation: string;
  granularity: string;
  latestValue: boolean;
  error: string;
  label: string;
  tab: Tab;
  assetQuery: AssetQuery;
  eventQuery: EventQuery;
  templateQuery: TemplateQuery;
  expr: string;
  warning: string;
  relationshipsQuery: RelationshipsQuery;
}

export type TemplateQuery = {
  groupExternalId: string;
  version: number;
  graphQlQuery: string;
  groupBy: string;
  datapointsPath: string;
  dataPath: string;
};

export type CogniteTargetObj =
  | {
      target?: number;
      targetRefType?: 'id';
    }
  | {
      target?: string;
      targetRefType?: 'externalId';
    };

export type QueryTarget = CogniteQuery;

export type QueryOptions = DataQueryRequest<CogniteQuery>;

export type Tuple<T> = [T, T];

/**
 * Comes from grafana, could be imported in future releases hopefully
 */
export interface AppEvent<T> {
  readonly name: string;
  payload?: T;
}

export enum HttpMethod {
  POST = 'POST',
  GET = 'GET',
  PATCH = 'PATCH',
  DELETE = 'DELETE',
}

export interface DataSourceRequestOptions {
  url: string;
  method: HttpMethod;
  retry?: number;
  requestId?: string;
  headers?: { [s: string]: string };
  silent?: boolean;
  data?: any;
}

export type SuccessResponse = {
  metadata: ResponseMetadata;
  result: DataQueryRequestResponse;
};

export type FailResponse = {
  metadata: ResponseMetadata;
  error: any;
};

export abstract class Result<T, E> {
  abstract isOk: boolean;
  abstract isErr: boolean;
}
export class Ok<T, E> implements Result<T, E> {
  value: T;

  constructor(v: T) {
    this.value = v;
  }

  isOk: boolean = true;
  isErr: boolean = false;
}

export class Err<T, E> implements Result<T, E> {
  error: E;

  constructor(error: E) {
    this.error = error;
  }

  isOk: boolean = false;
  isErr: boolean = true;
}

export type Responses<T, U> = {
  succeded: T[];
  failed: U[];
};

export interface DataQueryRequestResponse extends DataResponse<Datapoints> {
  config: {
    data: {
      aggregates: string;
      limit: number;
    };
  };
}

export interface RequestParams<DataType = any> {
  path: string;
  data: DataType;
  method: HttpMethod;
  params?: { [s: string]: any };
  requestId?: string;
  cacheTime?: string;
}

export type DataQueryError = {
  error: {
    cancelled?: boolean;
    data: {
      error?: {
        message: string;
        notFound?: string[];
      };
    };
    status: number;
  };
};

export type DataQueryRequestType = 'data' | 'latest' | 'synthetic';

export type QueriesDataItem = {
  type: DataQueryRequestType;
  items: DataQueryRequestItem[];
  target: QueryTarget;
};

export type ResponseMetadata = {
  labels: string[];
  target: QueryTarget;
  type: DataQueryRequestType;
};

export type DataQueryRequestItem = {
  expression?: string;
  start?: string | number;
  end?: string | number;
  before?: string | number;
  limit?: number;
  granularity?: string;
  aggregates?: string[];
  id?: number;
  externalId?: string;
};

export type Aggregates = Pick<CDFDataQueryRequest, 'aggregates'>;
export type Granularity = Pick<CDFDataQueryRequest, 'granularity'>;

export interface CDFDataQueryRequest {
  items: DataQueryRequestItem[];
  start?: string | number;
  end?: string | number;
  limit?: number;
  aggregates?: string[];
  granularity?: string;
}

export interface CogniteAnnotationQuery extends DataQuery {
  query?: string;
  error?: string;
}

export interface DataResponse<T> {
  data: T;
}

export type CursorResponse<T> = DataResponse<Items<T> & { nextCursor?: string }>;

export type Response<T = any> = DataResponse<{
  items: T[];
}>;

export type TimeseriesFilterQuery = {
  filter?: {
    description?: string;
    assetSubtreeIds?: IdEither[];
    assetIds?: string[];
    [s: string]: any; // so we auto-support next features
  };
  cursor?: string;
} & Limit;

export interface VariableQueryData {
  query: string;
  error?: string;
}

export interface VariableQueryProps {
  query: string;
  onChange: (query: VariableQueryData, description: string) => void;
  datasource: any;
  templateSrv: any;
}

export interface QueryRequestError {
  refId: string;
  error: string;
}

export interface QueryWarning {
  refId: string;
  warning: string;
}
