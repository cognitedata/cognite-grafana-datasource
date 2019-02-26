import _ from 'lodash';
import * as dateMath from 'grafana/app/core/utils/datemath';
import Utils from './utils';
import cache from './cache';

export interface TimeSeriesResponse {
  target: string;
  datapoints: [number, number][];
}

export interface QueryResponse {
  data: TimeSeriesResponse[];
}

export interface MetricDescription {
  readonly text: string;
  readonly value: number | string;
}

export type MetricFindQueryResponse = MetricDescription[];

type HttpMethod = 'POST' | 'GET' | 'PATCH' | 'DELETE';

export enum Tab {
  Timeseries = 'Timeseries',
  Asset = 'Asset',
  Custom = 'Custom',
}

enum ParseType {
  Timeseries = 'Timeseries',
  Asset = 'Asset',
  Event = 'Event',
}

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
  metadata?: object;
  unit?: string;
  assetId?: string;
  isStep: boolean;
  description?: string;
  source?: string;
  sourceId?: string;
  id: number;
  createdTime: number;
  lastUpdatedTime: number;
  selected: boolean;
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

export interface AssetQuery {
  target: string;
  old?: AssetQuery;
  timeseries: TimeSeriesResponseItem[];
  includeSubtrees: boolean;
  func: string;
}

export interface QueryTarget {
  refId: string;
  target: string;
  aggregation: string;
  granularity: string;
  error: string;
  hide: boolean;
  label: string;
  tab: Tab;
  assetQuery: AssetQuery;
  expr: string;
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

export interface DataQueryAlias {
  alias: string;
  id: number;
  aggregate?: string;
  granularity?: string;
}

export interface DataQueryRequestItem {
  name: string;
  start?: string | number;
  end?: string | number;
  limit?: number;
  granularity?: string;
  aggregates?: string;
  function?: string;
  aliases?: DataQueryAlias[];
}

export interface DataQueryRequest {
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
      aggregates: string;
    };
  };
}

type DataQueryError = {
  error: {
    data: {
      error?: {
        message: string;
        notFound?: string[];
      };
    };
    status: number;
  };
};

export interface Annotation {
  datasource: string;
  enable: boolean;
  hide: boolean;
  iconColor: string;
  limit: number;
  name: string;
  expr: string;
  filter: string;
  error: string;
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

export function isError(maybeError: DataQueryError | any): maybeError is DataQueryError {
  return (<DataQueryError>maybeError).error !== undefined;
}

export default class CogniteDatasource {
  id: number;
  url: string;
  name: string;
  project: string;
  q: any;

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

  private intervalToGranularity(intervalMs: number): string {
    const seconds = Math.round(intervalMs / 1000.0);
    if (seconds <= 60) {
      if (seconds <= 1) {
        return '1s';
      }
      return `${seconds}s`;
    }
    const minutes = Math.round(intervalMs / 1000.0 / 60.0);
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.round(intervalMs / 1000.0 / 60.0 / 60.0);
    if (hours <= 24) {
      return `${hours}h`;
    }
    const days = Math.round(intervalMs / 1000.0 / 60.0 / 60.0 / 24.0);
    return `${days}d`;
  }

  private async getDataQueryRequestItems(
    target: QueryTarget,
    options: QueryOptions
  ): Promise<DataQueryRequestItem[]> {
    if (target.tab === Tab.Timeseries || target.tab === undefined) {
      const query: DataQueryRequestItem = {
        name: target.target,
      };
      return [query];
    }

    if (target.tab === Tab.Asset || target.tab === Tab.Custom) {
      await this.findAssetTimeseries(target, options);
      if (target.tab === Tab.Custom) {
        this.filterOnAssetTimeseries(target, options); // apply the search expression
      }
      return target.assetQuery.timeseries.reduce((queries, ts) => {
        if (!ts.selected) {
          return queries;
        }
        const query: DataQueryRequestItem = {
          name: ts.name,
        };
        if (target.tab === Tab.Custom && target.assetQuery.func) {
          query.function = target.assetQuery.func.replace(/ID/g, String(ts.id));
          const regexSearch = /\[.*?\]/g;
          const regexMatches = query.function.match(regexSearch);
          query.aliases = [];
          if (regexMatches) {
            for (const match of regexMatches) {
              // format is id, aggregation, granularity
              const aliasParts = match
                .substr(1, match.length - 2)
                .split(',')
                .filter(string => string.length)
                .map(x => _.trim(x, ' \'"'));
              // if we only get [ID], then there is no need to make an alias
              if (aliasParts.length === 1) continue;
              const alias: DataQueryAlias = {
                alias: `alias${aliasParts.join('_')}`,
                id: Number(aliasParts[0]),
              };
              alias.aggregate = aliasParts[1];
              alias.granularity = aliasParts[2] || this.intervalToGranularity(options.intervalMs);
              query.function = query.function.replace(match, `[${alias.alias}]`);
              if (query.aliases.find(x => x.alias === alias.alias)) continue;
              query.aliases.push(alias);
            }
          }
        }
        return queries.concat(query);
      }, []);
    }

    return [];
  }

