import { BackendSrv, getTemplateSrv } from '@grafana/runtime';
import {
  TimeRange,
  DataSourceApi,
  DataSourceInstanceSettings,
  DataQueryRequest,
} from '@grafana/data';
import { getRequestId, applyFilters, toGranularityWithLowerBound } from './utils';
import { parse as parseQuery } from './parser/events-assets';
import { formQueriesForExpression } from './parser/ts';
import {
  CogniteDataSourceSettings,
  DataQueryRequestItem,
  DataQueryRequestResponse,
  MetricFindQueryResponse,
  QueryOptions,
  QueryResponse,
  QueryTarget,
  Tab,
  VariableQueryData,
  HttpMethod,
  CDFDataQueryRequest,
  ResponseMetadata,
  isError,
  Tuple,
  Responses,
  FailResponse,
  SuccessResponse,
  InputQueryTarget,
  AnnotationResponse,
  AnnotationQueryOptions,
  MyQuery,
  MyDataSourceOptions,
  defaultQuery,
} from './types';
import {
  TimeSeriesResponseItem,
  FilterRequest,
  AssetsFilterRequestParams,
  EventsFilterRequestParams,
} from './cdf/types';
import {
  formQueriesForTargets,
  getTimeseries,
  reduceTimeseries,
  promiser,
  getLimitsWarnings,
  getCalculationWarnings,
  datapointsPath,
  stringifyError,
  getLabelsForTarget,
} from './cdf/client';
import { Connector } from './connector';
import { ParsedFilter, QueryCondition } from './parser/types';
import { datapointsWarningEvent, failedResponseEvent, TIMESERIES_LIMIT_WARNING } from './constants';

export default class CogniteDatasource extends DataSourceApi<MyQuery, MyDataSourceOptions> {
  /**
   * Parameters that are needed by grafana
   */
  baseUrl: string;

  /*
  id: number;
  url: string;
  name: string;
  */
  project: string;
  connector: Connector;

  constructor(instanceSettings: DataSourceInstanceSettings<MyDataSourceOptions>) {
    super(instanceSettings);

    this.baseUrl = instanceSettings.url!;
  }

  /** @ngInject
  constructor(
    instanceSettings: CogniteDataSourceSettings,
    backendSrv: BackendSrv,
    private templateSrv: TemplateSrv
  ) {
    this.id = instanceSettings.id;
    this.url = instanceSettings.url;
    this.name = instanceSettings.name;
    const { url, jsonData } = instanceSettings;
    this.project = jsonData.cogniteProject;
    this.connector = new Connector(jsonData.cogniteProject, url, backendSrv);
  } */

  /**
   * used by panels to get timeseries data
   */
  async query(options: DataQueryRequest<MyQuery>): Promise<QueryResponse> {
    const queryTargets = filterEmptyQueryTargets(options.targets);
    let responseData = [];

    if (queryTargets.length) {
      try {
        const { failed, succeded } = await this.fetchTimeseriesForTargets(queryTargets, options);
        handleFailedTargets(failed);
        showWarnings(succeded);
        responseData = reduceTimeseries(succeded, getRange(options.range));
      } catch (error) {
        throw new Error('Internal error: should not happen');
      }
    }

    return { data: responseData };
  }

  async fetchTimeseriesForTargets(
    queryTargets: QueryTarget[],
    options: QueryOptions
  ): Promise<Responses> {
    const itemsForTargetsPromises = queryTargets.map(async (target) => {
      let items: DataQueryRequestItem[];
      try {
        items = await this.getDataQueryRequestItems(target, options);
      } catch (e) {
        handleError(e, target.refId);
      }
      return { items, target };
    });

    const queryData = (await Promise.all(itemsForTargetsPromises)).filter(
      (data) => data?.items?.length
    );

    const queries = formQueriesForTargets(queryData, options);
    const metadata = await Promise.all(
      queryData.map(async ({ target, items }) => {
        let labels = [];
        try {
          labels = (await getLabelsForTarget(target, items, this.connector)).map((label) =>
            CogniteDatasource.replaceVariable(label, options.scopedVars)
          );
        } catch (err) {
          handleError(err, target.refId);
        }
        return { target, labels };
      })
    );

    const proxy = async (data, { target }) => {
      const isSynthetic = data.items.some((q) => !!q.expression);
      const chunkSize = isSynthetic ? 10 : 100;

      return this.connector.chunkAndFetch<CDFDataQueryRequest, DataQueryRequestResponse>(
        {
          data,
          path: datapointsPath(isSynthetic),
          method: HttpMethod.POST,
          requestId: getRequestId(options, target),
        },
        chunkSize
      );
    };
    return promiser(queries, metadata, proxy);
  }

