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

enum ParseType {
  Timeseries = "Timeseries",
  Asset = "Asset",
  Event = "Event"
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
  old?: AssetQuery,
  timeseries: TimeSeriesResponseItem[],
  includeSubtrees: boolean,
  func: string,
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
  function?: string,
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
      aggregates: string
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
  expr: string;
  filter: string;
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

interface TimeseriesSearchQuery {
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

  private async getDataQueryRequestItems(target: QueryTarget, options: QueryOptions): Promise<DataQueryRequestItem[]> {
    if (target.tab === Tab.Timeseries || target.tab == undefined) {
      const query: DataQueryRequestItem = {
        name: target.target,
      };
      return [query];
    } else if (target.tab === Tab.Asset || target.tab === Tab.Custom) {
      await this.findAssetTimeseries(target);
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
        if (target.tab === Tab.Custom && target.assetQuery.func) {
          query.function = target.assetQuery.func.replace(/\[ID\]/g, "[" + ts.id + "]");
        }
        return queries.concat(query);
      }, []);
    }

    return [];
  }

  public async query(options: QueryOptions): Promise<QueryResponse> {
    const queryTargets : QueryTarget[] = options.targets.reduce((targets, target) => {
      target.error = "";
      if (!target || target.hide ||
          ((target.tab === Tab.Timeseries || target.tab == undefined) && (!target.target || target.target === 'Start typing tag id here')) ||
          ((target.tab === Tab.Asset || target.tab === Tab.Custom) && (!target.assetQuery || target.assetQuery.target === ''))) {
        return targets;
      }
      return targets.concat(target);
    }, []);

    if (queryTargets.length === 0) {
      return Promise.resolve({data: []});
    }

    const timeFrom = Math.ceil(dateMath.parse(options.range.from));
    const timeTo = Math.ceil(dateMath.parse(options.range.to));
    let targetQueriesCount = [], labels = [];

    let queries: DataQueryRequest[] = [];
    for (let target of queryTargets) {
      // create query requests
      const queryList: DataQueryRequestItem[] = await this.getDataQueryRequestItems(target, options);
      if (queryList.length === 0) {
        continue;
      }
      targetQueriesCount.push({
        refId: target.refId,
        count: queryList.length,
      });
      const queryReq: DataQueryRequest = {
        items: queryList,
        start: timeFrom,
        end: timeTo,
      };
      if (target.aggregation && target.aggregation.length > 0 && target.aggregation !== "none") {
        queryReq.aggregates = target.aggregation;
      } else {
        target.granularity = "";
      }
      if (!target.granularity) {
        queryReq.granularity = this.intervalToGranularity(options.intervalMs);
      } else {
        queryReq.granularity = target.granularity;
      }
      if (target.assetQuery && target.assetQuery.func && target.tab === Tab.Custom) {
        let ids = 0;
        const idRegex = /\[\d*\]/g; //look for [number]
        for (let q of queryList) {
          const matches = q.function.match(idRegex);
          if (!matches) break;
          const idsObj = {};
          for (let match of matches) {
            idsObj[match.substr(1,match.length-2)] = true;
          }
          ids += Object.keys(idsObj).length;
        }
        if (ids === 0) ids = 1; // will fail anyways, just show the api error message
        queryReq.limit = Math.floor(100_000/ids);
      } else {
        queryReq.limit = Math.floor((queryReq.aggregates ? 10_000 : 100_000)/queryList.length);
      }
      queries.push(queryReq);

      // assign labels to each timeseries
      if (target.tab === Tab.Timeseries || target.tab == undefined) {
        if (!target.label) target.label = "";
        if (target.label.match(/{{.*}}/)) {
          try { // need to fetch the timeseries
            const ts = await this.getTimeseries({
              q: target.target,
              limit: 1,
            });
            labels.push(this.getTimeseriesLabel(target.label,ts[0]));
          } catch {
            labels.push(target.label);
          }
        } else{
          labels.push(target.label);
        }
      } else {
        target.assetQuery.timeseries.forEach(ts => {
          if (ts.selected) {
            labels.push(this.getTimeseriesLabel(target.label,ts));
          }
        });
      }
    }

    const queryRequests = queries.map(q => this.backendSrv.datasourceRequest(
      {
        url: this.url + `/cogniteapi/${this.project}/timeseries/dataquery`,
        method: "POST",
        data: q
      })
      .catch(error => { return ({ error: error }) }) );

    let timeseries: (DataQueryRequestResponse | DataQueryError)[];
    try {
      timeseries = await Promise.all(queryRequests);
    } catch (error) {
      console.error(error);
      return {data: []};
    }
    let count = 0;
    return {
      data: timeseries
        .reduce((datapoints, response, i) => {
          const refId = targetQueriesCount[i].refId;
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

          const aggregation = response.config.data.aggregates;
          const aggregationPrefix = aggregation ? (aggregation + ' ') : '';
          return datapoints.concat(response.data.data.items.map(item => (
            {
              target: (labels[count++]) ? labels[count - 1] : aggregationPrefix + item.name,
              datapoints: item.datapoints
                .filter(d => d.timestamp >= timeFrom && d.timestamp <= timeTo)
                .map(d => [d[this.getDatasourceValueString(response.config.data.aggregates)] || d.value, d.timestamp])
            }
          )));
        }, [])
    };
  }

  public async annotationQuery(options: AnnotationQueryOptions) {
    // console.log(options);
    const { range, annotation } = options;
    const { expr, filter } = annotation;
    const startTime = Math.ceil(dateMath.parse(range.from));
    const endTime = Math.ceil(dateMath.parse(range.to));

    const queryOptions = this.parse(expr || '',ParseType.Event);
    const filterOptions = this.parse(filter || '',ParseType.Event);
    
    // need to have just equality
    const equalCheck = queryOptions.filters.find(x => x.type !== '=');
    if (equalCheck) {
      return [{value: "ERROR: Query can only use '='"}];
    }

    let url = this.url + `/cogniteapi/${this.project}/events/search?`;
    for (let param of queryOptions.filters) {
      url += param.property + '=' + param.value + "&";
    }

    let result = await this.backendSrv.datasourceRequest({
      url: url + "limit=1000",
      method: "GET",
    });
    const events = result.data.data.items;
    
    this.applyFilters(filterOptions.filters, events);

    return events.filter(e => e.selected === true).map( event=> ({
      annotation,
      isRegion: true,
      text: event.description,
      time: event.startTime,
      timeEnd: event.endTime,
      title: event.type,
    }))

    // const searchRequest: Partial<AnnotationSearchQuery> = {
    //   maxEndTime: +endTime,
    //   minStartTime: +startTime,
    //   subtype: query_subtype,
    //   type: query_type,
    //   assetIds: query_assetIds && !query_includeSubtrees
    //     ? query_assetIds.split(',').map(Number).filter(n => !isNaN(n))
    //     : undefined,
    //   assetSubtrees: query_assetIds && query_includeSubtrees
    //     ? query_assetIds.split(',').map(Number).filter(n => !isNaN(n))
    //     : undefined,
    // };

    // const stringified = Object.keys(searchRequest)
    //  .filter(k => searchRequest[k] !== undefined)
    //  .map(
    //    k =>
    //      Array.isArray(searchRequest[k])
    //        ? `${k}=[${searchRequest[k]}]` // arrays are always IDs AFAIK, does not need to be encoded
    //        : `${k}=${encodeURIComponent(searchRequest[k])}`
    //  )
    //  .join('&');

    // return this.backendSrv
    //   .datasourceRequest({
    //     method: 'GET',
    //     url: this.url + `/cogniteapi/${this.project}/events/search?limit=1000&${stringified}`,
    //   })
    //   .then((result: AnnotationQueryRequestResponse) => {
    //     return result.data.data.items.map(event => ({
    //       annotation,
    //       isRegion: true,
    //       text: event.description,
    //       time: event.startTime,
    //       timeEnd: event.endTime,
    //       title: event.type,
    //     }));
    //   });
  }

  // this function is for getting metrics (template variables)
  async metricFindQuery(query: VariableQueryData) {
    return this.getAssetsForMetrics(query);
  }

  public getOptionsForDropdown(query: string, type?: string, options?: any): Promise<MetricFindQueryResponse> {
    let urlEnd: string;
    if (type === Tab.Asset){
      if (query.length == 0) {
        urlEnd = `/cogniteapi/${this.project}/assets?`;
      } else {
        urlEnd = `/cogniteapi/${this.project}/assets/search?query=${query}`
      }
    } else if (type === Tab.Timeseries) {
      if (query.length == 0) {
        urlEnd = `/cogniteapi/${this.project}/timeseries?limit=1000`;
      } else {
        urlEnd = `/cogniteapi/${this.project}/timeseries/search?query=${query}`
      }
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

  async findAssetTimeseries(target) {
    // replace variables with their values
    let assetId = target.assetQuery.target;
    for (let templateVariable of this.templateSrv.variables) {
      assetId = assetId.replace("[[" + templateVariable.name + "]]", templateVariable.current.value);
      assetId = assetId.replace("$" + templateVariable.name, templateVariable.current.value);
    }

    //check if assetId has changed, if not we do not need to perform this query again
    if (target.assetQuery.old && assetId == target.assetQuery.old.target && target.assetQuery.includeSubtrees == target.assetQuery.old.includeSubtrees) {
      return Promise.resolve();
    } else {
      target.assetQuery.old = {};
      target.assetQuery.old.target = '' + assetId;
      target.assetQuery.old.includeSubtrees = target.assetQuery.includeSubtrees;
    }

    const searchQuery: Partial<TimeseriesSearchQuery> = {
      path: (target.assetQuery.includeSubtrees) ? [assetId] : undefined,
      assetId: (!target.assetQuery.includeSubtrees) ? assetId : undefined,
      limit: 10000,
    }

    const ts = await this.getTimeseries(searchQuery)
    target.assetQuery.timeseries = ts.map(ts => {
        ts.selected = true;
        return ts;
      });
  }

  getTimeseries(searchQuery: Partial<TimeseriesSearchQuery>) : TimeSeriesResponseItem[] {
    const stringified = Object.keys(searchQuery)
    .filter(k => searchQuery[k] !== undefined)
    .map(
      k =>
        Array.isArray(searchQuery[k])
          ? `${k}=[${encodeURIComponent(searchQuery[k])}]`
          : `${k}=${encodeURIComponent(searchQuery[k])}`
    )
    .join('&');

    return this.backendSrv.datasourceRequest({
      url: this.url + `/cogniteapi/${this.project}/timeseries?` + stringified,
      method: "GET",
    }).then((result: { data: TimeSeriesResponse }) => {
      return result.data.data.items.filter(ts => ts.isString === false);
    })
  }

  filterOnAssetTimeseries(target) {
    const filterOptions = this.parse(target.expr, ParseType.Timeseries);
    const func = filterOptions.filters.find(x => x.property === "function");
    if (func) {
      filterOptions.filters = filterOptions.filters.filter(x => x.property !== "function");
      target.assetQuery.func = func.value;
    } else {
      target.assetQuery.func = '';
    }

    // for (let ts of target.assetQuery.timeseries) {
    //   ts.selected = true;
    //   for (let filter of filterOptions.filters) {
    //     if (filter.type === "=~") {
    //       const val = _.get(ts,filter.property);
    //       const regex = "^" + filter.value + "$";
    //       if (val === undefined || !val.match(regex)) {
    //         ts.selected = false;
    //         break;
    //       }
    //     } else if (filter.type === "!~") {
    //       const val = _.get(ts,filter.property);
    //       const regex = "^" + filter.value + "$";
    //       if (val === undefined || val.match(regex)) {
    //         ts.selected = false;
    //         break;
    //       }
    //     } else if (filter.type === "!=") {
    //       const val = _.get(ts,filter.property);
    //       if (val === undefined || (val == filter.value)) {
    //         ts.selected = false;
    //         break;
    //       }
    //     } else if (filter.type === "=") {
    //       const val = _.get(ts,filter.property);
    //       if (val === undefined || (val != filter.value)) {
    //         ts.selected = false;
    //         break;
    //       }
    //     }
    //   }
    // }
    this.applyFilters(filterOptions.filters, target.assetQuery.timeseries);

    target.aggregation = filterOptions.aggregation;
    target.granularity = filterOptions.granularity;
  }

  async getAssetsForMetrics(query: VariableQueryData) {
    const queryOptions = this.parse(query.query, ParseType.Asset);
    const filterOptions = this.parse(query.filter, ParseType.Asset);
    const urlEnd = `/cogniteapi/${this.project}/assets/search?`;

    // need to have just equality
    const equalCheck = queryOptions.filters.find(x => x.type !== '=');
    if (equalCheck) {
      return [{value: "ERROR: Query can only use '='"}];
    }

    let url = this.url + urlEnd;
    for (let param of queryOptions.filters) {
      url += param.property + '=' + param.value + "&";
    }

    let result = await this.backendSrv.datasourceRequest({
      url: url + "limit=1000",
      method: "GET",
    });
    const assets = result.data.data.items;

    // now filter over these assets with the rest of the filters
    this.applyFilters(filterOptions.filters, assets);
    const filteredAssets = assets.filter(a => a.selected === true);
    // const filteredAssets = [];
    // for (let asset of assets) {
    //   let add = true;
    //   for (let filter of filterOptions.filters) {
    //     if (filter.type === "=~") {
    //       const val = _.get(asset,filter.property);
    //       const regex = "^" + filter.value + "$";
    //       if (val === undefined || !val.match(regex)) {
    //         add = false;
    //         break;
    //       }
    //     } else if (filter.type === "!~") {
    //       const val = _.get(asset,filter.property);
    //       const regex = "^" + filter.value + "$";
    //       if (val === undefined || val.match(regex)) {
    //         add = false;
    //         break;
    //       }
    //     } else if (filter.type === "!=") {
    //       const val = _.get(asset,filter.property);
    //       if (val === undefined || (val == filter.value)) {
    //         add = false;
    //         break;
    //       }
    //     } else if (filter.type === "=") {
    //       const val = _.get(asset,filter.property);
    //       if (val === undefined || (val != filter.value)) {
    //         add = false;
    //         break;
    //       }
    //     } else {
    //       add = false;
    //       break;
    //     }
    //   }
    //   if (add) filteredAssets.push(asset);
    // }

    return filteredAssets.map( asset => (
      {
        text: asset.name,
        value: asset.id,
      }));

  }

  parse(customQuery, type) {
    if (type === ParseType.Timeseries || type === ParseType.Event) {
      // replace variables with their values
      for (let templateVariable of this.templateSrv.variables) {
        customQuery = customQuery.replace("[[" + templateVariable.name + "]]", templateVariable.current.value);
        customQuery = customQuery.replace("$" + templateVariable.name, templateVariable.current.value);
      }
    }

    let filtersOptions = {
      filters: [],
      granularity: '',
      aggregation: ''
    };

    // Format: timeseries{ options }
    //     or  timeseries{ options }[aggregation, granularity]
    // regex pulls out the options string, as well as the aggre/gran string (if it exists)
    const timeseriesRegex = /^timeseries\{(.*)\}(?:\[(.*)\])?$/;
    const timeseriesMatch = customQuery.match(timeseriesRegex);
    const assetRegex = /^(?:asset|event|filter)\{(.*)\}$/;
    const assetMatch = customQuery.match(assetRegex);

    let splitfilters: string[];
    if (timeseriesMatch) {
      splitfilters = timeseriesMatch[1].split(",");
    } else if (assetMatch) {
      splitfilters = assetMatch[1].split(",");
    } else {
      return filtersOptions;
    }

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

    if (timeseriesMatch) {
      const aggregation = timeseriesMatch[2];
      if (aggregation) {
        const splitAggregation = aggregation.split(',');
        filtersOptions.aggregation = _.trim(splitAggregation[0], " '\"").toLowerCase();
        filtersOptions.granularity = splitAggregation.length > 1 ? _.trim(splitAggregation[1], " '\"") : '';
      }
    }

    return filtersOptions;
  }

  private applyFilters(filters, objects) {
    for (let obj of objects) {
      obj.selected = true;
      for (let filter of filters) {
        if (filter.type === "=~") {
          const val = _.get(obj,filter.property);
          const regex = "^" + filter.value + "$";
          if (val === undefined || !val.match(regex)) {
            obj.selected = false;
            break;
          }
        } else if (filter.type === "!~") {
          const val = _.get(obj,filter.property);
          const regex = "^" + filter.value + "$";
          if (val === undefined || val.match(regex)) {
            obj.selected = false;
            break;
          }
        } else if (filter.type === "!=") {
          const val = _.get(obj,filter.property);
          if (val === undefined || (val == filter.value)) {
            obj.selected = false;
            break;
          }
        } else if (filter.type === "=") {
          const val = _.get(obj,filter.property);
          if (val === undefined || (val != filter.value)) {
            obj.selected = false;
            break;
          }
        }
      }
    }
  }

  private getDatasourceValueString(aggregation:string): string {
    const mapping = {
      undefined: 'value',
      'none': 'value',
      'avg': 'average',
      'int': 'interpolation',
      'stepinterpolation': 'stepInterpolation',
      'step': 'stepInterpolation',
      'continuousvariance': 'continousVariance', //spelling mistake is intended - will have to change in 0.6
      'cv': 'continousVariance',
      'discretevariance': 'discreteVariance',
      'dv': 'discreteVariance',
      'totalvariation': 'totalVariation',
      'tv': 'totalVariation',
    };
    return mapping[aggregation] || aggregation;
  }

  private getTimeseriesLabel(label, timeseries) {
    // matches with any text within {{ }} 
    const variableRegex = /{{([^{}]*)}}/g;
    return label.replace(variableRegex, function(full,group) {
      return _.get(timeseries,group,full);
    })
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
