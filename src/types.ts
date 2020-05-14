import {
  DataQueryOptions,
  DataQuery,
  TimeSeries,
  TimeRange as GrafanaTimeRange,
  DataSourceSettings,
} from '@grafana/ui';

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

export interface InputQueryTarget extends DataQuery {
  target: number | '';
  aggregation: string;
  granularity: string;
  error: string;
  label: string;
  tab: Tab;
  assetQuery: AssetQuery;
  expr: string;
  warning: string;
}

export interface QueryTarget extends InputQueryTarget {
  target: number;
}

export type QueryFormat = 'json';

export type QueryOptions = DataQueryOptions<InputQueryTarget>;

export type Tuple<T> = [T, T];

export interface Range<T> {
  min?: T;
  max?: T;
}

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
  id?: number;
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
  query: string;
  filter: string;
  error: string;
  type: string;
  tags: string[];
}

export interface AnnotationQueryOptions {
  range: GrafanaTimeRange;
  rangeRaw: GrafanaTimeRange;
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

export type CursorResponse<T> = DataResponse<Items<T> & { nextCursor?: string }>;

export type Response<T = object> = DataResponse<{
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

export type Limit = {
  limit?: number;
};

export interface Cursor {
  cursor?: string;
}

export interface VariableQueryData {
  query: string;
  error?: string;
}

export interface VariableQueryProps {
  query: string;
  onChange: (query: VariableQueryData) => void;
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

export interface Metadata {
  [name: string]: string;
}

export type TimeRange = Range<number>;
export type CogniteInternalId = number;
export type CogniteExternallId = string;

export interface FilterRequestParams {
  metadata?: Metadata;
  assetSubtreeIds?: IdEither[];
  createdTime?: TimeRange;
  lastUpdatedTime?: TimeRange;
  externalIdPrefix?: string;
}

export interface AssetsFilterRequestParams extends FilterRequestParams {
  name?: string;
  parentIds?: CogniteInternalId[];
  parentExternalIds?: CogniteExternallId[];
  rootIds?: IdEither[];
  source?: string;
  root?: boolean;
}

export interface TimeseriesFilterRequestParams extends FilterRequestParams {
  name?: string;
  unit?: string;
  isString?: boolean;
  isStep?: boolean;
  assetIds?: CogniteInternalId[];
  assetExternalIds?: CogniteExternallId[];
  rootAssetIds?: IdEither[];
}

export interface EventsFilterRequestParams extends FilterRequestParams {
  startTime?: TimeRange;
  endTime?: TimeRange;
  assetIds?: CogniteInternalId[];
  assetExternalIds?: CogniteExternallId[];
  rootAssetIds?: IdEither[];
  source?: string;
  type?: string;
  subtype?: string;
}

export interface FilterRequest<Filter> extends Limit, Cursor {
  filter: Filter;
}

export interface QueryRequestError {
  refId: string;
  error: string;
}

export interface QueryDatapointsLimitWarning {
  refId: string;
  warning: string;
}
