import * as dateMath from 'app/core/utils/datemath';

export class TimeSeriesResponse {
  constructor(readonly target: string, readonly datapoints: [number, number]) {
  }
}

export type QueryResponse = TimeSeriesResponse[];

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
}

export type QueryFormat = "json";

export interface QueryOptions {
  range: QueryRange,
  interval: string,
  targets: QueryTarget[],
  format: QueryFormat,
  maxDataPoints: number,
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

  query(options: QueryOptions): Promise<QueryResponse> {
    if (options.targets.length === 0) {
      return Promise.resolve([]);
    }

    const timeFrom = Math.ceil(dateMath.parse(options.range.from));
    const timeTo = Math.ceil(dateMath.parse(options.range.to));
    const queryData = {
      items: options.targets.map(t => ({
        name: t.target,
      })),
      start: timeFrom,
      end: timeTo,
      limit: 10_000,
    };
    return this.backendSrv.datasourceRequest({
      method: "POST",
      url: this.url + `/cogniteapi/${this.project}/timeseries/dataquery`,
      data: queryData
    }).then((response: { data: DataDatapoints }) => (
      {
        data: response.data.data.items.map(item => (
          {
            target: item.name,
            datapoints: item.datapoints
              .filter(datapoint => {
                return datapoint.timestamp >= timeFrom && datapoint.timestamp <= timeTo
              })
              .map(datapoint => {
                return [datapoint.value, datapoint.timestamp];
              })
          }))
      })).catch((r: any) => {
      data: []
    })
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