  public async query(options: QueryOptions): Promise<QueryResponse> {
    const queryTargets: QueryTarget[] = options.targets.reduce((targets, target) => {
      target.error = '';
      if (
        !target ||
        target.hide ||
        ((target.tab === Tab.Timeseries || target.tab === undefined) &&
          (!target.target || target.target === 'Start typing tag id here')) ||
        ((target.tab === Tab.Asset || target.tab === Tab.Custom) &&
          (!target.assetQuery || target.assetQuery.target === ''))
      ) {
        return targets;
      }
      return targets.concat(target);
    }, []);

    if (queryTargets.length === 0) {
      return Promise.resolve({ data: [] });
    }

    const timeFrom = Math.ceil(dateMath.parse(options.range.from));
    const timeTo = Math.ceil(dateMath.parse(options.range.to));
    const targetQueriesCount = [];
    const labels = [];

    const dataQueryRequestPromises = [];
    for (const target of queryTargets) {
      dataQueryRequestPromises.push(this.getDataQueryRequestItems(target, options));
    }
    const dataQueryRequestItems = await Promise.all(dataQueryRequestPromises);

    const queries: DataQueryRequest[] = [];
    for (const [target, queryList] of dataQueryRequestItems.map((ql, i) => [queryTargets[i], ql])) {
      if (queryList.length === 0) {
        continue;
      }
      // keep track of target lengths so we can assign errors later
      targetQueriesCount.push({
        refId: target.refId,
        count: queryList.length,
      });
      // create query requests
      const queryReq: DataQueryRequest = {
        items: queryList,
        start: timeFrom,
        end: timeTo,
      };
      if (target.aggregation && target.aggregation !== 'none') {
        queryReq.aggregates = target.aggregation;
        if (!target.granularity) {
          queryReq.granularity = this.intervalToGranularity(options.intervalMs);
        } else {
          queryReq.granularity = target.granularity;
        }
      }
      if (target.assetQuery && target.assetQuery.func && target.tab === Tab.Custom) {
        if (queryReq.aggregates) {
          target.error =
            '[ERROR] To use aggregations with functions, use [ID,aggregation,granularity] or [ID,aggregation]';
          targetQueriesCount.pop();
          continue;
        }
        let ids = 0;
        const idRegex = /\[.*?\]/g; // look for [something]
        for (const q of queryList) {
          const matches = q.function.match(idRegex);
          if (!matches) break;
          const idsObj = {};
          for (const match of matches) {
            idsObj[match.substr(1, match.length - 2)] = true;
          }
          ids += Object.keys(idsObj).length;
        }
        if (ids === 0) ids = 1; // will fail anyways, just show the api error message

        // check if any aggregates are being used
        const usesAggregations = queryList.some(item => item.aliases.length > 0);

        queryReq.limit = Math.floor((usesAggregations ? 10_000 : 100_000) / ids);
      } else {
        queryReq.limit = Math.floor((queryReq.aggregates ? 10_000 : 100_000) / queryList.length);
      }
      queries.push(queryReq);

      // assign labels to each timeseries
      if (target.tab === Tab.Timeseries || target.tab === undefined) {
        if (!target.label) target.label = '';
        if (target.label.match(/{{.*}}/)) {
          try {
            // need to fetch the timeseries
            const ts = await this.getTimeseries({
              q: target.target,
              limit: 1,
            });
            labels.push(this.getTimeseriesLabel(target.label, ts[0]));
          } catch {
            labels.push(target.label);
          }
        } else {
          labels.push(target.label);
        }
      } else {
        target.assetQuery.timeseries.forEach(ts => {
          if (ts.selected) {
            if (!target.label) target.label = '';
            labels.push(this.getTimeseriesLabel(target.label, ts));
          }
        });
      }
    }

    const queryRequests = queries.map(q =>
      cache
        .getQuery(
          {
            url: `${this.url}/cogniteapi/${this.project}/timeseries/dataquery`,
            method: 'POST',
            data: q,
          },
          this.backendSrv
        )
        .catch(error => {
          return { error };
        })
    );

    let timeseries: (DataQueryRequestResponse | DataQueryError)[];
    try {
      timeseries = await Promise.all(queryRequests);
    } catch (error) {
      return { data: [] };
    }
    let count = 0;
    return {
      data: timeseries.reduce((datapoints, response, i) => {
        const refId = targetQueriesCount[i].refId;
        const target = queryTargets.find(x => x.refId === refId);
        if (isError(response)) {
          let errmsg: string;
          if (response.error.data && response.error.data.error) {
            errmsg = `[${response.error.status} ERROR] ${response.error.data.error.message}`;
          } else {
            errmsg = 'Unknown error';
          }
          target.error = errmsg;
          return datapoints;
        }

        const aggregation = response.config.data.aggregates;
        const aggregationPrefix = aggregation ? `${aggregation} ` : '';
        return datapoints.concat(
          response.data.data.items.map(item => ({
            target: labels[count++] ? labels[count - 1] : aggregationPrefix + item.name,
            datapoints: item.datapoints
              .filter(d => d.timestamp >= timeFrom && d.timestamp <= timeTo)
              .map(d => {
                const val = Utils.getDatasourceValueString(response.config.data.aggregates);
                return [d[val] === undefined ? d.value : d[val], d.timestamp];
              }),
          }))
        );
      }, []),
    };
  }

