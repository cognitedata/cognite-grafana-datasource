import { chunk, get, cloneDeep } from 'lodash';
import { parse as parseDate } from 'grafana/app/core/utils/datemath';
import { reduceToMap, applyFilters, getRequestId } from './utils';
import cache from './cache';
import { parseExpression, parse } from './parser';
import { BackendSrv } from 'grafana/app/core/services/backend_srv';
import { TemplateSrv } from 'grafana/app/features/templating/template_srv';
import {
  AnnotationQueryOptions,
  AnnotationResponse,
  CogniteDataSourceSettings,
  DataQueryError,
  DataQueryRequestItem,
  DataQueryRequestResponse,
  MetricFindQueryResponse,
  ParseType,
  QueryOptions,
  QueryResponse,
  QueryTarget,
  Tab,
  TimeSeriesResponseItem,
  VariableQueryData,
  HttpMethod,
} from './types';
import {
  filterEmptyQueryTargets,
  formQueriesForTargets,
  fetchData,
  fetchItems,
  getTimeseries,
  reduceTimeseries,
} from './cdfDatasource';

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
    const { id, url, jsonData, name } = instanceSettings;
    this.id = id;
    this.url = url;
    this.name = name;
    this.project = jsonData.cogniteProject;
  }

  /**
   * used by panels to get timeseries data
   */
  public async query(options: QueryOptions): Promise<QueryResponse> {
    const queryTargets = filterEmptyQueryTargets(options.targets);

    if (queryTargets.length === 0) {
      return Promise.resolve({ data: [] });
    }

    const timeFrom = Math.ceil(parseDate(options.range.from));
    const timeTo = Math.ceil(parseDate(options.range.to));
    const targetQueriesCount = [];

    const queryRequestPromises: Promise<DataQueryRequestItem[]>[] = queryTargets.map(target =>
      this.getDataQueryRequestItems(target, options)
    );
    const queryItems = await Promise.all(queryRequestPromises);

    const [queries, labels] = await formQueriesForTargets(
      queryTargets,
      queryItems,
      timeFrom,
      timeTo,
      targetQueriesCount,
      options,
      this.url,
      this.project,
      this.backendSrv
    );

    // replace variables in labels as well
    const resLabels: string[][][] = labels.map(r =>
      r.map(l => this.templateSrv.replace(l, options.scopedVars))
    );

    const queryRequests = queries.map(async (data, i) => {
      const isSynthetic = data.items.some(q => !!q.expression);
      try {
        const response = await fetchData(
          {
            data,
            path: `/timeseries/${isSynthetic ? 'synthetic/query' : 'data/list'}`,
            method: HttpMethod.POST,
            requestId: getRequestId(options, queryTargets[queries.findIndex(x => x === data)]),
            playground: isSynthetic,
          },
          this.url,
          this.project,
          this.backendSrv
        );
        return {
          ...response,
          labels: resLabels[i],
        };
      } catch (error) {
        return { error } as any;
      }
    });

    let timeseries: (DataQueryRequestResponse | DataQueryError)[];
    try {
      timeseries = await Promise.all(queryRequests);
    } catch (error) {
      timeseries = [];
    }
    return {
      data: reduceTimeseries(timeseries, targetQueriesCount, queryTargets, timeFrom, timeTo),
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
      target.error = e.message;
    }
    return [];
  }

  /**
   * used by dashboards to get annotations (events)
   */
  public async annotationQuery(options: AnnotationQueryOptions): Promise<AnnotationResponse[]> {
    const { range, annotation } = options;
    const { expr, filter, error } = annotation;
    const startTime = Math.ceil(parseDate(range.from));
    const endTime = Math.ceil(parseDate(range.to));
    if (error || !expr) return [];

    const queryOptions = parse(expr, ParseType.Event, this.templateSrv);
    const filterOptions = filter
      ? parse(filter, ParseType.Event, this.templateSrv)
      : { filters: [] };

    // use max startTime and min endTime so that we include events that are partially in range
    const filterQuery = {
      startTime: { max: endTime },
      endTime: { min: startTime },
      ...reduceToMap(queryOptions.filters),
    };

    const items = await fetchItems<any>(
      {
        path: `/events/list`,
        method: HttpMethod.POST,
        data: {
          filter: filterQuery,
          limit: 1000,
        },
      },
      this.url,
      this.project,
      this.backendSrv
    );
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

  /**
   * used by query editor to search for assets/timeseries
   */
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

    const items = await fetchItems<TimeSeriesResponseItem>(
      {
        data,
        path: `/${resources[type]}/search`,
        method: HttpMethod.POST,
        params: options,
      },
      this.url,
      this.project,
      this.backendSrv
    );

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
        const ts = await getTimeseries(
          filterQuery,
          target,
          this.url,
          this.project,
          this.backendSrv
        );
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
    const ts = await getTimeseries(filterQuery, target, this.url, this.project, this.backendSrv);
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

  /**
   * used by query editor to get metric suggestions (template variables)
   */
  async metricFindQuery({ query, filter }: VariableQueryData): Promise<MetricFindQueryResponse> {
    const queryOptions = parse(query, ParseType.Asset, this.templateSrv);
    const filterOptions = filter
      ? parse(filter, ParseType.Asset, this.templateSrv)
      : { filters: [] };

    const assets = await fetchItems<any>(
      {
        path: `/assets/search`,
        method: HttpMethod.POST,
        data: {
          search: reduceToMap(queryOptions.filters),
          limit: 1000,
        },
      },
      this.url,
      this.project,
      this.backendSrv
    );

    // now filter over these assets with the rest of the filters
    applyFilters(filterOptions.filters, assets);

    return assets
      .filter(({ selected }) => selected)
      .map(({ name, id }) => ({
        text: name,
        value: id,
      }));
  }

  /**
   * used by data source configuration page to make sure the connection is working
   */
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
