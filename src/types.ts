import { DataQuery, DataSourceJsonData, DataQueryRequest } from '@grafana/ui';

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

export interface QueryResponse {
  data: any;
}

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
  name: string;
  isString?: boolean;
  metadata?: object;
  unit?: string;
  assetId?: string;
  isStep: boolean;
  description?: string;
  source?: string;
  sourceId?: string;
  id: number;
  createdTime: number;
  lastUpdatedTime: number;
  selected: boolean;
}

export interface TimeSeriesResponse {
  data: {
    items: TimeSeriesResponseItem[];
  };
}

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
  filter?: string;
}

export type QueryFormat = 'json';

export type QueryOptions = DataQueryRequest<QueryTarget>;

export type HttpMethod = 'POST' | 'GET' | 'PATCH' | 'DELETE';

export interface CogniteDataSourceRequestOptions {
  url: string;
  method: HttpMethod;
  retry?: number;
  requestId?: string;
  headers?: { [s: string]: string };
  silent?: boolean;
  data?: CogniteDataQueryRequest;
}

export interface TimeSeriesDatapoint {
  timestamp: number;
  value: string;
}

export interface Datapoint {
  name: string;
  datapoints: TimeSeriesDatapoint[];
}

export interface Datapoints {
  items: Datapoint[];
}

export interface DataDatapoints {
  data: Datapoints;
}

export interface CogniteDataQueryRequestResponse {
  data: DataDatapoints;
  config: {
    data: {
      aggregates: string;
      limit: number;
    };
  };
}

export type CogniteDataQueryError = {
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

export function isError(maybeError: CogniteDataQueryError | any): maybeError is CogniteDataQueryError {
  return (maybeError as CogniteDataQueryError).error !== undefined;
}

export interface DataQueryAlias {
  alias: string;
  id: number;
  aggregate?: string;
  granularity?: string;
}

export interface CogniteDataQueryRequestItem {
  name: string;
  start?: string | number;
  end?: string | number;
  limit?: number;
  granularity?: string;
  aggregates?: string;
  function?: string;
  aliases?: DataQueryAlias[];
}

export interface CogniteDataQueryRequest {
  items: CogniteDataQueryRequestItem[];
  start: string | number;
  end: string | number;
  limit?: number;
  aggregates?: string;
  granularity?: string;
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

export interface Events {
  items: Event[];
}

export interface DataEvents {
  data: Events;
}

export interface AnnotationQueryRequestResponse {
  data: DataEvents;
}

export interface TimeseriesSearchQuery {
  q: string;
  description: string;
  limit: number;
  includeMetadata: boolean;
  path: string[];
  assetId: string;
}

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

export interface CogniteOptions extends DataSourceJsonData {
  cogniteProject: string;
  // copied from prometheus datasource, not sure if useful?
  timeInterval?: string;
  queryTimeout?: string;
  httpMethod?: string;
  directUrl?: string;
}

export enum FilterType {
  Equals = '=',
  NotEquals = '!=',
  RegexEquals = '=~',
  RegexNotEquals = '!~',
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
  error: string;
}