  public async annotationQuery(options: AnnotationQueryOptions) {
    const { range, annotation } = options;
    const { expr, filter, error } = annotation;
    const startTime = Math.ceil(dateMath.parse(range.from));
    const endTime = Math.ceil(dateMath.parse(range.to));
    if (error || !expr) return [];

    const queryOptions = this.parse(expr, ParseType.Event);
    if (queryOptions.error) {
      return [{ value: queryOptions.error }];
    }
    const filterOptions = this.parse(filter || '', ParseType.Event);
    if (filter && filterOptions.error) {
      return [{ value: filterOptions.error }];
    }

    // use maxStartTime and minEndTime so that we include events that are partially in range
    const queryParams = {
      limit: 1000,
      maxStartTime: endTime,
      minEndTime: startTime,
      ...queryOptions.filters.reduce((obj, filter) => {
        obj[filter.property] = filter.value;
        return obj;
      }, {}),
    };

    const result = await cache.getQuery(
      {
        url: `${this.url}/cogniteapi/${this.project}/events/search?${Utils.getQueryString(
          queryParams
        )}`,
        method: 'GET',
      },
      this.backendSrv
    );
    const events = result.data.data.items;
    if (!events || events.length === 0) return [];

    this.applyFilters(filterOptions.filters, events);

    return events
      .filter(e => e.selected === true)
      .map(event => ({
        annotation,
        isRegion: true,
        text: event.description,
        time: event.startTime,
        timeEnd: event.endTime,
        title: event.type,
      }));
  }

  // this function is for getting metrics (template variables)
  async metricFindQuery(query: VariableQueryData) {
    return this.getAssetsForMetrics(query);
  }

  public async getOptionsForDropdown(
    query: string,
    type?: string,
    options?: any
  ): Promise<MetricFindQueryResponse> {
    let urlEnd: string;
    if (type === Tab.Asset) {
      if (query.length === 0) {
        urlEnd = `/cogniteapi/${this.project}/assets?`;
      } else {
        urlEnd = `/cogniteapi/${this.project}/assets/search?query=${query}`;
      }
    } else if (type === Tab.Timeseries) {
      if (query.length === 0) {
        urlEnd = `/cogniteapi/${this.project}/timeseries?limit=1000`;
      } else {
        urlEnd = `/cogniteapi/${this.project}/timeseries/search?query=${query}`;
      }
    }
    if (options) {
      urlEnd += `&${Utils.getQueryString(options)}`;
    }

    return cache
      .getQuery(
        {
          url: this.url + urlEnd,
          method: 'GET',
        },
        this.backendSrv
      )
      .then((result: { data: TimeSeriesResponse }) =>
        result.data.data.items.map(timeSeriesResponseItem => ({
          text: timeSeriesResponseItem.description
            ? `${timeSeriesResponseItem.name} (${timeSeriesResponseItem.description})`
            : timeSeriesResponseItem.name,
          value:
            type === Tab.Asset ? String(timeSeriesResponseItem.id) : timeSeriesResponseItem.name,
        }))
      );
  }

