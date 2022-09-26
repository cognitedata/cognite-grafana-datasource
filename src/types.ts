// eslint-disable-next-line max-classes-per-file
import {
  DataQueryRequest,
  TimeSeries,
  DataQuery,
  DataSourceJsonData,
  TableData,
  MutableDataFrame,
  QueryEditorProps,
  SelectableValue,
} from '@grafana/data';
import { Datapoints, Items, IdEither, Limit } from './cdf/types';
import CogniteDatasource from './datasource';

export enum Tab {
  Timeseries = 'Timeseries',
  Asset = 'Asset',
  Custom = 'Custom',
  Event = 'Event',
  Relationships = 'Relationships',
  Templates = 'Templates',
  ExtractionPipelines = 'Extraction Pipelines',
  FlexibleDataModelling = 'Flexible Data Modelling',
}

export const TabTitles = {
  [Tab.Timeseries]: 'Time series search',
  [Tab.Asset]: 'Time series from asset',
  [Tab.Custom]: 'Time series custom query',
  [Tab.Event]: 'Events',
  [Tab.ExtractionPipelines]: 'Extraction Pipelines',
  [Tab.Relationships]: 'Relationships',
  [Tab.Templates]: 'Templates',
  [Tab.FlexibleDataModelling]: 'Flexible Data Modelling',
};
const defaultFlexibleDataModellingQuery: FlexibleDataModellingQuery = {
  externalId: '',
  graphQlQuery: `{
  listMachine {
    edges {
      node {
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
  sourceExternalIds: [],
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
  version?: number;
  graphQlQuery: string;
  tsKeys: string[];
  labels?: string[];
  targets?: string[];
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
    'data Set',
    'message',
  ],
  limit: 1000,
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
  enableTemplates?: boolean;
  enableEventsAdvancedFiltering?: boolean;
  enableFlexibleDataModelling?: boolean;
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
export interface AssetQuery {
  target: string;
  includeSubtrees: boolean;
  withRelationships?: boolean;
  includeSubTimeseries?: boolean;
  relationshipsQuery?: RelationshipsQuery;
}

export interface EventQuery {
  expr: string;
  activeAtTimeRange: boolean;
  columns: string[];
  advancedFilter: string;
  aggregate?: {
    name: 'uniqueValues' | 'count';
    properties: { property?: string }[];
    withAggregate: boolean;
  };
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
  assetQuery: AssetQuery;
  eventQuery: EventQuery;
  templateQuery: TemplateQuery;
  expr: string;
  warning: string;
  relationshipsQuery: RelationshipsQuery;
  extractionPipelinesQuery: ExtractionPipelinesQuery;
  flexibleDataModellingQuery: FlexibleDataModellingQuery;
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

export interface FDMQueryResponse {
  [x: string]: {
    edges?: { node?: { [x: string]: any } }[];
  };
}
export interface FDMResponse {
  data: FDMQueryResponse;
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
