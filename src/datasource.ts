///<reference path="./grafana.d.ts" />
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
  granularity: string,
  error: string,
  hide: boolean,
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

interface DataQueryRequestResponse {
  data: DataDatapoints,
  config: {
    data: {
      aggregation: string
    }
  }
}

type DataQueryError = {
  error: {
    data: {
      error?: {
        message: string,
        notFound?: string[],
      }
    }
    status: number
  }
};

function isError(maybeError: DataQueryError | any): maybeError is DataQueryError {
  return (<DataQueryError>maybeError).error !== undefined;
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
    const queryTargets : QueryTarget[] = options.targets.reduce((targets, target) => {
      target.error = "";
      if (target.hide) {
        return targets;
      }
      return targets.concat(target);
    }, []);

    if (queryTargets.length === 0) {
      return Promise.resolve({data: []});
    }

    const timeFrom = Math.ceil(dateMath.parse(options.range.from));
    const timeTo = Math.ceil(dateMath.parse(options.range.to));
    const queries: DataQueryRequest[] = queryTargets.map(target => {
      const query: DataQueryRequestItem = {
        name: target.target,
      };
      if (target.aggregation && target.aggregation.length > 0 && target.aggregation !== "none") {
        query.aggregates = target.aggregation;
      } else {
        target.granularity = "";
      }
      if (target.granularity == "") {
        query.granularity = this.intervalToGranularity(options.intervalMs);
      } else {
        query.granularity = target.granularity;
      }
      return {
        items: [query],
        start: timeFrom,
        end: timeTo,
        // TODO: maxDataPoints is available, but seems to use unnecessarily low values.
        //       still looks ok for aggregates, so perhaps we should use it for those?
        //limit: options.maxDataPoints,
        limit: query.aggregates ? 10_000 : 100_000,
        aggregation: query.aggregates,
      };
    });

    const queryRequests = queries.map(q => this.backendSrv.datasourceRequest(
      {
        url: this.url + `/cogniteapi/${this.project}/timeseries/dataquery`,
        method: "POST",
        data: q
      })
      .catch(error => { return ({ error: error }) }) );
    return Promise.all(queryRequests)
      .catch(() => queryRequests) // ignore errors
      .then((timeseries: [DataQueryRequestResponse | DataQueryError]) => {
        const errors = timeseries.filter(isError);
        return {
          data: timeseries
            .reduce((datapoints, response, i) => {
              if (isError(response)) {
                let errmsg:string;
                if (response.error.data && response.error.data.error) {
                  errmsg = "[" + response.error.status + " ERROR] " + response.error.data.error.message;
                } else {
                  errmsg = "Unknown error";
                }
                queryTargets[i].error = errmsg;
                return datapoints;
              }

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
        };
      })
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
      url: this.url + `/cogniteapi/${this.project}/timeseries/search?query=${query}`,
      method: "GET",
    }).then((result: { data: TimeSeriesResponse }) =>
      result.data.data.items.map(timeSeriesResponseItem => (
        {
          text: timeSeriesResponseItem.name,
          value: timeSeriesResponseItem.name
        }
      )));
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
