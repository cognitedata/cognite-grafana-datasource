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
      if (target.aggregation && target.aggregation.length > 0 && target.aggregation !== "none") {
        query.aggregates = target.aggregation;
      } else {
        target.granularity = "";
      }
      if (!target.granularity) {
        query.granularity = this.intervalToGranularity(options.intervalMs);
      } else {
        query.granularity = target.granularity;
      }
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
      })
      const queryReq: DataQueryRequest = {
        items: queryList,
        start: timeFrom,
        end: timeTo,
      }
      if (target.aggregation && target.aggregation.length > 0 && target.aggregation !== "none") {
        queryReq.aggregates = target.aggregation;
      } else {
        target.granularity = "";
      }
      if (target.granularity == "") {
        queryReq.granularity = this.intervalToGranularity(options.intervalMs);
      } else {
        queryReq.granularity = target.granularity;
      }
      queryReq.limit = Math.floor((queryReq.aggregates ? 10_000 : 100_000)/queryList.length);
      queries.push(queryReq);

      // assign labels to each timeseries
      if (target.tab === Tab.Timeseries) {
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
            labels.push(this.getTimeseriesLabel(target.label,ts))
          }
        })
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
                .map(d => [d[this.getDatasourceValueString(response.config.data.aggregates)], d.timestamp])
            }
          )));
        }, [])
    };
  }

  annotationQuery(options: any) {
    throw new Error("Annotation Support not implemented yet.");
  }

  // this function is for getting metrics (template variables)
  async metricFindQuery(query: any) {
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

    target.aggregation = filterOptions.aggregation;
    target.granularity = filterOptions.granularity;
  }

  async getAssetsForMetrics(query) {
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
    const filteredAssets = [];
    for (let asset of assets) {
      let add = true;
      for (let filter of filterOptions.filters) {
        if (filter.type === "=~") {
          const val = _.get(asset,filter.property);
          const regex = "^" + filter.value + "$";
          if (val === undefined || !val.match(regex)) {
            add = false;
            break;
          }
        } else if (filter.type === "!~") {
          const val = _.get(asset,filter.property);
          const regex = "^" + filter.value + "$";
          if (val === undefined || val.match(regex)) {
            add = false;
            break;
          }
        } else if (filter.type === "!=") {
          const val = _.get(asset,filter.property);
          if (val === undefined || (val == filter.value)) {
            add = false;
            break;
          }
        } else if (filter.type === "=") {
          const val = _.get(asset,filter.property);
          if (val === undefined || (val != filter.value)) {
            add = false;
            break;
          }
        } else {
          add = false;
          break;
        }
      }
      if (add) filteredAssets.push(asset);
    }

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
    const assetRegex = /^(?:asset|filter)\{(.*)\}$/;
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
