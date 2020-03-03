import { parse as parseDate } from 'grafana/app/core/utils/datemath';
import { getRequestId, applyFilters } from './utils';
import cache from './cache';
import { parse } from './query-parser';
import { BackendSrv } from 'grafana/app/core/services/backend_srv';
import { TemplateSrv } from 'grafana/app/features/templating/template_srv';
import {
  CogniteDataSourceSettings,
  DataQueryRequestItem,
  DataQueryRequestResponse,
  MetricFindQueryResponse,
  QueryOptions,
  QueryResponse,
  QueryTarget,
  Tab,
  TimeSeriesResponseItem,
  VariableQueryData,
  HttpMethod,
  DataQueryRequest,
  ResponseMetadata,
  isError,
  Tuple,
  MetaResponses,
  FailResponse,
  SuccessResponse,
  InputQueryTarget,
  AnnotationResponse,
  AnnotationQueryOptions,
} from './types';
import { FilterRequest, AssetsFilterRequestParams, EventsFilterRequestParams } from './api-types';
import {
  formQueriesForTargets,
  getTimeseries,
  reduceTimeseries,
  formMetadatasForTargets,
  promiser,
} from './cdfDatasource';
import { Connector } from './connector';
import { TimeRange } from '@grafana/ui';
import { ParsedFilter, ParserResponse, QueryCondition } from './query-parser/types';
const { Asset, Custom, Timeseries } = Tab;

export default class CogniteDatasource {
  project: string;
  connector: Connector;

  /** @ngInject */
  constructor(
    instanceSettings: CogniteDataSourceSettings,
    backendSrv: BackendSrv,
    private templateSrv: TemplateSrv
  ) {
    const { url, jsonData } = instanceSettings;
    this.project = jsonData.cogniteProject;
    this.connector = new Connector(jsonData.cogniteProject, url, backendSrv);
  }

  /**
   * used by panels to get timeseries data
   */
  public async query(options: QueryOptions): Promise<QueryResponse> {
    const queryTargets = filterEmptyQueryTargets(options.targets);
    let responseData = [];

    if (queryTargets.length) {
      try {
        const { failed, succeded } = await this.fetchTimeseriesForTargets(queryTargets, options);
        handleFailedTargets(failed);
        showTooMuchDatapointsWarningIfNeeded(succeded);
        responseData = reduceTimeseries(succeded, getRange(options.range));
      } catch (error) {
        console.log(error); // not sure it ever happens
      }
    }

    return { data: responseData };
  }

  public async fetchTimeseriesForTargets(
    queryTargets: QueryTarget[],
    options: QueryOptions
  ): Promise<MetaResponses> {
    const itemsForTargetsPromises = queryTargets.map(async target => {
      try {
        const items = await this.getDataQueryRequestItems(target, options);
        return { items, target };
      } catch (e) {
        target.error = e.message;
      }
    });
    const queryData = await Promise.all(itemsForTargetsPromises);
    const filteredQueryData = queryData.filter(data => data && data.items && data.items.length);

    const queries = formQueriesForTargets(filteredQueryData, options);
    const metadatas = await formMetadatasForTargets(
      filteredQueryData,
      options,
      this.connector,
      this.templateSrv
    );

    return promiser<DataQueryRequest, ResponseMetadata, DataQueryRequestResponse>(
      queries,
      metadatas,
      async (data, { target }) => {
        const isSynthetic = data.items.some(q => !!q.expression);
        return this.connector.chunkAndFetch<DataQueryRequest, DataQueryRequestResponse>({
          data,
          path: `/timeseries/${isSynthetic ? 'synthetic/query' : 'data/list'}`,
          method: HttpMethod.POST,
          requestId: getRequestId(options, target),
          playground: isSynthetic,
        });
      }
    );
  }

  private async getDataQueryRequestItems(
    target: QueryTarget,
    options: QueryOptions
  ): Promise<DataQueryRequestItem[]> {
    switch (target.tab) {
      case undefined:
      case Timeseries: {
        return [{ id: target.target }];
      }
      case Asset: {
        await this.findAssetTimeseries(target, options);
        return target.assetQuery.timeseries.filter(ts => ts.selected).map(({ id }) => ({ id }));
      }
    }
    return [];
  }

  private replaceVariable(query: string): string {
    return this.templateSrv.replace(query);
  }

