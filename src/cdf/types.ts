export type Datapoints = Items<Datapoint>;
export type Events = Items<Event>;

export interface Datapoint {
  id: number;
  externalId?: string;
  isStep: boolean;
  isString: boolean;
  unit?: string;
  datapoints: TimeSeriesDatapoint[] | TimeSeriesAggregateDatapoint[];
}

export interface TimeSeriesDatapoint {
  timestamp: number;
  value: string;
}

export interface TimeSeriesAggregateDatapoint {
  timestamp: number;
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

export interface CogniteEvent {
  id: number;
  lastUpdatedTime: string;
  createdTime: string;
  externalId?: string;
  startTime?: number;
  endTime?: number;
  dataSetId?: number;
  description?: string;
  type?: string;
  subtype?: string;
  assetIds?: number[];
  source?: string;
  sourceId?: string;
  metadata?: { [s: string]: string };
}

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
  activeAtTime?: TimeRange;
  assetIds?: CogniteInternalId[];
  assetExternalIds?: CogniteExternallId[];
  rootAssetIds?: IdEither[];
  source?: string;
  type?: string;
  subtype?: string;
}

export type EventsFilterTimeParams =
  | Pick<EventsFilterRequestParams, 'activeAtTime'>
  | Pick<EventsFilterRequestParams, 'startTime' | 'endTime'>;

export interface FilterRequest<Filter> extends Limit, Cursor {
  filter: Filter;
}

export interface Resource {
  id: number;
  externalId?: string;
  name?: string;
  description?: string;
}

export interface TimeSeriesResponseItem extends Resource {
  isString?: boolean;
  metadata?: Record<string, string>;
  unit?: string;
  assetId?: string;
  isStep: boolean;
  source?: string;
  sourceId?: string;
  createdTime: number;
  lastUpdatedTime: number;
  selected: boolean;
}

export type TimeSeriesResponse = Items<TimeSeriesResponseItem>;

export type Limit = {
  limit?: number;
};

export interface Cursor {
  cursor?: string;
}

export interface Metadata {
  [name: string]: string;
}

export type TimeRange = Range<number>;
export type CogniteInternalId = number;
export type CogniteExternallId = string;

export interface Timestamp {
  timestamp: number;
}

export type Items<T = any> = {
  items: T[];
};

export type IdEither =
  | {
      id: number;
    }
  | {
      externalId: string;
    };

export interface Range<T> {
  min?: T;
  max?: T;
}
