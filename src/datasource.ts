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
  DataQueryAlias,
  DataQueryError,
  DataQueryRequest,
  DataQueryRequestItem,
  DataQueryRequestResponse,
  Filter,
  FilterOptions,
  FilterType,
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
} from './types';

export default class CogniteDatasource {
  id: number;
  url: string;
  name: string;
  project: string;
  q: any;

  /** @ngInject */
  constructor(
    instanceSettings: CogniteDataSourceSettings,
    private $q: any,
    private backendSrv: BackendSrv,
    private templateSrv: TemplateSrv
  ) {
    this.id = instanceSettings.id;
    this.url = instanceSettings.url;
    this.project = instanceSettings.jsonData.cogniteProject;
    this.q = $q;
    this.name = instanceSettings.name;
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
        // this.filterOnAssetTimeseries(target, options); // apply the search expression
        if (!target.expr) return [];
        return parseExpression(
          target.expr,
          options,
          target.assetQuery.timeseries,
          this.templateSrv
        );
      }
      let breakEarly = false;
      return target.assetQuery.timeseries.slice(0).reduce((queries, ts) => {
        if (!ts.selected || breakEarly) {
          return queries;
        }
        const query: DataQueryRequestItem = {
          name: ts.name,
        };
        if (target.tab === Tab.Custom && target.assetQuery.func) {
          query.function = target.assetQuery.func;
          // we break early if we are only doing a special function (function that combines many timeseries into one)
          breakEarly =
            this.createSpecialFunctionString(target, query) &&
            !/.*\[ID.*?\]/.test(target.assetQuery.func);

          query.function = query.function.replace(/ID/g, String(ts.id));

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
              alias.granularity = aliasParts[2] || Utils.intervalToGranularity(options.intervalMs);
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

  // returns whether or not a special function was found, replaces any special functions in query.function
  private createSpecialFunctionString(target: QueryTarget, query: DataQueryRequestItem) {
    let specialFunctionFound: boolean = false;
    if (/.*\[SUM.*\].*/.test(target.assetQuery.func)) {
      // construct sum string
      const selectedTs = target.assetQuery.timeseries.filter(ts => ts.selected);
      const regexMatches = query.function.match(/\[SUM.*?\]/g);
      for (const match of regexMatches) {
        let sumString = '(';
        const aliasParts = match
          .substr(1, match.length - 2)
          .split(',')
          .filter(string => string.length)
          .map(x => _.trim(x, ' \'"'));
        if (aliasParts.length === 1) {
          sumString += `[${selectedTs.map(ts => ts.id).join('] + [')}])`;
        } else {
          sumString += `[${selectedTs
            .map(ts => `${ts.id},${aliasParts[1]},${aliasParts[2] || ''}`)
            .join('] + [')}])`;
        }
        query.function = query.function.replace(match, sumString);
      }
      specialFunctionFound = true;
    }
    if (/.*\[(MAX|MIN|AVG).*\].*/.test(target.assetQuery.func)) {
      const selectedTs = target.assetQuery.timeseries.filter(ts => ts.selected);
      const regexMatches = query.function.match(/\[(MAX|MIN|AVG).*?\]/g);
      for (const match of regexMatches) {
        const aliasParts = match
          .substr(1, match.length - 2)
          .split(',')
          .filter(string => string.length)
          .map(x => _.trim(x, ' \'"'));
        let sumString = `${aliasParts[0]}(`;
        if (aliasParts.length === 1) {
          sumString += `[${selectedTs.map(ts => ts.id).join('],[')}])`;
        } else {
          sumString += `[${selectedTs
            .map(ts => `${ts.id},${aliasParts[1]},${aliasParts[2] || ''}`)
            .join('],[')}])`;
        }
        query.function = query.function.replace(match, sumString);
      }
      specialFunctionFound = true;
    }
    return specialFunctionFound;
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
          queryReq.granularity = Utils.intervalToGranularity(options.intervalMs);
        } else {
          queryReq.granularity = target.granularity;
        }
      }
      if (target.tab === Tab.Custom) {
        // if (queryReq.aggregates) {
        //   target.error =
        //     '[ERROR] To use aggregations with functions, use [ID,aggregation,granularity] or [ID,aggregation]';
        //   targetQueriesCount.pop();
        //   continue;
        // }
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
            const ts = await this.getTimeseries(
              {
                q: target.target,
                limit: 1,
              },
              target
            );
            labels.push(this.getTimeseriesLabel(target.label, ts[0]));
          } catch {
            labels.push(target.label);
          }
        } else {
          labels.push(target.label);
        }
      } else {
        let count = 0;
        target.assetQuery.timeseries.forEach(ts => {
          if (ts.selected && count < queryList.length) {
            count += 1;
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
          count += targetQueriesCount[i].count; // skip over these labels
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

  // this function is for getting metrics (template variables)
  async metricFindQuery(query: VariableQueryData): Promise<MetricFindQueryResponse> {
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

  async findAssetTimeseries(target: QueryTarget, options: QueryOptions): Promise<void> {
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
    target.assetQuery.old = {
      target: String(assetId),
      includeSubtrees: target.assetQuery.includeSubtrees,
    };

    const searchQuery: Partial<TimeseriesSearchQuery> = {
      path: target.assetQuery.includeSubtrees ? [assetId] : undefined,
      assetId: !target.assetQuery.includeSubtrees ? assetId : undefined,
      limit: 10000,
    };

    const ts = await this.getTimeseries(searchQuery, target);
    target.assetQuery.timeseries = ts.map(ts => {
      ts.selected = true;
      return ts;
    });
  }

  async getTimeseries(
    searchQuery: Partial<TimeseriesSearchQuery>,
    target: QueryTarget
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
      .then(
        (result: { data: TimeSeriesResponse }) => {
          return _.cloneDeep(result.data.data.items.filter(ts => !ts.isString));
        },
        error => {
          if (error.data && error.data.error) {
            target.error = `[${error.status} ERROR] ${error.data.error.message}`;
          } else {
            target.error = 'Unknown error';
          }
          return [];
        }
      );
  }

  filterOnAssetTimeseries(target: QueryTarget, options: QueryOptions): void {
    const filterOptions = parse(target.expr, ParseType.Timeseries, this.templateSrv, options);
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

    Utils.applyFilters(filterOptions.filters, target.assetQuery.timeseries);

    target.aggregation = filterOptions.aggregation;
    target.granularity = filterOptions.granularity;
  }

  async getAssetsForMetrics(query: VariableQueryData): Promise<MetricFindQueryResponse> {
    const queryOptions = parse(query.query, ParseType.Asset, this.templateSrv);
    if (queryOptions.error) {
      return [{ text: queryOptions.error, value: '-' }];
    }
    const filterOptions = parse(query.filter, ParseType.Asset, this.templateSrv);
    if (query.filter && filterOptions.error) {
      return [{ text: filterOptions.error, value: '-' }];
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
