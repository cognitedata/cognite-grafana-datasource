import {
  DataQueryRequest,
  TimeSeries,
  DataSourceJsonData,
  TableData,
  DataFrame,
  QueryEditorProps,
  SelectableValue,
} from '@grafana/data';
import { DataQuery } from '@grafana/schema';
import { Datapoints, Items, IdEither, Limit } from './cdf/types';
import CogniteDatasource from './datasource';

export enum Tab {
  Timeseries = 'Timeseries',
  CogniteTimeSeriesSearch = 'CogniteTimeSeries',
  Asset = 'Asset',
  Custom = 'Custom',
  Event = 'Event',
  Relationships = 'Relationships',
  Templates = 'Templates',
  ExtractionPipelines = 'Extraction Pipelines',
  FlexibleDataModelling = 'Data Models',
  DataModellingV2 = 'Data Models V2',
}

export const TabTitles = {
  [Tab.Timeseries]: 'Time series search',
  [Tab.CogniteTimeSeriesSearch]: 'CogniteTimeSeries',
  [Tab.Asset]: 'Time series from asset',
  [Tab.Custom]: 'Time series custom query',
  [Tab.Event]: 'Events',
  [Tab.ExtractionPipelines]: 'Extraction Pipelines',
  [Tab.Relationships]: 'Relationships',
  [Tab.Templates]: 'Templates',
  [Tab.FlexibleDataModelling]: 'Data Models',
};
const defaultFlexibleDataModellingQuery: FlexibleDataModellingQuery = {
  externalId: '',
  graphQlQuery: `{
  listMachine {
    items {
      __typename
      MachineWeight
      Model
      Anomalies {
        externalId
        id
        name
        __typename
      }
      Availability {
        id
        name
        externalId
        __typename
      }
    }
  }
}`,
  tsKeys: [],
};

const defaultEventQuery: EventQuery = {
  expr: '',
  columns: ['externalId', 'type', 'subtype', 'description', 'startTime', 'endTime'],
  activeAtTimeRange: true,
  advancedFilter: ``,
  aggregate: {
    name: 'uniqueValues',
    properties: [],
    withAggregate: false,
  },
};

export const defaultRelationshipsQuery: RelationshipsQuery = {
  dataSetIds: [],
  labels: {
    containsAny: [],
  },
  isActiveAtTime: false,
  limit: 1000,
  depth: 1,
  sourceExternalIds: [],
  isTypeTimeseries: false,
};
const defaultAssetQuery: AssetQuery = {
  includeSubtrees: false,
  target: '',
  withRelationships: false,
  includeSubTimeseries: true,
  relationshipsQuery: defaultRelationshipsQuery,
};
export interface FlexibleDataModellingQuery {
  externalId: string;
  version?: string;
  space?: string;
  graphQlQuery: string;
  tsKeys: string[];
  labels?: string[];
  targets?: string[];
}

export interface CogniteTimeSeries {
  space: string;
  version: string;
  externalId: string;
  instanceId?: {
    space: string;
    externalId: string;
  };
}

export const defaultTemplateQuery: TemplateQuery = {
  groupExternalId: undefined,
  version: undefined,
  graphQlQuery: `{
  oEE_MachinesQuery {
    items {
      Facility
      Line
      GoodQuantity {
        datapoints (start: $__from, end: $__to, , limit: 100){
            value
            timestamp
        }
      }
    }
  }
}`,
  dataPath: 'oEE_MachinesQuery.items',
  datapointsPath: 'GoodQuantity.datapoints',
  groupBy: 'Facility',
};

export const defaultExtractionPipelinesQuery: ExtractionPipelinesQuery = {
  selections: [],
  getRuns: false,
  columns: [
    'name',
    'status',
    'lastUpdatedTime',
    'lastFailure',
    'lastSeen',
    'lastSuccess',
    'schedule',
    'data set',
    'message',
  ],
  limit: 1000,
};

export const defaultCogniteTimeSeries: CogniteTimeSeries = {
  space: 'cdf_cdm',
  version: 'v1',
  externalId: 'CogniteTimeSeries',
  instanceId: undefined,
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
  extractionPipelinesQuery: defaultExtractionPipelinesQuery,
  flexibleDataModellingQuery: defaultFlexibleDataModellingQuery,
  cogniteTimeSeries: defaultCogniteTimeSeries,
};

/**
 * These are options configured for each DataSource instance
 */

export interface CogniteDataSourceOptions extends DataSourceJsonData {
  cogniteApiUrl?: string;
  clusterUrl?: string;
  cogniteProject: string;
  defaultProject?: string;
  oauthPassThru?: boolean;
  oauthClientCreds?: boolean;
  oauthTokenUrl?: string;
  oauthClientId?: string;
  oauthScope?: string;
  // Master toggles for feature sections
  enableCoreDataModelFeatures?: boolean; // Master toggle for Core Data Model section
  enableLegacyDataModelFeatures?: boolean; // Master toggle for Legacy Data Model section
  // Core Data Model features
  // Note: These default to false (opt-in) since they are new features
  enableCogniteTimeSeries?: boolean;
  // Legacy data model features  
  // Note: These default to true for backward compatibility with existing configs
  enableTimeseriesSearch?: boolean;
  enableTimeseriesFromAsset?: boolean;
  enableTimeseriesCustomQuery?: boolean;
  enableEvents?: boolean;
  // Deprecated features
  // Note: enableRelationships defaults to true for backward compatibility,
  // others keep their original behavior (undefined = disabled by default)
  enableTemplates?: boolean;
  enableEventsAdvancedFiltering?: boolean;
  enableFlexibleDataModelling?: boolean;
  enableExtractionPipelines?: boolean;
  enableRelationships?: boolean;
  featureFlags: { [s: string]: boolean };
}