  async findAssetTimeseries(target, options) {
    // replace variables with their values
    const assetId = this.templateSrv.replace(target.assetQuery.target, options.scopedVars);

    // check if assetId has changed, if not we do not need to perform this query again
    if (
      target.assetQuery.old &&
      assetId === target.assetQuery.old.target &&
      target.assetQuery.includeSubtrees === target.assetQuery.old.includeSubtrees
    ) {
      return Promise.resolve();
    }
    target.assetQuery.old = {};
    target.assetQuery.old.target = String(assetId);
    target.assetQuery.old.includeSubtrees = target.assetQuery.includeSubtrees;

    const searchQuery: Partial<TimeseriesSearchQuery> = {
      path: target.assetQuery.includeSubtrees ? [assetId] : undefined,
      assetId: !target.assetQuery.includeSubtrees ? assetId : undefined,
      limit: 10000,
    };

    const ts = await this.getTimeseries(searchQuery);
    target.assetQuery.timeseries = ts.map(ts => {
      ts.selected = true;
      return ts;
    });
  }

  async getTimeseries(
    searchQuery: Partial<TimeseriesSearchQuery>
  ): Promise<TimeSeriesResponseItem[]> {
    return cache
      .getQuery(
        {
          url: `${this.url}/cogniteapi/${this.project}/timeseries?${Utils.getQueryString(
            searchQuery
          )}`,
          method: 'GET',
        },
        this.backendSrv
      )
      .then((result: { data: TimeSeriesResponse }) => {
        return _.cloneDeep(result.data.data.items.filter(ts => !ts.isString));
      });
  }

  filterOnAssetTimeseries(target: QueryTarget, options: QueryOptions) {
    const filterOptions = this.parse(target.expr, ParseType.Timeseries, options);
    if (filterOptions.error) {
      target.error = filterOptions.error;
      return;
    }
    const func = filterOptions.filters.find(x => x.property === 'function');
    if (func) {
      filterOptions.filters = filterOptions.filters.filter(x => x.property !== 'function');
      target.assetQuery.func = func.value;
    } else {
      target.assetQuery.func = '';
    }

    this.applyFilters(filterOptions.filters, target.assetQuery.timeseries);

    target.aggregation = filterOptions.aggregation;
    target.granularity = filterOptions.granularity;
  }

  async getAssetsForMetrics(query: VariableQueryData) {
    const queryOptions = this.parse(query.query, ParseType.Asset);
    if (queryOptions.error) {
      return [{ value: queryOptions.error }];
    }
    const filterOptions = this.parse(query.filter, ParseType.Asset);
    if (query.filter && filterOptions.error) {
      return [{ value: filterOptions.error }];
    }
    const urlEnd = `/cogniteapi/${this.project}/assets/search?`;

    const queryParams = {
      limit: 1000,
      ...queryOptions.filters.reduce((obj, filter) => {
        obj[filter.property] = filter.value;
        return obj;
      }, {}),
    };

    const result = await cache.getQuery(
      {
        url: this.url + urlEnd + Utils.getQueryString(queryParams),
        method: 'GET',
      },
      this.backendSrv
    );

    const assets = result.data.data.items;

    // now filter over these assets with the rest of the filters
    this.applyFilters(filterOptions.filters, assets);
    const filteredAssets = assets.filter(asset => asset.selected === true);

    return filteredAssets.map(asset => ({
      text: asset.name,
      value: asset.id,
    }));
  }

