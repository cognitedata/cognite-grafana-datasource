import _ from 'lodash';
import * as dateMath from 'grafana/app/core/utils/datemath';
import {
  reduceToMap,
  applyFilters,
  intervalToGranularity,
  getRequestId,
  getQueryString,
  getDatasourceValueString,
} from './utils';
import cache from './cache';
import { parseExpression, parse } from './parser';
import { BackendSrv } from 'grafana/app/core/services/backend_srv';
import { TemplateSrv } from 'grafana/app/features/templating/template_srv';
import {
  TimeSeriesDatapoint,
  AnnotationQueryOptions,
  AnnotationResponse,
  CogniteDataSourceSettings,
  DataQueryError,
  DataQueryRequest,
  DataQueryRequestItem,
  DataQueryRequestResponse,
  MetricFindQueryResponse,
  ParseType,
  QueryOptions,
  QueryResponse,
  QueryTarget,
  Tab,
  TimeSeriesResponseItem,
  TimeseriesFilterQuery,
  VariableQueryData,
  isError,
  HttpMethod,
  Response,
  RequestParams,
  Timestamp,
} from './types';

export default class CogniteDatasource {
  id: number;
  url: string;
  name: string;
  project: string;

  /** @ngInject */
  constructor(
    instanceSettings: CogniteDataSourceSettings,
    private backendSrv: BackendSrv,
    private templateSrv: TemplateSrv
  ) {
    this.id = instanceSettings.id;
    this.url = instanceSettings.url;
    this.project = instanceSettings.jsonData.cogniteProject;
    this.name = instanceSettings.name;
  }