  private async getDataQueryRequestItems(
    target: QueryTarget,
    options: QueryOptions
  ): Promise<DataQueryRequestItem[]> {
    const { tab, target: tsId, assetQuery, expr } = target;
    switch (tab) {
      default:
      case undefined:
      case Tab.Timeseries: {
        return [{ id: tsId }];
      }
      case Tab.Asset: {
        const timeseries = await this.findAssetTimeseries(target, options);
        return timeseries.map(({ id }) => ({ id }));
      }
      case Tab.Custom: {
        const templatedExpr = CogniteDatasource.replaceVariable(expr, options.scopedVars);
        const defaultInterval = toGranularityWithLowerBound(options.intervalMs);
        return formQueriesForExpression(templatedExpr, target, this.connector, defaultInterval);
      }
    }
  }

  static replaceVariable(query: string, scopedVars?): string {
    return getTemplateSrv().replace(query.trim(), scopedVars);
  }

  /**
   * used by dashboards to get annotations (events)
   */
  /*
  async annotationQuery(options: AnnotationQueryOptions): Promise<AnnotationResponse[]> {
    const {
      range,
      annotation,
      annotation: { query, error },
    } = options;
    const [startTime, endTime] = getRange(range);

    if (error || !query) {
      return [];
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
      method: POST,
    });
    const response = applyFilters(items, filters);

    return response.map(({ description, startTime, endTime, type }) => ({
      annotation,
      isRegion: true,
      text: description,
      time: startTime,
      timeEnd: endTime,
      title: type,
    }));
  }
  */
  /**
   * used by query editor to search for assets/timeseries
   */
  async getOptionsForDropdown(
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
        value: id.toString(),
      };
    });
  }

  async findAssetTimeseries(
    { refId, assetQuery }: QueryTarget,
    { scopedVars }: QueryOptions
  ): Promise<TimeSeriesResponseItem[]> {
    const assetId = CogniteDatasource.replaceVariable(assetQuery.target, scopedVars);
    const filter = assetQuery.includeSubtrees
      ? {
          assetSubtreeIds: [{ id: Number(assetId) }],
        }
      : {
          assetIds: [assetId],
        };

    // since /dataquery can only have 100 items and checkboxes become difficult to use past 100 items,
    //  we only get the first 100 timeseries, and show a warning if there are too many timeseries
    const limit = 101;
    const ts = await getTimeseries({ filter, limit }, this.connector);
    if (ts.length === limit) {
      // appEvents.emit(datapointsWarningEvent, {
      //  refId,
      //  warning: TIMESERIES_LIMIT_WARNING,
      // });

      ts.splice(-1);
    }
    return ts;
  }

  /**
   * used by query editor to get metric suggestions (template variables)
   */
  async metricFindQuery({ query }: VariableQueryData): Promise<MetricFindQueryResponse> {
    let params: QueryCondition;
    let filters: ParsedFilter[];

    try {
      ({ params, filters } = parseQuery(query));
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

    throw Error('Did not get 200 OK');
  }
}

export function filterEmptyQueryTargets(targets: InputQueryTarget[]): QueryTarget[] {
  return targets.filter((target) => {
    if (target && !target.hide) {
      const { tab, assetQuery } = target;
      switch (tab) {
        case Tab.Asset:
          return assetQuery && assetQuery.target;
        case Tab.Custom:
          return target.expr;
        case Tab.Timeseries:
        case undefined:
        default:
          return target.target;
      }
    }
    return target.target;
  }) as QueryTarget[];
}

function handleFailedTargets(failed: FailResponse[]) {
  failed
    .filter(isError)
    .filter(({ error }) => !error.cancelled) // if response was cancelled, no need to show error message
    .forEach(({ error, metadata }) => handleError(error, metadata.target.refId));
}

export function getRange(range: TimeRange): Tuple<number> {
  const timeFrom = Math.ceil(range.from.unix());
  const timeTo = Math.ceil(range.to.unix());
  return [timeFrom, timeTo];
}

function handleError(error: any, refId: string) {
  const errMessage = stringifyError(error);
  // appEvents.emit(failedResponseEvent, { refId, error: errMessage });
}

function showWarnings(responses: SuccessResponse[]) {
  responses.forEach(({ result, metadata }) => {
    const { items } = result.data;
    const { limit } = result.config.data;
    const { refId } = metadata.target;
    const warning = [getLimitsWarnings(items, limit), getCalculationWarnings(items)]
      .filter(Boolean)
      .join('\n');

    if (warning) {
      // appEvents.emit(datapointsWarningEvent, { refId, warning });
    }
  });
}