  parse(customQuery, type, options?) {
    let query = customQuery;
    if (type === ParseType.Timeseries || type === ParseType.Event) {
      // replace variables with their values
      if (options) {
        query = this.templateSrv.replace(query, options.scopedVars);
      } else {
        for (const templateVariable of this.templateSrv.variables) {
          query = query.replace(`[[${templateVariable.name}]]`, templateVariable.current.value);
          query = query.replace(`$${templateVariable.name}`, templateVariable.current.value);
        }
      }
    }

    const filtersOptions = {
      filters: [],
      granularity: '',
      aggregation: '',
      error: '',
    };

    // Format: timeseries{ options }
    //     or  timeseries{ options }[aggregation, granularity]
    // regex pulls out the options string, as well as the aggre/gran string (if it exists)
    const timeseriesRegex = /^timeseries\{(.*)\}(?:\[(.*)\])?$/;
    const timeseriesMatch = query.match(timeseriesRegex);
    const assetRegex = /^(?:asset|event)\{(.*)\}$/;
    const assetMatch = query.match(assetRegex);
    const filterRegex = /^filter\{(.*)\}$/;
    const filterMatch = query.match(filterRegex);

    let splitfilters: string[];
    if (timeseriesMatch) {
      // regex finds commas that are not followed by a closed bracket
      splitfilters = Utils.splitFilters(timeseriesMatch[1], filtersOptions, false);
    } else if (assetMatch) {
      splitfilters = Utils.splitFilters(assetMatch[1], filtersOptions, true);
    } else if (filterMatch) {
      splitfilters = Utils.splitFilters(filterMatch[1], filtersOptions, false);
    } else {
      filtersOptions.error = `ERROR: Unable to parse expression ${query}`;
    }

    if (filtersOptions.error) {
      return filtersOptions;
    }

    for (let f of splitfilters) {
      f = _.trim(f, ' ');
      if (f === '') continue;
      const filter: any = {};
      let i: number;
      if ((i = f.indexOf('=~')) > -1) {
        filter.property = _.trim(f.substr(0, i), ' \'"');
        filter.value = _.trim(f.substr(i + 2), ' \'"');
        filter.type = '=~';
      } else if ((i = f.indexOf('!~')) > -1) {
        filter.property = _.trim(f.substr(0, i), ' \'"');
        filter.value = _.trim(f.substr(i + 2), ' \'"');
        filter.type = '!~';
      } else if ((i = f.indexOf('!=')) > -1) {
        filter.property = _.trim(f.substr(0, i), ' \'"');
        filter.value = _.trim(f.substr(i + 2), ' \'"');
        filter.type = '!=';
      } else if ((i = f.indexOf('=')) > -1) {
        filter.property = _.trim(f.substr(0, i), ' \'"');
        filter.value = _.trim(f.substr(i + 1), ' \'"');
        filter.type = '=';
      } else {
        console.error(`Error parsing ${f}`);
      }
      filtersOptions.filters.push(filter);
    }

    if (timeseriesMatch) {
      const aggregation = timeseriesMatch[2];
      if (aggregation) {
        const splitAggregation = aggregation.split(',');
        filtersOptions.aggregation = _.trim(splitAggregation[0], ' \'"').toLowerCase();
        filtersOptions.granularity =
          splitAggregation.length > 1 ? _.trim(splitAggregation[1], ' \'"') : '';
      }
    }

    return filtersOptions;
  }

  private applyFilters(filters, objects) {
    for (const obj of objects) {
      obj.selected = true;
      for (const filter of filters) {
        if (filter.type === '=~') {
          const val = _.get(obj, filter.property);
          const regex = `^${filter.value}$`;
          if (val === undefined || !val.match(regex)) {
            obj.selected = false;
            break;
          }
        } else if (filter.type === '!~') {
          const val = _.get(obj, filter.property);
          const regex = `^${filter.value}$`;
          if (val === undefined || val.match(regex)) {
            obj.selected = false;
            break;
          }
        } else if (filter.type === '!=') {
          const val = _.get(obj, filter.property);
          if (val === undefined || String(val) === filter.value) {
            obj.selected = false;
            break;
          }
        } else if (filter.type === '=') {
          const val = _.get(obj, filter.property);
          if (val === undefined || String(val) !== filter.value) {
            obj.selected = false;
            break;
          }
        }
      }
    }
  }

  private getTimeseriesLabel(label, timeseries) {
    // matches with any text within {{ }}
    const variableRegex = /{{([^{}]*)}}/g;
    return label.replace(variableRegex, (full, group) => {
      return _.get(timeseries, group, full);
    });
  }

  testDatasource() {
    return this.backendSrv
      .datasourceRequest({
        url: `${this.url}/cogniteloginstatus`,
        method: 'GET',
      })
      .then(response => {
        if (response.status === 200) {
          if (response.data.data.loggedIn) {
            return {
              status: 'success',
              message: 'Your Cognite credentials are valid',
              title: 'Success',
            };
          }
          return {
            status: 'error',
            message: 'Your Cognite credentials are invalid',
            title: 'Error',
          };
        }
      });
  }
}
