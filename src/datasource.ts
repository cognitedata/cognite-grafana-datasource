import * as dateMath from 'app/core/utils/datemath';

export interface TimeSeriesResponse {
  target: string,
  datapoints: [number, number][],
}

export interface QueryResponse {
  data: TimeSeriesResponse[]
}

export class MetricDescription {
  constructor(readonly text: string, readonly value: number) {
  }
}

export type MetricFindQueryResponse = MetricDescription[];

type HttpMethod = "POST" | "GET" | "PATCH" | "DELETE";

interface DataSourceRequestOptions {
  url: string,
  method: HttpMethod,
  retry?: number,
  requestId?: string,
  headers?: { [s: string]: string; },
  silent?: boolean,
  data?: any,
}

interface BackendService {
  get(url: string, params?: any);

  datasourceRequest(options: DataSourceRequestOptions);
}

interface TimeSeriesResponseItem {
  name: string,
  isString?: boolean,
  unit?: string,
  assetId?: string,
  isStep: boolean,
  description?: string,
  source?: string,
  sourceId?: string,
  id: number,
  createdTime: number,
  lastUpdatedTime: number,
}

export interface TimeSeriesResponse {
  data: {
    items: TimeSeriesResponseItem[]
  }
}

export interface QueryRange {
  from: string,
  to: string,
}

export interface QueryTarget {
  refId: string,
  target: string,
  aggregation: string,
}

export type QueryFormat = "json";

export interface QueryOptions {
  range: QueryRange,
  interval: string,
  targets: QueryTarget[],
  format: QueryFormat,
  maxDataPoints: number,
  intervalMs: number,
}

export interface TimeSeriesDatapoint {
  timestamp: number,
  value: string,
}

export interface Datapoint {
  name: string,
  datapoints: TimeSeriesDatapoint[]
}

export interface Datapoints {
  items: Datapoint[],
}

export interface DataDatapoints {
  data: Datapoints,
}

interface DataQueryRequestItem {
  name: string,
  start?: string | number,
  end?: string | number,
  limit?: number,
  granularity?: string,
  aggregates?: string,
}

interface DataQueryRequest {
  items: DataQueryRequestItem[],
  start: string | number,
  end: string | number,
  limit?: number,
  aggregates?: string,
  granularity?: string,
}

export default class CogniteDatasource {
  id: number;
  url: string;
  name: string;
  project: string;
  q: any;

  /** @ngInject */
  constructor(instanceSettings: any, private $q: any, private backendSrv: BackendService, private templateSrv: any) {
    this.id = instanceSettings.id;
    this.url = instanceSettings.url;
    this.project = instanceSettings.jsonData.cogniteProject;
    this.q = $q;
    this.name = instanceSettings.name;
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

  query(options: QueryOptions): Promise<QueryResponse> {
    if (options.targets.length === 0) {
      return Promise.resolve({data: []});
    }

    const timeFrom = Math.ceil(dateMath.parse(options.range.from));
    const timeTo = Math.ceil(dateMath.parse(options.range.to));
    const queries: DataQueryRequest[] = options.targets.map(target => {
      const query: DataQueryRequestItem = {
        name: target.target,
        granularity: this.intervalToGranularity(options.intervalMs),
      };
      if (target.aggregation && target.aggregation.length > 0) {
        query.aggregates = target.aggregation;
      }
      return {
        items: [query],
        start: timeFrom,
        end: timeTo,
        limit: 10_000,
        aggregation: query.aggregates,
      };
    });
    return Promise.all(queries.map(q => this.backendSrv.datasourceRequest(
      {
        url: this.url + `/cogniteapi/${this.project}/timeseries/dataquery`,
        method: "POST",
        data: q
      })))
      .then((timeseries: [{ data: DataDatapoints, config: { data: { aggregation: string } } }]) => ({
        data: timeseries
          .reduce((datapoints, response) => {
            const aggregation = response.config.data.aggregation;
            const aggregationPrefix = aggregation ? (aggregation + ' ') : '';
            return datapoints.concat(response.data.data.items.map(item => (
              {
                target: aggregationPrefix + item.name,
                datapoints: item.datapoints
                  .filter(d => d.timestamp >= timeFrom && d.timestamp <= timeTo)
                  .map(d => [d[response.config.data.aggregation || 'value'], d.timestamp])
              }
            )));
          }, [])
      }))
      .catch((r: any) => ({data: []}));
  }

  annotationQuery(options: any) {
    throw new Error("Annotation Support not implemented yet.");
  }

  metricFindQuery(query: string, options?: any): Promise<MetricFindQueryResponse> {
    if (query.length == 0) {
      return Promise.resolve([]);
    }
    return this.backendSrv.datasourceRequest({
      url: this.url + `/cogniteapi/${this.project}/timeseries?q=${query}`,
      method: "GET",
    }).then((result: { data: TimeSeriesResponse }) => {
      return result.data.data.items.map(timeSeriesResponseItem => (
        {
          text: timeSeriesResponseItem.name,
          value: timeSeriesResponseItem.name
        }
      ));
    });
  }

  testDatasource() {
    return this.backendSrv.datasourceRequest({
      url: this.url + "/cogniteloginstatus",
      method: "GET",
    }).then(response => {
      if (response.status === 200) {
        return {status: "success", message: "Your Cognite credentials are valid", title: "Success"};
      }
    });
  }
}