  public async query(options: QueryOptions): Promise<QueryResponse> {
    const queryTargets: QueryTarget[] = options.targets.reduce((targets, target) => {
      target.error = '';
      target.warning = '';
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
    let labels = [];

    const dataQueryRequestPromises: Promise<DataQueryRequestItem[]>[] = [];
    for (const target of queryTargets) {
      dataQueryRequestPromises.push(this.getDataQueryRequestItems(target, options));
    }
    const dataQueryRequestItems = await Promise.all(dataQueryRequestPromises);

    const queries: DataQueryRequest[] = [];
    for (const { target, queryList } of dataQueryRequestItems.map((ql, i) => ({
      target: queryTargets[i],
      queryList: ql,
    }))) {
      if (queryList.length === 0 || target.error) {
        continue;
      }

      // /dataquery is limited to 100 items, so we need to add new calls if we go over 100 items
      // may want to change how much we split into, but for now, 100 seems like the best
      const qlChunks = _.chunk(queryList, 100);
      for (const qlChunk of qlChunks) {
        // keep track of target lengths so we can assign errors later
        targetQueriesCount.push({
          refId: target.refId,
          count: qlChunk.length,
        });
        // create query requests
        const queryReq: DataQueryRequest = {
          items: qlChunk,
          start: timeFrom,
          end: timeTo,
        };
        if (target.aggregation && target.aggregation !== 'none') {
          queryReq.aggregates = [target.aggregation];
          if (!target.granularity) {
            queryReq.granularity = intervalToGranularity(options.intervalMs);
          } else {
            queryReq.granularity = target.granularity;
          }
        }
        if (target.tab === Tab.Custom && qlChunk[0].function) {
          let idsCount = 0;
          const idRegex = /\[.*?\]/g; // look for [something]
          for (const q of qlChunk) {
            const matches = q.function.match(idRegex);
            if (!matches) break;
            const idsObj = {};
            for (const match of matches) {
              idsObj[match.substr(1, match.length - 2)] = true;
            }
            idsCount += Object.keys(idsObj).length;
          }
          if (idsCount === 0) idsCount = 1; // will fail anyways, just show the api error message

          // check if any aggregates are being used
          const usesAggregates = qlChunk.some(item => item.aliases.length > 0);

          queryReq.limit = Math.floor((usesAggregates ? 10_000 : 100_000) / idsCount);
        } else {
          queryReq.limit = Math.floor((queryReq.aggregates ? 10_000 : 100_000) / qlChunk.length);
        }
        queries.push(queryReq);
      }

      // assign labels to each timeseries
      if (target.tab === Tab.Timeseries || target.tab === undefined) {
        if (!target.label) target.label = '';
        if (target.label.match(/{{.*}}/)) {
          try {
            // need to fetch the timeseries
            const ts = await this.getTimeseries({ externalId: target.target }, target);
            labels.push(this.getTimeseriesLabel(target.label, ts[0]));
          } catch {
            labels.push(target.label);
          }
        } else {
          labels.push(target.label);
        }
      } else if (target.tab === Tab.Asset) {
        target.assetQuery.timeseries.forEach(ts => {
          if (ts.selected) {
            if (!target.label) target.label = '';
            labels.push(this.getTimeseriesLabel(target.label, ts));
          }
        });
      } else {
        let count = 0;
        while (count < queryList.length) {
          cache.getTimeseries(options, target).forEach(ts => {
            if (ts.selected && count < queryList.length) {
              count += 1;
              if (!target.label) {
                if (queryList[0].function) {
                  // if using custom functions and no label is specified just use the name of the last timeseries in the function
                  labels.push(ts.name);
                  return;
                }
                target.label = '';
              }
              labels.push(this.getTimeseriesLabel(target.label, ts));
            }
          });
        }
      }
    }
    // replace variables in labels as well
    labels = labels.map(label => this.templateSrv.replace(label, options.scopedVars));

    const queryRequests = queries.map(
      data =>
        this.fetchData({
          data,
          path: `/timeseries/data/list`,
          method: HttpMethod.POST,
          requestId: getRequestId(options, queryTargets[queries.findIndex(x => x === data)]),
        }).catch(error => ({ error })) as any
    );

    let timeseries: (DataQueryRequestResponse | DataQueryError)[];
    try {
      timeseries = await Promise.all(queryRequests);
    } catch (error) {
      return { data: [] };
    }
    let count = 0;
    const responseTimeseries = timeseries.reduce((datapoints, response, i) => {
      const refId = targetQueriesCount[i].refId;
      const target = queryTargets.find(x => x.refId === refId);
      if (isError(response)) {
        // if response was cancelled, no need to show error message
        if (!response.error.cancelled) {
          let errmsg: string;
          if (response.error.data && response.error.data.error) {
            errmsg = `[${response.error.status} ERROR] ${response.error.data.error.message}`;
          } else {
            errmsg = 'Unknown error';
          }
          target.error = errmsg;
        }
        count += targetQueriesCount[i].count; // skip over these labels
        return datapoints;
      }

      const aggregation = response.config.data.aggregates;
      const aggregationPrefix = aggregation ? `${aggregation} ` : '';
      return datapoints.concat(
        response.data.items.map(item => {
          if (item.datapoints.length >= response.config.data.limit) {
            target.warning =
              '[WARNING] Datapoints limit was reached, so not all datapoints may be shown. Try increasing the granularity, or choose a smaller time range.';
          }
          return {
            target: labels[count++]
              ? labels[count - 1]
              : aggregationPrefix + (item.externalId || item.id),
            datapoints: (item.datapoints as Timestamp[])
              .filter(d => d.timestamp >= timeFrom && d.timestamp <= timeTo)
              .map(d => {
                const prop = getDatasourceValueString(response.config.data.aggregates);
                const value = prop in d ? d[prop] : (d as TimeSeriesDatapoint).value;
                return [value, d.timestamp];
              }),
          };
        })
      );
    }, []);
    return {
      data: responseTimeseries,
    };
  }

  private async getDataQueryRequestItems(
    target: QueryTarget,
    options: QueryOptions
  ): Promise<DataQueryRequestItem[]> {
    try {
      switch (target.tab) {
        case undefined:
        case Tab.Timeseries: {
          return [{ externalId: target.target }];
        }
        case Tab.Asset: {
          await this.findAssetTimeseries(target, options);
          return target.assetQuery.timeseries
            .filter(ts => ts.selected)
            .map(ts => ({ externalId: ts.name })); // todo: remove weird mapping
        }
        case Tab.Custom: {
          await this.findAssetTimeseries(target, options);
          const timeseries = cache.getTimeseries(options, target); // TODO: remove this ugly logic
          if (!timeseries.length) {
            target.warning = '[WARNING] No timeseries found.';
          } else if (target.expr) {
            // apply the search expression
            return parseExpression(target.expr, options, timeseries, this.templateSrv, target);
          }
        }
      }
    } catch (e) {
      target.error = e;
    }
    return [];
  }

  public async annotationQuery(options: AnnotationQueryOptions): Promise<AnnotationResponse[]> {
    const { range, annotation } = options;
    const { expr, filter, error } = annotation;
    const startTime = Math.ceil(dateMath.parse(range.from));
    const endTime = Math.ceil(dateMath.parse(range.to));
    if (error || !expr) return [];

    const queryOptions = parse(expr, ParseType.Event, this.templateSrv);
    if (queryOptions.error) {
      console.error(queryOptions.error);
      return [];
    }
    const filterOptions = parse(filter || '', ParseType.Event, this.templateSrv);
    if (filter && filterOptions.error) {
      console.error(filterOptions.error);
      return [];
    }

    // use max startTime and min endTime so that we include events that are partially in range
    const filterQuery = {
      startTime: { max: endTime },
      endTime: { min: startTime },
      ...reduceToMap(queryOptions.filters),
    };

    const items = await this.fetchItems<any>({
      path: `/events/list`,
      method: HttpMethod.POST,
      data: {
        filter: filterQuery,
        limit: 1000,
      },
    });
    if (!items || !items.length) return [];

    applyFilters(filterOptions.filters, items);

    return items
      .filter(({ selected }) => selected)
      .map(({ description, startTime, endTime, type }) => ({
        annotation,
        isRegion: true,
        text: description,
        time: startTime,
        timeEnd: endTime,
        title: type,
      }));
  }

  private fetchData<T>({
    path,
    data,
    method,
    params,
    requestId,
  }: RequestParams): Promise<Response<T>> {
    const paramsString = params ? `?${getQueryString(params)}` : '';
    const url = `${this.url}/cogniteapi/${this.project}${path}${paramsString}`;
    const body: any = { url, data, method };
    if (requestId) {
      body.requestId = requestId;
    }
    return cache.getQuery(body, this.backendSrv);
  }

  private async fetchItems<T>(params: RequestParams) {
    const { data } = await this.fetchData<T>(params);
    return data.items;
  }

  public async getOptionsForDropdown(
    query: string,
    type?: string,
    options?: any
  ): Promise<MetricFindQueryResponse> {
    const resources = {
      [Tab.Asset]: 'assets',
      [Tab.Timeseries]: 'timeseries',
    };
    const data: any = query
      ? {
          search: { query },
        }
      : {};

    const items = await this.fetchItems<TimeSeriesResponseItem>({
      data,
      path: `/${resources[type]}/search`,
      method: HttpMethod.POST,
      params: options,
    });

    return items.map(({ name, id, description }) => ({
      text: description ? `${name} (${description})` : name,
      value: type === Tab.Asset ? `${id}` : name,
    }));
  }

  async findAssetTimeseries(target: QueryTarget, options: QueryOptions): Promise<void> {
    // replace variables with their values
    const assetId = this.templateSrv.replace(target.assetQuery.target, options.scopedVars);
    const filter = target.assetQuery.includeSubtrees
      ? {
          assetSubtreeIds: [{ id: assetId }],
        }
      : {
          assetIds: [assetId],
        };
    const filterQuery = {
      filter,
      limit: 1000, // might need to paginate here? or say that there are more?
    };

    // for custom queries, use cache instead of storing in target object
    if (target.tab === Tab.Custom) {
      target.assetQuery.templatedTarget = assetId;
      const timeseries = cache.getTimeseries(options, target);
      if (!timeseries) {
        const ts = await this.getTimeseries(filterQuery, target);
        cache.setTimeseries(
          options,
          target,
          ts.map(ts => {
            ts.selected = true;
            return ts;
          })
        );
      }
      return;
    }

    // check if assetId has changed, if not we do not need to perform this query again
    if (
      target.assetQuery.old &&
      assetId === target.assetQuery.old.target &&
      target.assetQuery.includeSubtrees === target.assetQuery.old.includeSubtrees
    ) {
      return;
    }
    target.assetQuery.old = {
      target: `${assetId}`,
      includeSubtrees: target.assetQuery.includeSubtrees,
    };

    // since /dataquery can only have 100 items and checkboxes become difficult to use past 100 items,
    //  we only get the first 100 timeseries, and show a warning if there are too many timeseries
    filterQuery.limit = 101;
    const ts = await this.getTimeseries(filterQuery, target);
    if (ts.length === 101) {
      target.warning =
        "[WARNING] Only showing first 100 timeseries. To get better results, either change the selected asset or use 'Custom Query'.";
      ts.splice(-1);
    }
    target.assetQuery.timeseries = ts.map(ts => {
      ts.selected = true;
      return ts;
    });
  }

  async getTimeseries(
    filter: TimeseriesFilterQuery,
    target: QueryTarget
  ): Promise<TimeSeriesResponseItem[]> {
    try {
      const endpoint = 'id' in filter || 'externalId' in filter ? 'byids' : 'list';

      const items = await this.fetchItems<TimeSeriesResponseItem>({
        path: `/timeseries/${endpoint}`,
        method: HttpMethod.POST,
        data: filter,
      });
      return _.cloneDeep(items.filter(ts => !ts.isString));
    } catch ({ data, status }) {
      if (data && data.error) {
        target.error = `[${status} ERROR] ${data.error.message}`;
      } else {
        target.error = 'Unknown error';
      }
      return [];
    }
  }

  // this function is for getting metrics (template variables)
  async metricFindQuery(query: VariableQueryData): Promise<MetricFindQueryResponse> {
    const queryOptions = parse(query.query, ParseType.Asset, this.templateSrv);
    if (queryOptions.error) {
      return [{ text: queryOptions.error, value: '-' }];
    }
    const filterOptions = parse(query.filter, ParseType.Asset, this.templateSrv);
    if (query.filter && filterOptions.error) {
      return [{ text: filterOptions.error, value: '-' }];
    }

    const assets = await this.fetchItems<any>({
      path: `/assets/search`,
      method: HttpMethod.POST,
      data: {
        search: reduceToMap(queryOptions.filters),
        limit: 1000,
      },
    });

    // now filter over these assets with the rest of the filters
    applyFilters(filterOptions.filters, assets);

    return assets
      .filter(({ selected }) => selected)
      .map(({ name, id }) => ({
        text: name,
        value: id,
      }));
  }

  private getTimeseriesLabel(label: string, timeseries: TimeSeriesResponseItem): string {
    // matches with any text within {{ }}
    const variableRegex = /{{([^{}]*)}}/g;
    return label.replace(variableRegex, (full, group) => {
      return _.get(timeseries, group, full);
    });
  }

  async testDatasource() {
    const response = await this.backendSrv.datasourceRequest({
      url: `${this.url}/cogniteloginstatus`,
      method: 'GET',
    });

    if (response.status === 200) {
      if (response.data.data.loggedIn && response.data.data.project === this.project) {
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
  }
}
