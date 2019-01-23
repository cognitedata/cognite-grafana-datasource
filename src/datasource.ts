///<reference path="./grafana.d.ts" />
import _ from 'lodash';
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

export enum Tab {
  Timeseries = "Timeseries",
  Asset = "Asset",
  Custom = "Custom"
}

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
  target: string,
  timeseries: TimeSeriesResponseItem[],
  includeSubtrees: boolean,
}

export interface QueryTarget {
  refId: string,
  target: string,
  aggregation: string,
  granularity: string,
  error: string,
  hide: boolean,
  label: string,
  tab: Tab,
  assetQuery: AssetQuery,
  expr: string,
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

interface Annotation {
  datasource: string;
  enable: boolean;
  hide: boolean;
  iconColor: string;
  limit: number;
  name: string;
  query_type?: string;
  query_subtype?: string;
  query_assetIds?: string;
  query_includeSubtrees?: boolean;
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

interface AnnotationQueryRequestResponse {
  data: DataEvents;
}

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
    if (target.tab === Tab.Timeseries) {
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
    } else if (target.tab === Tab.Asset || target.tab === Tab.Custom) {
      if (target.tab === Tab.Custom) {
        this.filterOnAssetTimeseries(target); //apply the search expression
      }
      return target.assetQuery.timeseries.reduce((queries,ts) => {
        if (!ts.selected) {
          return queries;
        }
        const query: DataQueryRequestItem = {
          name: ts.name,
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
    const targetQueriesCount = [];
    const queries: DataQueryRequest[] = queryTargets.reduce((queries,target) => {
      const queryList: DataQueryRequestItem[] = this.getDataQueryRequestItem(target, options);
      targetQueriesCount.push({
        refId: target.refId,
        count: queryList.length,
      })
      return queries.concat(queryList.map(q => {
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
        return {
          data: timeseries
            .reduce((datapoints, response, i) => {
              const refId = targetQueriesCount.reduce((retval, query) => {
                if (typeof(retval) === "string") return retval;
                else if (retval + query.count > i) return query.refId;
                else return retval + query.count;
              }, 0);
              const target = queryTargets.find(x => x.refId === refId);
              if (isError(response)) {
                let errmsg:string;
                if (response.error.data && response.error.data.error) {
                  errmsg = "[" + response.error.status + " ERROR] " + response.error.data.error.message;
                } else {
                  errmsg = "Unknown error";
                }
                target.error = errmsg;
                return datapoints;
              }

              const aggregation = response.config.data.aggregation;
              const aggregationPrefix = aggregation ? (aggregation + ' ') : '';
              return datapoints.concat(response.data.data.items.map(item => (
                {
                  target: (target.label) ? target.label : aggregationPrefix + item.name,
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

  public annotationQuery(options: AnnotationQueryOptions) {
    const { range, annotation } = options;
    const { query_type, query_subtype, query_assetIds, query_includeSubtrees } = annotation;
    const startTime = Math.ceil(dateMath.parse(range.from));
    const endTime = Math.ceil(dateMath.parse(range.to));
    const searchRequest: Partial<AnnotationSearchQuery> = {
      maxEndTime: +endTime,
      minStartTime: +startTime,
      subtype: query_subtype,
      type: query_type,
      assetIds: query_assetIds && !query_includeSubtrees
        ? query_assetIds.split(',').map(Number).filter(n => !isNaN(n))
        : undefined,
      assetSubtrees: query_assetIds && query_includeSubtrees
        ? query_assetIds.split(',').map(Number).filter(n => !isNaN(n))
        : undefined,
    };

    const stringified = Object.keys(searchRequest)
     .filter(k => searchRequest[k] !== undefined)
     .map(
       k =>
         Array.isArray(searchRequest[k])
           ? `${k}=[${searchRequest[k]}]` // arrays are always IDs AFAIK, does not need to be encoded
           : `${k}=${encodeURIComponent(searchRequest[k])}`
     )
     .join('&');

    return this.backendSrv
      .datasourceRequest({
        method: 'GET',
        url: this.url + `/cogniteapi/${this.project}/events/search?limit=1000&${stringified}`,
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

  metricFindQuery(query: string, type?: string, options?: any): Promise<MetricFindQueryResponse> {
    let urlEnd: string;
    if (type === Tab.Asset){
      if (query.length == 0) {
        urlEnd = `/cogniteapi/${this.project}/assets?`;
      } else {
        urlEnd = `/cogniteapi/${this.project}/assets/search?query=${query}`
      }
    } else if (type === 'Timeseries') {
      if (query.length == 0) {
        urlEnd = `/cogniteapi/${this.project}/timeseries?limit=1000`;
      } else {
        urlEnd = `/cogniteapi/${this.project}/timeseries/search?query=${query}`
      }
    } else { //metrics
      urlEnd = `/cogniteapi/${this.project}/assets/search?limit=1000&query=${query}`;
      type=Tab.Asset;
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
          value: (type===Tab.Asset) ? '' + timeSeriesResponseItem.id : timeSeriesResponseItem.name
        }))
      );
  }

  findAssetTimeseries(target, panelCtrl) {
    this.backendSrv.datasourceRequest({
      url: this.url + `/cogniteapi/${this.project}/timeseries/search?` +
      `${(target.assetQuery.includeSubtrees) ? "assetSubtrees" : "assetIds"}=[${target.assetQuery.target}]&` +
      `isString=false&` +
      `limit=1000`,
      method: "GET",
    }).then((result: { data: TimeSeriesResponse }) => {
      target.assetQuery.timeseries = result.data.data.items.map(ts => {
        ts.selected = true;
        return ts;
      });
    }).then(() => panelCtrl.refresh());
  }

  filterOnAssetTimeseries(target) {
    const filterOptions = this.parse(target.expr);

    for (let ts of target.assetQuery.timeseries) {
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
  }

  parse(customQuery) {
    // replace variables with their values
    for (let templateVariable of this.templateSrv.variables) {
      customQuery = customQuery.replace("[[" + templateVariable.name + "]]", templateVariable.current.value);
      customQuery = customQuery.replace("$" + templateVariable.name, templateVariable.current.value);
    }

    let filtersOptions = {
      filters: [],
      granularity: '',
      aggregation: ''
    };

    // Format: timeseries{ options }
    //     or  timeseries{ options }[aggregation, granularity]
    // regex pulls out the options string, as well as the aggre/gran string (if it exists)
    const timeseriesRegex = /^timeseries\{(.*)\}(?:\[(.*)\])$/;
    const timeseriesMatch = customQuery.match(timeseriesRegex);
    if (timeseriesMatch) {
      const splitfilters = timeseriesMatch[1].split(",");
      for (let f of splitfilters) {
        if (f == '') continue;
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
