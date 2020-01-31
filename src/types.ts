import {
  DataQueryOptions,
  DataQuery,
  TimeSeries,
  TimeRange,
  RawTimeRange,
  DataSourceSettings,
} from '@grafana/ui';

export type QueryResponse = DataResponse<TimeSeries[]>;

export interface MetricDescription {
  readonly text: string;
  readonly value: number | string;
}

export type MetricFindQueryResponse = MetricDescription[];

export enum Tab {
  Timeseries = 'Timeseries',
  Asset = 'Asset',
  Custom = 'Custom',
}

export enum ParseType {
  Timeseries = 'Timeseries',
  Asset = 'Asset',
  Event = 'Event',
}

export interface TimeSeriesResponseItem {
  id: number;
  externalId?: string;
  name?: string;
  isString?: boolean;
  metadata?: object;
  unit?: string;
  assetId?: string;
  isStep: boolean;
  description?: string;
  source?: string;
  sourceId?: string;
  createdTime: number;
  lastUpdatedTime: number;
  selected: boolean;
}

export type TimeSeriesResponse = Items<TimeSeriesResponseItem>;

export interface AssetQuery {
  target: string;
  includeSubtrees: boolean;
  old?: AssetQuery;
  timeseries?: TimeSeriesResponseItem[];
  func?: string;
  templatedTarget?: string;
}

export interface QueryTarget extends DataQuery {
  target: string;
  aggregation: string;
  granularity: string;
  error: string;
  label: string;
  tab: Tab;
  assetQuery: AssetQuery;
  expr: string;
  warning: string;
}

export type QueryFormat = 'json';

export type QueryOptions = DataQueryOptions<QueryTarget>;

export type Tuple<T> = [T, T];

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
  data?: object;
}

export interface Timestamp {
  timestamp: number;
}

export type MetaResponses = Responses<ResponseMetadata, DataQueryRequestResponse>;

export type SuccessResponse<Metadata, Response> = { metadata: Metadata; result: Response };
export type FailResponse<Metadata> = { metadata: Metadata; error: any };
export type Responses<Metadata, Response> = {
  failed: FailResponse<Metadata>[];
  succeded: SuccessResponse<Metadata, Response>[];
};

export interface TimeSeriesDatapoint extends Timestamp {
  value: string;
}

export interface TimeSeriesAggregateDatapoint extends Timestamp {
  average?: number;
  max?: number;
  min?: number;
  count?: number;
  sum?: number;
  interpolation?: number;
  stepInterpolation?: number;
  continuousVariance?: number;
  discreteVariance?: number;
  totalVariation?: number;
}

export interface Datapoint {
  id: number;
  externalId?: string;
  isStep: boolean;
  isString: boolean;
  unit?: string;
  datapoints: TimeSeriesDatapoint[] | TimeSeriesAggregateDatapoint[];
}

export type Datapoints = Items<Datapoint>;

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
  playground?: boolean;
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

export function isError(maybeError: DataQueryError | any): maybeError is DataQueryError {
  return (<DataQueryError>maybeError).error !== undefined;
}

export interface DataQueryAlias {
  alias: string;
  id: number;
  aggregate?: string;
  granularity?: string;
}

export type IdEither =
  | {
      id: number;
    }
  | {
      externalId: string;
    };

export type DataQueryRequestItem = {
  expression?: string;
  start?: string | number;
  end?: string | number;
  limit?: number;
  granularity?: string;
  aggregates?: string[];
  externalId: string;
};

export type Aggregates = Pick<DataQueryRequest, 'aggregates'>;
export type Granularity = Pick<DataQueryRequest, 'granularity'>;

export interface DataQueryRequest {
  items: DataQueryRequestItem[];
  start?: string | number;
  end?: string | number;
  limit?: number;
  aggregates?: string[];
  granularity?: string;
}

export interface Annotation {
  datasource: string;
  enable: boolean;
  hide: boolean;
  iconColor: string;
  limit: number;
  name: string;
  expr: string;
  filter: string;
  error: string;
  type: string;
  tags: string[];
}

export interface AnnotationQueryOptions {
  range: TimeRange;
  rangeRaw: RawTimeRange;
  annotation: Annotation;
  dashboard: number;
}

export interface AnnotationResponse {
  annotation: Annotation;
  title: string;
  time: number;
  timeEnd?: number;
  text: string;
  tags?: string[];
  isRegion?: boolean;
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

export interface Event {
  id: number;
  startTime: number;
  endTime: number;
  description: string;
  type: string;
  subtype: string;
  assetIds: number[];
  source: string;
  sourceId: string;
}

export type Events = Items<Event>;

export type DataEvents = DataResponse<Events>;

export type AnnotationQueryRequestResponse = DataResponse<DataEvents>;

export interface DataResponse<T> {
  data: T;
}

export type Items<T = object> = {
  items: T[];
};

export type Response<T = object> = DataResponse<{
  items: T[];
}>;

// todo: FIX THIS TYPE
export type TimeseriesFilterQuery =
  | {
      description?: string;
      limit?: number;
      filter?: {
        assetSubtreeIds?: IdEither[];
        assetIds?: string[];
      };
      includeMetadata?: boolean;
    }
  | { items: [IdEither] };

export interface VariableQueryData {
  query: string;
  filter: string;
}

export interface VariableQueryProps {
  query: any;
  onChange: (query: any, definition: string) => void;
  datasource: any;
  templateSrv: any;
}

export interface CogniteDataSourceSettings extends DataSourceSettings {
  jsonData: {
    authType: string;
    defaultRegion: string;
    cogniteProject: string;
  };
}

export enum FilterType {
  RegexNotEquals = '!~',
  RegexEquals = '=~',
  NotEquals = '!=',
  Equals = '=',
}

export interface Filter {
  property: string;
  value: string;
  type: FilterType;
}

export interface FilterOptions {
  filters: Filter[];
  granularity: string;
  aggregation: string;
}
