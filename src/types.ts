// eslint-disable-next-line max-classes-per-file
import {
  DataQueryRequest,
  DataQuery as DataQueryUI,
  TimeSeries,
  DataQuery,
  DataSourceJsonData,
} from '@grafana/data';
import { TimeSeriesResponseItem, Datapoints, Items, IdEither, Limit } from './cdf/types';

export interface CogniteQuery extends DataQuery {
  target: number | ''; // Timeseries internal Id:
  aggregation: string;
  granularity: string;
  error: string;
  label: string;
  tab: Tab;
  assetQuery: AssetQuery;
  expr: string;
  warning: string;
}

export enum Tab {
  Timeseries = 'Timeseries',
  Asset = 'Asset',
  Custom = 'Custom',
  Template = 'Template',
}

export const defaultAssetQuery: AssetQuery = {
  includeSubtrees: false,
  target: '',
};

// TODO: Investigate if "type" property is required, it is currently not defined in MyQuery
// These defaults are extracted from the old queryCtrl.ts
export const defaultQuery: Partial<CogniteQuery> = {
  target: '',
  // type: 'timeserie',
  aggregation: 'average',
  granularity: '',
  label: '',
  tab: Tab.Timeseries,
  expr: '',
  assetQuery: {
    target: '',
    includeSubtrees: false,
  },
};

/**
 * These are options configured for each DataSource instance
 */

export interface CogniteDataSourceOptions extends DataSourceJsonData {
  cogniteApiUrl?: string;
  authType: string;
  defaultRegion: string;
  cogniteProject: string;
}

export interface MySecureJsonData {
  apiKey?: string;
}

/**
 * Value that is used in the backend, but never sent over HTTP to the frontend
 */
export function isError(maybeError: DataQueryError | any): maybeError is DataQueryError {
  return (<DataQueryError>maybeError).error !== undefined;
}

/**
 * Comes from grafana, could be imported in future releases hopefully
 * @param name – event name
 */
export const eventFactory = <T = undefined>(name: string): AppEvent<T> => {
  return { name };
};

export type QueryResponse = DataResponse<TimeSeries[]>;

export interface MetricDescription {
  readonly text: string;
  readonly value: number | string;
}

export type MetricFindQueryResponse = MetricDescription[];

export enum ParseType {
  Timeseries = 'Timeseries',
  Asset = 'Asset',
  Event = 'Event',
}

export interface AssetQuery {
  target: string;
  includeSubtrees: boolean;
  old?: AssetQuery;
  timeseries?: TimeSeriesResponseItem[];
  func?: string;
  templatedTarget?: string;
}

export interface InputQueryTarget extends DataQueryUI {
  target: number | '';
  aggregation: string;
  granularity: string;
  error: string;
  label: string;
  tab: Tab;
  assetQuery: AssetQuery;
  expr: string;
  warning: string;
  templateQuery: TemplateQuery;
}

export interface QueryTarget extends InputQueryTarget {
  target: number;
}

export type QueryFormat = 'json';

export type QueryOptions = DataQueryRequest<InputQueryTarget>;

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

export type QueriesData = {
  items: DataQueryRequestItem[];
  target: QueryTarget;
}[];

export type ResponseMetadata = { labels: string[]; target: QueryTarget };

export interface DataQueryAlias {
  alias: string;
  id: number;
  aggregate?: string;
  granularity?: string;
}

export type DataQueryRequestItem = {
  expression?: string;
  start?: string | number;
  end?: string | number;
  limit?: number;
  granularity?: string;
  aggregates?: string[];
  id?: number;
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

export interface AnnotationSearchQuery {
  description: string;
  type: string;
  subtype: string;
  minStartTime: number;
  maxStartTime: number;
  minEndTime: number;
  maxEndTime: number;
  minCreatedTime: number;
  maxCreatedTime: number;
  minLastUpdatedTime: number;
  maxLastUpdatedTime: number;
  // format is {"k1": "v1", "k2": "v2"}
  metadata: string;
  assetIds: number[];
  assetSubtrees: number[];
  sort: 'startTime' | 'endTime' | 'createdTime' | 'lastUpdatedTime';
  dir: 'asc' | 'desc';
  limit: number;
  offset: 0;
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

export interface QueryDatapointsWarning {
  refId: string;
  warning: string;
}

export interface TemplateQuery extends DataQuery {
  domain: string;
  domainVersion: number;
  queryText: string;
  dataPath: string;
  dataPointsPath: string;
  groupBy: string;
  aliasBy: string;
  annotationTitle: string;
  annotationText: string;
  annotationTags: string;
  constant: number;
}

export const defaultTemplateQuery: Partial<TemplateQuery> = {
  domain: undefined,
  domainVersion: undefined,
  queryText: `query {
      wellList {
        name,
        pressure {
          datapoints(start: $__from, end: $__to, limit: 50) {
            timestamp,
            value
          }
        }
      }
  }`,
  dataPath: 'data',
  dataPointsPath: '',
  groupBy: '',
  aliasBy: '',
  annotationTitle: '',
  annotationText: '',
  annotationTags: '',
  constant: 6.5,
};
