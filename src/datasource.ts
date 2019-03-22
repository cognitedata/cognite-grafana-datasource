import _ from 'lodash';
import * as dateMath from 'grafana/app/core/utils/datemath';
import Utils from './utils';
import cache from './cache';
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

    if (target.tab === Tab.Asset) {
      await this.findAssetTimeseries(target, options);
      return target.assetQuery.timeseries.reduce((queries, ts) => {
        if (!ts.selected) {
          return queries;
        }
        return queries.concat({ name: ts.name });
      }, []);
    }

    if (target.tab === Tab.Custom) {
      await this.findAssetTimeseries(target, options);

      // apply the search expression
      this.filterOnAssetTimeseries(target, options);

      return cache.getTimeseries(options, target).reduce((queries, ts) => {
        if (!ts.selected) {
          return queries;
        }
        const query: DataQueryRequestItem = {
          name: ts.name,
        };
        if (target.assetQuery.func) {
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
    const labels = [];

    const dataQueryRequestPromises: Promise<DataQueryRequestItem[]>[] = [];
    for (const target of queryTargets) {
      dataQueryRequestPromises.push(this.getDataQueryRequestItems(target, options));
    }
    const dataQueryRequestItems = await Promise.all(dataQueryRequestPromises);

    const queries: DataQueryRequest[] = [];
    for (let { target, queryList } of dataQueryRequestItems.map((ql, i) => ({
      target: queryTargets[i],
      queryList: ql,
    }))) {
      if (queryList.length === 0 || target.error) {
        continue;
      }

      // /dataquery is limited to 100 items, so we need to add new calls if we go over 100 items
      while (queryList.length > 0) {
        const slicedQl = queryList.slice(0, 100); // only get first 100 items

        // keep track of target lengths so we can assign errors later
        targetQueriesCount.push({
          refId: target.refId,
          count: slicedQl.length,
        });
        // create query requests
        const queryReq: DataQueryRequest = {
          items: slicedQl,
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
          for (const q of slicedQl) {
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
          const usesAggregations = slicedQl.some(item => item.aliases.length > 0);

          queryReq.limit = Math.floor((usesAggregations ? 10_000 : 100_000) / ids);
        } else {
          queryReq.limit = Math.floor((queryReq.aggregates ? 10_000 : 100_000) / slicedQl.length);
        }
        queries.push(queryReq);
        queryList = queryList.slice(100); // get the rest of the items
      }
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
      } else if (target.tab === Tab.Asset) {
        target.assetQuery.timeseries.forEach(ts => {
          if (ts.selected) {
            if (!target.label) target.label = '';
            labels.push(this.getTimeseriesLabel(target.label, ts));
          }
        });
      } else {
        cache.getTimeseries(options, target).forEach(ts => {
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

  public async annotationQuery(options: AnnotationQueryOptions): Promise<AnnotationResponse[]> {
    const { range, annotation } = options;
    const { expr, filter, error } = annotation;
    const startTime = Math.ceil(dateMath.parse(range.from));
    const endTime = Math.ceil(dateMath.parse(range.to));
    if (error || !expr) return [];

    const queryOptions = this.parse(expr, ParseType.Event);
    if (queryOptions.error) {
      console.error(queryOptions.error);
      return [];
    }
    const filterOptions = this.parse(filter || '', ParseType.Event);
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
        urlEnd = `/cogniteapi/${this.project}/timeseries?`;
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
    const searchQuery: Partial<TimeseriesSearchQuery> = {
      path: target.assetQuery.includeSubtrees ? [assetId] : undefined,
      assetId: !target.assetQuery.includeSubtrees ? assetId : undefined,
      limit: 10000,
    };

    // for custom queries, use cache instead of storing in target object
    if (target.tab === Tab.Custom) {
      target.assetQuery.templatedTarget = assetId;
      const timeseries = cache.getTimeseries(options, target);
      if (!timeseries) {
        const ts = await this.getTimeseries(searchQuery, target);
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
    searchQuery.limit = 101;
    const ts = await this.getTimeseries(searchQuery, target);
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

    this.applyFilters(filterOptions.filters, cache.getTimeseries(options, target));

    target.aggregation = filterOptions.aggregation;
    target.granularity = filterOptions.granularity;
  }

  async getAssetsForMetrics(query: VariableQueryData): Promise<MetricFindQueryResponse> {
    const queryOptions = this.parse(query.query, ParseType.Asset);
    if (queryOptions.error) {
      return [{ text: queryOptions.error, value: '-' }];
    }
    const filterOptions = this.parse(query.filter, ParseType.Asset);
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
    this.applyFilters(filterOptions.filters, assets);
    const filteredAssets = assets.filter(asset => asset.selected === true);

    return filteredAssets.map(asset => ({
      text: asset.name,
      value: asset.id,
    }));
  }

  parse(customQuery: string, type: ParseType, options?: QueryOptions): FilterOptions {
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
      if ((i = f.indexOf(FilterType.RegexEquals)) > -1) {
        filter.property = _.trim(f.substr(0, i), ' \'"');
        filter.value = _.trim(f.substr(i + 2), ' \'"');
        filter.type = FilterType.RegexEquals;
      } else if ((i = f.indexOf(FilterType.RegexNotEquals)) > -1) {
        filter.property = _.trim(f.substr(0, i), ' \'"');
        filter.value = _.trim(f.substr(i + 2), ' \'"');
        filter.type = FilterType.RegexNotEquals;
      } else if ((i = f.indexOf(FilterType.NotEquals)) > -1) {
        filter.property = _.trim(f.substr(0, i), ' \'"');
        filter.value = _.trim(f.substr(i + 2), ' \'"');
        filter.type = FilterType.NotEquals;
      } else if ((i = f.indexOf(FilterType.Equals)) > -1) {
        filter.property = _.trim(f.substr(0, i), ' \'"');
        filter.value = _.trim(f.substr(i + 1), ' \'"');
        filter.type = FilterType.Equals;
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

  private applyFilters(filters: Filter[], objects: any): void {
    for (const obj of objects) {
      obj.selected = true;
      for (const filter of filters) {
        if (filter.type === FilterType.RegexEquals) {
          const val = _.get(obj, filter.property);
          const regex = `^${filter.value}$`;
          if (val === undefined || !val.match(regex)) {
            obj.selected = false;
            break;
          }
        } else if (filter.type === FilterType.RegexNotEquals) {
          const val = _.get(obj, filter.property);
          const regex = `^${filter.value}$`;
          if (val === undefined || val.match(regex)) {
            obj.selected = false;
            break;
          }
        } else if (filter.type === FilterType.NotEquals) {
          const val = _.get(obj, filter.property);
          if (val === undefined || String(val) === filter.value) {
            obj.selected = false;
            break;
          }
        } else if (filter.type === FilterType.Equals) {
          const val = _.get(obj, filter.property);
          if (val === undefined || String(val) !== filter.value) {
            obj.selected = false;
            break;
          }
        }
      }
    }
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
