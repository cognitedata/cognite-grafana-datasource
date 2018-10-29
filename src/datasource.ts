///<reference path="./grafana.d.ts" />
import * as dateMath from 'app/core/utils/datemath';

export interface TimeSeriesResponse {
  target: string;
  datapoints: Array<[number, number]>;
}

export interface QueryResponse {
  data: TimeSeriesResponse[];
}

export class MetricDescription {
  constructor(readonly text: string, readonly value: number) {}
}

export type MetricFindQueryResponse = MetricDescription[];

type HttpMethod = 'POST' | 'GET' | 'PATCH' | 'DELETE';

interface DataSourceRequestOptions {
  url: string;
  method: HttpMethod;
  retry?: number;
  requestId?: string;
  headers?: { [s: string]: string };
  silent?: boolean;
  data?: any;
}

interface BackendService {
  get(url: string, params?: any);

  datasourceRequest(options: DataSourceRequestOptions);
}

interface TimeSeriesResponseItem {
  name: string;
  isString?: boolean;
  unit?: string;
  assetId?: string;
  isStep: boolean;
  description?: string;
  source?: string;
  sourceId?: string;
  id: number;
  createdTime: number;
  lastUpdatedTime: number;
}

export interface TimeSeriesResponse {
  data: {
    items: TimeSeriesResponseItem[];
  };
}

export interface QueryRange {
  from: string;
  to: string;
}

export interface QueryTarget {
  refId: string;
  target: string;
  aggregation: string;
}

export type QueryFormat = 'json';

export interface QueryOptions {
  range: QueryRange;
  interval: string;
  targets: QueryTarget[];
  format: QueryFormat;
  maxDataPoints: number;
  intervalMs: number;
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

interface DataQueryRequestItem {
  name: string;
  start?: string | number;
  end?: string | number;
  limit?: number;
  granularity?: string;
  aggregates?: string;
}

interface DataQueryRequest {
  items: DataQueryRequestItem[];
  start: string | number;
  end: string | number;
  limit?: number;
  aggregates?: string;
  granularity?: string;
}

interface DataQueryRequestResponse {
  data: DataDatapoints;
  config: {
    data: {
      aggregation: string;
    };
  };
}

interface DataQueryError {
  error: {
    data: {
      error?: {
        message: string;
        notFound?: string[];
      };
    };
  };
}

interface Annotation {
  datasource: string;
  enable: boolean;
  hide: boolean;
  iconColor: string;
  limit: number;
  name: string;
  query_type?: string;
  query_subtype?: string;
  type: string;
  tags: string[];
}

interface AnnotationQueryOptions {
  range: QueryRange;
  rangeRaw: any;
  annotation: Annotation;
  dashboard: number;
}

interface AnnotationSearchQuery {
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
  assetSubTrees: number[];
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
  assetIds: [number];
  source: string;
  sourceId: string;
}

export interface Events {
  items: Event[];
}

export interface DataEvents {
  data: Events;
}

interface AnnotationQueryRequestResponse {
  data: DataEvents;
}

function isError(
  maybeError: DataQueryError | any
): maybeError is DataQueryError {
  return (maybeError as DataQueryError).error !== undefined;
}

export default class CogniteDatasource {
  public id: number;
  public url: string;
  public name: string;
  public project: string;
  public q: any;

  /** @ngInject */
  constructor(
    instanceSettings: any,
    private $q: any,
    private backendSrv: BackendService,
    private templateSrv: any
  ) {
    this.id = instanceSettings.id;
    this.url = instanceSettings.url;
    this.project = instanceSettings.jsonData.cogniteProject;
    this.q = $q;
    this.name = instanceSettings.name;
  }

