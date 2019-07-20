import _ from 'lodash';
import * as dateMath from 'grafana/app/core/utils/datemath';
import Utils from './utils';
import cache from './cache';
import { parseExpression, parse } from './parser';
import { BackendSrv } from 'grafana/app/core/services/backend_srv';
import { TemplateSrv } from 'grafana/app/features/templating/template_srv';
import {
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
  TimeSeriesResponse,
  TimeSeriesResponseItem,
  TimeseriesSearchQuery,
  VariableQueryData,
  isError,
  HttpMethod,
  TimeseriesListQuery,
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
    const requestIds = [];

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
      let index = 0;
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
          queryReq.aggregates = target.aggregation;
          if (!target.granularity) {
            queryReq.granularity = Utils.intervalToGranularity(options.intervalMs);
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
        // TODO: this doesn't quite work for /dataquery calls that go over 100 items since all the calls
        //  would have the same requestId.. for now we can append the index in qlChunks so that normal calls
        //  can still be cancelled
        requestIds.push(`${Utils.getRequestId(options, target)}_${index}`);
        index += 1;
      }

      // assign labels to each timeseries
      if (target.tab === Tab.Timeseries || target.tab === undefined) {
        if (!target.label) target.label = '';
        if (target.label.match(/{{.*}}/)) {
          try {
            // need to fetch the timeseries
            // TODO: need to clean up all queries + cursoring to a common file
            const response = await cache.getQuery(
              {
                url: `${this.url}/cogniteapi/${
                  this.project
                }/timeseries/search?${Utils.getQueryString({
                  search: {
                    name: target.target,
                  },
                  limit: 1,
                })}`,
                method: 'POST',
              },
              this.backendSrv
            );
            const ts = response.data.items;
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

    const queryRequests = queries.map(q =>
      cache
        .getQuery(
          {
            url: `${this.url}/oldcogniteapi/${this.project}/timeseries/dataquery`,
            method: 'POST',
            data: q,
            requestId: requestIds.shift(),
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
          response.data.data.items.map(item => {
            if (item.datapoints.length >= response.config.data.limit) {
              target.warning =
                '[WARNING] Datapoints limit was reached, so not all datapoints may be shown. Try increasing the granularity, or choose a smaller time range.';
            }
            return {
              target: labels[count++] ? labels[count - 1] : aggregationPrefix + item.name,
              datapoints: item.datapoints
                .filter(d => d.timestamp >= timeFrom && d.timestamp <= timeTo)
                .map(d => {
                  const val = Utils.getDatasourceValueString(response.config.data.aggregates);
                  return [d[val] === undefined ? d.value : d[val], d.timestamp];
                }),
            };
          })
        );
      }, []),
    };
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

    if (target.tab === Tab.Asset) {
      await this.findAssetTimeseries(target, options);
      return target.assetQuery.timeseries.filter(ts => ts.selected).map(ts => ({ name: ts.name }));
    }

    if (target.tab === Tab.Custom) {
      if (!target.expr) return [];
      await this.findAssetTimeseries(target, options);
      // if we don't have any timeseries just return
      if (cache.getTimeseries(options, target).length === 0) {
        target.warning = '[WARNING] No timeseries found.';
        return [];
      }
      if (!target.expr) return [];
      // apply the search expression
      try {
        return parseExpression(
          target.expr,
          options,
          cache.getTimeseries(options, target),
          this.templateSrv,
          target
        );
      } catch (e) {
        target.error = e;
        return [];
      }
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

    // TODO (v1 migration)
    // if we want to keep supporting things like `event{assetSubtrees=[$VAL_WELLS]}`
    //  then we need to implement something here to get all the subassets, and then
    //  replace that filter with "assetIds": [list of ids]

    // use maxStartTime and minEndTime so that we include events that are partially in range
    const queryParams = {
      limit: 1000,
      maxStartTime: endTime,
      minEndTime: startTime,
      ...queryOptions.filters.reduce((obj, filter) => {
        obj[filter.property] = Utils.getFilterVal(filter.value);
        return obj;
      }, {}),
    };

    const result = await cache.getQuery(
      {
        url: `${this.url}/cogniteapi/${this.project}/events?${Utils.getQueryString(queryParams)}`,
        method: 'GET',
      },
      this.backendSrv
    );
    const events = result.data.data.items;
    if (!events || events.length === 0) return [];

    Utils.applyFilters(filterOptions.filters, events);

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

  public async getOptionsForDropdown(
    query: string,
    type?: string,
    options?: any
  ): Promise<MetricFindQueryResponse> {
    let urlEnd: string;
    let method: HttpMethod = 'GET';
    let postBody: any = {};
    if (type === Tab.Asset) {
      if (query.length === 0) {
        urlEnd = `/cogniteapi/${this.project}/assets?`;
      } else {
        urlEnd = `/cogniteapi/${this.project}/assets/search`;
        method = 'POST';
        // TODO (v1 migration)
        // assets/search doesn't support query yet
        // -> implement parallel calls to check for name and description, and then join results
        postBody = {
          search: {
            name: query,
          },
        };
      }
    } else if (type === Tab.Timeseries) {
      if (query.length === 0) {
        urlEnd = `/cogniteapi/${this.project}/timeseries?`;
      } else {
        urlEnd = `/cogniteapi/${this.project}/timeseries/search`;
        method = 'POST';
        postBody = {
          search: {
            query,
          },
        };
      }
    }
    if (options && method === 'GET') {
      urlEnd += `&${Utils.getQueryString(options)}`;
    }

    return cache
      .getQuery(
        {
          method,
          url: this.url + urlEnd,
          data: postBody || null,
        },
        this.backendSrv
      )
      .then((result: { data: TimeSeriesResponse }) =>
        result.data.items.map(timeSeriesResponseItem => ({
          text: timeSeriesResponseItem.description
            ? `${timeSeriesResponseItem.name} (${timeSeriesResponseItem.description})`
            : timeSeriesResponseItem.name,
          value:
            type === Tab.Asset ? String(timeSeriesResponseItem.id) : timeSeriesResponseItem.name,
        }))
      );
  }

  async findAssetTimeseries(target: QueryTarget, options: QueryOptions): Promise<void> {
    // replace variables with their values
    const assetId = this.templateSrv.replace(target.assetQuery.target, options.scopedVars);

    // first get the required assetIds
    let assetIds = [assetId];
    if (target.assetQuery.includeSubtrees) {
      assetIds = await this.getAssetSubassets(assetId, target);
    }
    // construct the search queries, limited to 100 assetIds per query
    const searchQueries: Partial<TimeseriesListQuery>[] = [];
    for (let i = 0; i < assetIds.length; i += 100) {
      searchQueries.push({
        assetIds: assetIds.slice(i, i + 100),
        limit: 1000,
      });
    }

    // for custom queries, use cache instead of storing in target object
    if (target.tab === Tab.Custom) {
      target.assetQuery.templatedTarget = assetId;
      const timeseries = cache.getTimeseries(options, target);
      if (!timeseries) {
        const promises = [];
        for (const searchQuery of searchQueries) {
          promises.push(this.getTimeseries(searchQuery, target));
        }
        const ts = _.flatten(await Promise.all(promises));
        cache.setTimeseries(
          options,
          target,
          ts.map(ts => {
            ts.selected = true;
            return ts;
          })
        );
      }
      return Promise.resolve();
    }
    // else target.tab === Tab.Asset

    // check if assetId has changed, if not we do not need to perform this query again
    if (
      target.assetQuery.old &&
      assetId === target.assetQuery.old.target &&
      target.assetQuery.includeSubtrees === target.assetQuery.old.includeSubtrees
    ) {
      return Promise.resolve();
    }
    target.assetQuery.old = {
      target: String(assetId),
      includeSubtrees: target.assetQuery.includeSubtrees,
    };

    // since /dataquery can only have 100 items and checkboxes become difficult to use past 100 items,
    //  we only get the first 100 timeseries, and show a warning if there are too many timeseries
    const promises = [];
    for (const searchQuery of searchQueries) {
      searchQuery.limit = 101;
      promises.push(this.getTimeseries(searchQuery, target));
    }
    const ts = _.flatten(await Promise.all(promises));
    if (ts.length >= 101) {
      target.warning =
        "[WARNING] Only showing first 100 timeseries. To get better results, either change the selected asset or use 'Custom Query'.";
      ts.splice(100);
    }
    target.assetQuery.timeseries = ts.map(ts => {
      ts.selected = true;
      return ts;
    });
  }

  async getTimeseries(
    searchQuery: Partial<TimeseriesListQuery>,
    target: QueryTarget
  ): Promise<TimeSeriesResponseItem[]> {
    let timeseries = [];
    try {
      do {
        const response = await cache.getQuery(
          {
            url: `${this.url}/cogniteapi/${this.project}/timeseries?${Utils.getQueryString(
              searchQuery
            )}`,
            method: 'GET',
          },
          this.backendSrv
        );
        timeseries = timeseries.concat(_.cloneDeep(response.data.items.filter(ts => !ts.isString)));
        // TODO: limit on how many timeseries to get?? - currently using 10000 as this was the 0.5 limit
        if (timeseries.length > 10000) {
          target.warning =
            '[WARNING] Fetching a lot of timeseries - not all timeseries might be returned (try choosing a deeper asset as the root).';
          return timeseries;
        }
        searchQuery.cursor = response.data.nextCursor;
      } while (searchQuery.cursor);
    } catch (error) {
      if (error.data && error.data.error) {
        target.error = `[${error.status} ERROR] ${error.data.error.message}`;
      } else {
        target.error = 'Unknown error';
      }
      return [];
    }

    return timeseries;
  }

  async getAssetSubassets(assetId: number, target: QueryTarget) {
    let assets = [assetId];
    let i = 0;
    while (i < assets.length) {
      const nextI = Math.min(i + 100, assets.length);
      const parentIds = assets.slice(i, nextI);
      const searchQuery = {
        parentIds,
        limit: 1000,
        cursor: undefined,
      };

      try {
        do {
          const response = await cache.getQuery(
            {
              url: `${this.url}/cogniteapi/${this.project}/assets?${Utils.getQueryString(
                searchQuery
              )}`,
              method: 'GET',
            },
            this.backendSrv,
            -1 // this is expensive, so let's keep it in cache
          );
          const subassets = response.data.items.map(asset => asset.id);
          assets = assets.concat(subassets);

          // TODO: limit on how many assets to get?? - currently using 10000 as this was the 0.5 limit
          if (assets.length > 10000) {
            target.warning =
              '[WARNING] Fetching a lot of subassets - limiting to 10000 assets (try choosing a deeper asset as the root).';
            return assets;
          }

          searchQuery.cursor = response.data.nextCursor;
        } while (searchQuery.cursor); // TODO: use better cursor endpoint when available
      } catch (error) {
        if (error.data && error.data.error) {
          target.error = `[${error.status} ERROR] ${error.data.error.message}`;
        } else {
          target.error = 'Unknown error';
        }
        return [];
      }

      i = nextI;
    }

    return assets;
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
    const urlEnd = `/cogniteapi/${this.project}/assets/search`;

    // TODO (v1 migration)
    // if we want to keep supporting things like `asset{assetSubtrees=[123456789]}`
    //  then we need to implement something here to get all the subassets, and then
    //  replace that filter with "parentIds": [list of ids]

    const queryParams: any = {
      limit: 1000,
      filter: {
        ...queryOptions.filters.reduce((obj, filter) => {
          obj[filter.property] = Utils.getFilterVal(filter.value);
          return obj;
        }, {}),
      },
      search: {},
    };

    for (const searchItem of ['query', 'name', 'description']) {
      if (searchItem in queryParams.filter) {
        queryParams.search[searchItem] = queryParams.filter[searchItem];
        delete queryParams.filter[searchItem];
      }
    }

    const result = await cache.getQuery(
      {
        url: this.url + urlEnd,
        data: queryParams,
        method: 'POST',
      },
      this.backendSrv
    );

    const assets = result.data.items;

    // now filter over these assets with the rest of the filters
    Utils.applyFilters(filterOptions.filters, assets);
    const filteredAssets = assets.filter(asset => asset.selected === true);

    return filteredAssets.map(asset => ({
      text: asset.name,
      value: asset.id,
    }));
  }

  private getTimeseriesLabel(label: string, timeseries: TimeSeriesResponseItem): string {
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
      });
  }
}