  /**
   * used by dashboards to get annotations (events)
   */
  public async annotationQuery(options: AnnotationQueryOptions): Promise<AnnotationResponse[]> {
    const {
      range,
      annotation,
      annotation: { query, error },
    } = options;
    const [startTime, endTime] = getRange(range);
    let response = [];

    if (error || !query) {
      return response;
    }

    const replacedVariablesQuery = this.replaceVariable(query);

    const { filters, params } = parse(replacedVariablesQuery);
    const timeFrame = {
      startTime: { max: endTime },
      endTime: { min: startTime },
    };
    const data: FilterRequest<EventsFilterRequestParams> = {
      filter: { ...params, ...timeFrame },
      limit: 1000,
    };

    const items = await this.connector.fetchItems<any>({
      data,
      path: `/events/list`,
      method: HttpMethod.POST,
    });

    if (items && items.length) {
      response = applyFilters(items, filters).map(({ description, startTime, endTime, type }) => ({
        annotation,
        isRegion: true,
        text: description,
        time: startTime,
        timeEnd: endTime,
        title: type,
      }));
    }

    return response;
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

    const items = await this.connector.fetchItems<TimeSeriesResponseItem>({
      data,
      path: `/${resources[type]}/search`,
      method: HttpMethod.POST,
      params: options,
    });

    return items.map(({ name, externalId, id, description }) => {
      const displayName = name || externalId;
      return {
        text: description ? `${displayName} (${description})` : displayName,
        value: type === Tab.Timeseries ? id : id.toString(),
      };
    });
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

    // for custom queries, use cache instead of storing in target object
    if (target.tab === Tab.Custom) {
      target.assetQuery.templatedTarget = assetId;
      const timeseries = cache.getTimeseries(options, target);
      if (!timeseries) {
        const limit = 10000; // 0.5 used to give this many. we keep it for now
        const ts = await getTimeseries({ filter, limit }, target, this.connector);
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
    const limit = 101;
    const ts = await getTimeseries({ filter, limit }, target, this.connector);
    if (ts.length === limit) {
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
  async metricFindQuery({ query }: VariableQueryData): Promise<MetricFindQueryResponse> {
    let params: QueryCondition;
    let filters: ParsedFilter[];

    try {
      ({ params, filters } = parse(query));
    } catch (e) {
      return [];
    }

    const data: FilterRequest<AssetsFilterRequestParams> = {
      filter: params,
      limit: 1000,
    };

    const assets = await this.connector.fetchItems<any>({
      data,
      path: `/assets/list`,
      method: HttpMethod.POST,
    });

    const filteredAssets = applyFilters(assets, filters);

    return filteredAssets.map(({ name, id }) => ({
      text: name,
      value: id,
    }));
  }

  /**
   * used by data source configuration page to make sure the connection is working
   */
  async testDatasource() {
    const { status, data } = await this.connector.request({ path: 'cogniteloginstatus' });

    if (status === 200) {
      if (data.data.loggedIn && data.data.project === this.project) {
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

export function filterEmptyQueryTargets(targets: InputQueryTarget[]): QueryTarget[] {
  // we cannot just map them because it's used for visual feedback
  // TODO: fix it when we move to react?
  targets.forEach(target => {
    if (target) {
      target.error = '';
      target.warning = '';
    }
  });

  return targets.filter(target => {
    if (!target || target.hide) return;

    const { tab, target: tsTarget, assetQuery } = target;

    return !!(tab === Asset || tab === Custom ? assetQuery && assetQuery.target : tsTarget);
  }) as QueryTarget[];
}

function handleFailedTargets(failed: FailResponse<ResponseMetadata>[]) {
  failed
    .filter(isError)
    .filter(({ error }) => !error.cancelled) // if response was cancelled, no need to show error message
    .forEach(({ error, metadata }) => {
      let errmsg: string;
      if (error.data && error.data.error) {
        errmsg = `[${error.status} ERROR] ${error.data.error.message}`;
      } else {
        errmsg = 'Unknown error';
      }
      metadata.target.error = errmsg;
    });
}

export function getRange(range: TimeRange): Tuple<number> {
  const timeFrom = Math.ceil(parseDate(range.from));
  const timeTo = Math.ceil(parseDate(range.to));
  return [timeFrom, timeTo];
}

function showTooMuchDatapointsWarningIfNeeded(
  responses: SuccessResponse<ResponseMetadata, DataQueryRequestResponse>[]
) {
  responses.forEach(({ result, metadata }) => {
    const limit = result.config.data.limit;
    const items = result.data.items;
    const hasMorePoints = items.some(({ datapoints }) => datapoints.length >= limit);
    if (hasMorePoints) {
      metadata.target.warning =
        '[WARNING] Datapoints limit was reached, so not all datapoints may be shown. Try increasing the granularity, or choose a smaller time range.';
    }
  });
}