export interface CogniteSecureJsonData {
  oauthClientSecret?: string;
}

/**
 * Value that is used in the backend, but never sent over HTTP to the frontend
 */
export function isError(maybeError: DataQueryError | any): maybeError is DataQueryError {
  return (maybeError as DataQueryError).error !== undefined;
}

export type QueryResponse = DataResponse<Array<TimeSeries | TableData | DataFrame>>;

export interface MetricDescription {
  readonly text: string;
  readonly value: number | string;
}

export interface RelationshipsQuery {
  dataSetIds?: Array<{
    id: number;
    value?: string;
  }>;
  labels?: {
    containsAny: Array<{
      externalId: string;
      value?: string;
    }>;
  };
  isActiveAtTime?: boolean;
  activeAtTime?: {
    max: number;
    min: number;
  };
  sourceExternalIds?: string[];
  isTypeTimeseries: boolean;
  limit: number;
  depth?: number;
}
export interface AssetQuery {
  target: string;
  includeSubtrees: boolean;
  withRelationships?: boolean;
  includeSubTimeseries?: boolean;
  relationshipsQuery?: RelationshipsQuery;
}

export interface EventQueryAggregate {
  name: 'uniqueValues' | 'count';
  properties: Array<{ property?: string }>;
  withAggregate: boolean;
}

export type EventsOrderDirection = 'desc' | 'asc';

export type EventsOrderNulls = 'first' | 'last' | 'auto';

export interface EventQuerySortProp {
  property: string;
  order?: EventsOrderDirection;
  nulls?: EventsOrderNulls;
}

export interface EventQuery {
  expr: string;
  activeAtTimeRange?: boolean;
  columns?: string[];
  advancedFilter?: string;
  sort?: EventQuerySortProp[];
  aggregate?: EventQueryAggregate;
}
export interface ExtractionPipelinesQuery {
  selections: SelectableValue[];
  getRuns: boolean;
  columns?: string[];
  limit: number;
}
export type CogniteQuery = CogniteQueryBase & CogniteTargetObj;

export interface CogniteQueryBase extends DataQuery {
  aggregation: string;
  granularity: string;
  latestValue: boolean;
  error: string;
  label: string;
  tab: Tab;
  query?: string; // annotation events query
  assetQuery: AssetQuery;
  eventQuery: EventQuery;
  templateQuery: TemplateQuery;
  expr: string;
  warning: string;
  relationshipsQuery: RelationshipsQuery;
  extractionPipelinesQuery: ExtractionPipelinesQuery;
  flexibleDataModellingQuery: FlexibleDataModellingQuery;
  cogniteTimeSeries: CogniteTimeSeries;
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

  isOk = true;
  isErr = false;
}

export class Err<T, E> implements Result<T, E> {
  error: E;

  constructor(error: E) {
    this.error = error;
  }

  isOk = false;
  isErr = true;
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
  headers?: { [s: string]: string };
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
  instanceId?: {
    space: string;
    externalId: string;
  };
  timeZone?: string;
};

export type Aggregates = Pick<CDFDataQueryRequest, 'aggregates'>;
export type Granularity = Pick<CDFDataQueryRequest, 'granularity'>;
export type TimeZone = Pick<CDFDataQueryRequest, 'timeZone'>;

export interface CDFDataQueryRequest {
  items: DataQueryRequestItem[];
  start?: string | number;
  end?: string | number;
  limit?: number;
  aggregates?: string[];
  granularity?: string;
  timeZone?: string;
}

export interface DataResponse<T> {
  data: T;
}

export type CursorResponse<T> = DataResponse<Items<T> & { nextCursor?: string }>;

export type ItemsResponse<T = any> = DataResponse<{
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
  valueType?: {
    label: string;
    value: string;
  };
}

export interface AnnotationQueryData extends DataQuery {
  expr: string;
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

export interface FDMQueryResponse<T> {
  [x: string]: {
    edges?: Array<{ node?: T[] }>;
    items?: T[];
  };
}
export interface FDMResponse<T> {
  data: FDMQueryResponse<T>;
  errors?: any;
}
export type EditorProps = QueryEditorProps<
  CogniteDatasource,
  CogniteQuery,
  CogniteDataSourceOptions
>;
export type OnQueryChange = (
  patch: Partial<CogniteQueryBase> | CogniteTargetObj,
  shouldRunQuery?: boolean
) => void;
export type SelectedProps = Pick<EditorProps, 'query'> & { onQueryChange: OnQueryChange };
