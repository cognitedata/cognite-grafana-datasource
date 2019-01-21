///<reference path="./grafana.d.ts" />
import _ from 'lodash';
import * as dateMath from 'app/core/utils/datemath';
import { QueryCtrl } from './module';

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
  metadata?: object,
  unit?: string,
  assetId?: string,
  isStep: boolean,
  description?: string,
  source?: string,
  sourceId?: string,
  id: number,
  createdTime: number,
  lastUpdatedTime: number,
  selected: boolean
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

export interface AssetQuery {
  query: string,
  unit: string,
  isStep: boolean,
  metadata: object,
  minCreatedTime: number,
  maxCreatedTime: number,
  minLastUpdatedTime: number,
  maxLastUpdatedTime: number,
  assetTimeseries: TimeSeriesResponseItem[],
  assetSubtrees?: boolean,
}

export interface QueryTarget {
  refId: string,
  target: string,
  aggregation: string,
  granularity: string,
  error: string,
  hide: boolean,
  label: string,
  tab: string,
  assetQuery: AssetQuery,
  custom: string,
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
  // target: QueryTarget,
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

  private getDataQueryRequestItem(target: QueryTarget, options: QueryOptions): DataQueryRequestItem[] {
    if (target.tab === 'Timeseries') {
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
      return [query];
    } else if (target.tab === 'Asset') {
      return target.assetQuery.assetTimeseries.reduce((queries,ts) => {
        if (!ts.selected) {
          return queries;
        }
        const query: DataQueryRequestItem = {
          name: ts.name,
          granularity: this.intervalToGranularity(options.intervalMs),
          aggregates: 'average',
        };
        return queries.concat(query);
      }, []);
    } else if (target.tab === 'Custom') {
      this.filterOnAssetTimeseries(target);
      return target.assetQuery.assetTimeseries.reduce((queries,ts) => {
        if (!ts.selected) {
          return queries;
        }
        const query: DataQueryRequestItem = {
          name: ts.name
        };
        console.log(target.aggregation, target.granularity);
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
        return queries.concat(query);
      }, []);

    }
    return [];
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

    const queries: DataQueryRequest[] = queryTargets.reduce((queries,target) => {
      const query: DataQueryRequestItem[] = this.getDataQueryRequestItem(target, options);
      return queries.concat(query.map(q => {
        return {
          items: [q],
          start: timeFrom,
          end: timeTo,
          // TODO: maxDataPoints is available, but seems to use unnecessarily low values.
          //       still looks ok for aggregates, so perhaps we should use it for those?
          //limit: options.maxDataPoints,
          limit: q.aggregates ? 10_000 : 100_000,
          aggregation: q.aggregates,
        }
      }));
    }, []);

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
        // const errors = timeseries.filter(isError);
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

  metricFindQuery(query: string, type?: string, options?: any): Promise<MetricFindQueryResponse> {
    let urlEnd: string;
    if (type === 'Asset'){
      if (query.length == 0) {
        urlEnd = `/cogniteapi/${this.project}/assets?`;
      } else {
        urlEnd = `/cogniteapi/${this.project}/assets/search?query=${query}`
      }
    } else if (type === 'Timeseries') {
      if (query.length == 0) {
        //might want to leave at 25 (default) or increase to an even higher value?
        urlEnd = `/cogniteapi/${this.project}/timeseries?limit=5`;
      } else {
        urlEnd = `/cogniteapi/${this.project}/timeseries/search?query=${query}`
      }
    } else { //metrics
      urlEnd = `/cogniteapi/${this.project}/assets/search?limit=1000&query=${query}`;
      type='Asset';
    }
    if (options) {
      for (let option in options) {
        urlEnd += "&" + option + "=" + options[option];
      }
    }

    return this.backendSrv.datasourceRequest({
      url: this.url + urlEnd,
      method: "GET",
    }).then((result: { data: TimeSeriesResponse }) =>
      result.data.data.items.map(timeSeriesResponseItem => (
        {
          text: timeSeriesResponseItem.name,
          value: (type==="Asset") ? '' + timeSeriesResponseItem.id : timeSeriesResponseItem.name
        }
      ))
      );
  }

  findAssetTimeseries(target, panelCtrl) {
    console.log(target.target);
    // console.log(`/cogniteapi/${this.project}/timeseries/search?` +
    // `query='${target.assetQuery.query}'&` +
    // `${(target.assetQuery.assetSubtrees) ? "assetSubtrees" : "assetIds"}=[${target.target}]&` +
    // `metadata=${target.assetQuery.metadata}&` +
    // `isStep=${target.assetQuery.isStep}&` +
    // `limit=1000&` +
    // `isString=false`);
    this.backendSrv.datasourceRequest({
      url: this.url + `/cogniteapi/${this.project}/timeseries/search?` +
      `${(target.assetQuery.assetSubtrees) ? "assetSubtrees" : "assetIds"}=[${target.target}]&` +
      `isString=false&` +
      `limit=1000&` +
      // target.assetQuery.query,
      `query='${target.assetQuery.query}'&` +
      `metadata=${target.assetQuery.metadata}&`,
      // `isStep=${target.assetQuery.isStep}&` ,
      method: "GET",
    }).then((result: { data: TimeSeriesResponse }) => {
      console.log(result.data.data.items);
      target.assetQuery.assetTimeseries = result.data.data.items.map(ts => {
        ts.selected = true;
        return ts;
      });
    })./*then(() => panelCtrl.refresh()).*/then(console.log(target.assetQuery)).then(this.filterOnAssetTimeseries(target));
  }

  filterOnAssetTimeseries(target) {
    const customQuery = target.assetQuery.custom;
    const filterOptions = this.parse(customQuery);

    for (let ts of target.assetQuery.assetTimeseries) {
      // console.log(ts);
      ts.selected = true;
      for (let filter of filterOptions.filters) {
        if (filter.type === "=~") {
          const val = _.get(ts,filter.property);
          const regex = "^" + filter.value + "$";
          if (val === undefined || !val.match(regex)) {
            ts.selected = false;
            break;
          }
        } else if (filter.type === "!~") {
          const val = _.get(ts,filter.property);
          const regex = "^" + filter.value + "$";
          if (val === undefined || val.match(regex)) {
            ts.selected = false;
            break;
          }
        } else if (filter.type === "!=") {
          const val = _.get(ts,filter.property);
          if (val === undefined || (val == filter.value)) {
            ts.selected = false;
            break;
          }
        } else if (filter.type === "=") {
          const val = _.get(ts,filter.property);
          if (val === undefined || (val != filter.value)) {
            ts.selected = false;
            break;
          }
        }
      }
    }

    if (filterOptions.aggregation) {
      target.aggregation = filterOptions.aggregation;
    }
    if (filterOptions.granularity) {
      target.granularity = filterOptions.granularity;
    }

    // panelCtrl.refresh();
  }

  parse(customQuery) {

    console.log(customQuery);
    for (let templateVariable of this.templateSrv.variables) {
      customQuery = customQuery.replace("[[" + templateVariable.name + "]]", templateVariable.current.value);
    }
    console.log("!!",customQuery);

    let filtersOptions = {
      filters: [],
      granularity: '',
      aggregation: ''
    };

    const timeseriesRegex = /^timeseries\{(.*)\}(?:\[(.*)\])$/;
    const timeseriesMatch = customQuery.match(timeseriesRegex);
    if (timeseriesMatch) {
      const splitfilters = timeseriesMatch[1].split(",");
      for (let f of splitfilters) {
        const filter: any = {};
        let i:number;
        f = _.trim(f," ");
        if ((i = f.indexOf("=~")) > -1) {
          filter.property = _.trim(f.substr(0,i), " '\"");
          filter.value = _.trim(f.substr(i+2), " '\"");
          filter.type = "=~";
        } else if ((i = f.indexOf("!~")) > -1) {
          filter.property = _.trim(f.substr(0,i), " '\"");
          filter.value = _.trim(f.substr(i+2), " '\"");
          filter.type = "!~";
        } else if ((i = f.indexOf("!=")) > -1) {
          filter.property = _.trim(f.substr(0,i), " '\"");
          filter.value = _.trim(f.substr(i+2), " '\"");
          filter.type = "!=";
        } else if ((i = f.indexOf("=")) > -1) {
          filter.property = _.trim(f.substr(0,i), " '\"");
          filter.value = _.trim(f.substr(i+1), " '\"");
          filter.type = "=";
        } else {
          console.error("Error parsing " + f);
        }
        filtersOptions.filters.push(filter);
      }

      const aggregation = timeseriesMatch[2];
      // console.log(timeseriesMatch);
      if (aggregation) {
        const splitAggregation = aggregation.split(',');
        filtersOptions.aggregation = splitAggregation[0];
        filtersOptions.granularity = splitAggregation[1];
      }
    }

    return filtersOptions;
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