  public query(options: QueryOptions): Promise<QueryResponse> {
    if (options.targets.length === 0) {
      return Promise.resolve({ data: [] });
    }

    const timeFrom = Math.ceil(dateMath.parse(options.range.from));
    const timeTo = Math.ceil(dateMath.parse(options.range.to));
    const queries: DataQueryRequest[] = options.targets.map(target => {
      const query: DataQueryRequestItem = {
        granularity: this.intervalToGranularity(options.intervalMs),
        name: target.target,
      };
      if (target.aggregation && target.aggregation.length > 0) {
        query.aggregates = target.aggregation;
      }
      return {
        aggregation: query.aggregates,
        end: timeTo,
        items: [query],
        limit: query.aggregates ? 10_000 : 100_000,
        start: timeFrom,
        // TODO: maxDataPoints is available, but seems to use unnecessarily low values.
        //       still looks ok for aggregates, so perhaps we should use it for those?
        // limit: options.maxDataPoints,
      };
    });

    const queryRequests = queries.map(q =>
      this.backendSrv
        .datasourceRequest({
          data: q,
          method: 'POST',
          url: this.url + `/cogniteapi/${this.project}/timeseries/dataquery`,
        })
        .catch(error => {
          return { error };
        })
    );
    return Promise.all(queryRequests)
      .catch(() => queryRequests) // ignore errors
      .then((timeseries: [DataQueryRequestResponse | DataQueryError]) => {
        const errors = timeseries.filter(isError);
        // TODO: report errors, ignore the code below for now
        if (errors.length === -1) {
          errors.forEach(err => {
            if (err.error.data && err.error.data.error) {
              throw {
                error: err.error.data.error,
                message: 'boom',
              };
            }
          });
        } else {
          return {
            data: timeseries.reduce((datapoints, response) => {
              if (isError(response)) {
                return datapoints;
              }
              const aggregation = response.config.data.aggregation;
              const aggregationPrefix = aggregation ? aggregation + ' ' : '';
              return datapoints.concat(
                response.data.data.items.map(item => ({
                  datapoints: item.datapoints
                    .filter(
                      d => d.timestamp >= timeFrom && d.timestamp <= timeTo
                    )
                    .map(d => [
                      d[response.config.data.aggregation || 'value'],
                      d.timestamp,
                    ]),
                  target: aggregationPrefix + item.name,
                }))
              );
            }, []),
          };
        }
      })
      .catch(() => ({ data: [] }));
  }

  public annotationQuery(options: AnnotationQueryOptions) {
    const { range, annotation } = options;
    const { query_type, query_subtype } = annotation;
    const startTime = Math.ceil(dateMath.parse(range.from));
    const endTime = Math.ceil(dateMath.parse(range.to));
    const searchRequest: Partial<AnnotationSearchQuery> = {
      maxEndTime: +endTime,
      minStartTime: +startTime,
      subtype: query_subtype,
      type: query_type,
    };
    return this.backendSrv
      .datasourceRequest({
        method: 'GET',
        url:
          this.url +
          `/cogniteapi/${this.project}/events/search?${Object.keys(
            searchRequest
          )
            .filter(k => searchRequest[k] !== undefined)
            .map(k => `${k}=${searchRequest[k]}`)
            .join('&')}`,
      })
      .then((result: AnnotationQueryRequestResponse) => {
        return result.data.data.items.map(event => ({
          annotation,
          isRegion: true,
          text: event.description,
          time: event.startTime,
          timeEnd: event.endTime,
          title: event.type,
        }));
      });
  }

  public metricFindQuery(query: string): Promise<MetricFindQueryResponse> {
    if (query.length === 0) {
      return Promise.resolve([]);
    }
    return this.backendSrv
      .datasourceRequest({
        method: 'GET',
        url: this.url + `/cogniteapi/${this.project}/timeseries?q=${query}`,
      })
      .then((result: { data: TimeSeriesResponse }) =>
        result.data.data.items.map(timeSeriesResponseItem => ({
          text: timeSeriesResponseItem.name,
          value: timeSeriesResponseItem.name,
        }))
      );
  }

  public testDatasource() {
    return this.backendSrv
      .datasourceRequest({
        method: 'GET',
        url: this.url + '/cogniteloginstatus',
      })
      .then(response => {
        if (response.status === 200) {
          return {
            message: 'Your Cognite credentials are valid',
            status: 'success',
            title: 'Success',
          };
        }
      });
  }

  private intervalToGranularity(intervalMs: number): string {
    const seconds = Math.round(intervalMs / 1000.0);
    if (seconds <= 60) {
      if (seconds <= 1) {
        return '1s';
      } else {
        return seconds + 's';
      }
    }
    const minutes = Math.round(intervalMs / 1000.0 / 60.0);
    if (minutes < 60) {
      return minutes + 'm';
    }
    const hours = Math.round(intervalMs / 1000.0 / 60.0 / 60.0);
    if (hours <= 24) {
      return hours + 'h';
    }
    const days = Math.round(intervalMs / 1000.0 / 60.0 / 60.0 / 24.0);
    return days + 'd';
  }
}
