import {
  AnnotationEvent,
  AnnotationQueryRequest,
  DataQueryRequest,
  DataSourceApi,
  DataSourceInstanceSettings,
  TimeRange,
  SelectableValue,
} from '@grafana/data';
import { BackendSrv, getBackendSrv, getTemplateSrv, SystemJS, TemplateSrv } from '@grafana/runtime';
import {
  concurrent,
  datapointsPath,
  formQueriesForTargets,
  getCalculationWarnings,
  getLabelsForTarget,
  getLimitsWarnings,
  getTimeseries,
  reduceTimeseries,
  stringifyError,
  fetchSingleAsset,
  fetchSingleTimeseries,
  targetToIdEither,
} from './cdf/client';
import {
  AssetsFilterRequestParams,
  EventsFilterRequestParams,
  FilterRequest,
  TimeSeriesResponseItem,
  Resource,
  IdEither,
} from './cdf/types';
import { Connector } from './connector';
import {
  CacheTime,
  datapointsWarningEvent,
  failedResponseEvent,
  TIMESERIES_LIMIT_WARNING,
} from './constants';
import { parse as parseQuery } from './parser/events-assets';
import { formQueriesForExpression } from './parser/ts';
import { ParsedFilter, QueryCondition } from './parser/types';
import {
  CDFDataQueryRequest,
  CogniteAnnotationQuery,
  CogniteDataSourceOptions,
  DataQueryRequestItem,
  DataQueryRequestResponse,
  Err,
  FailResponse,
  HttpMethod,
  CogniteQuery,
  isError,
  MetricDescription,
  Ok,
  QueryOptions,
  QueryResponse,
  QueryTarget,
  ResponseMetadata,
  Responses,
  SuccessResponse,
  Tab,
  Tuple,
  VariableQueryData,
} from './types';
import { applyFilters, getRequestId, toGranularityWithLowerBound } from './utils';

const appEventsLoader = SystemJS.load('app/core/app_events');

export default class CogniteDatasource extends DataSourceApi<
  CogniteQuery,
  CogniteDataSourceOptions
> {
  /**
   * Parameters that are needed by grafana
   */
  url: string;

  project: string;
  connector: Connector;

  templateSrv: TemplateSrv;
  backendSrv: BackendSrv;

  constructor(instanceSettings: DataSourceInstanceSettings<CogniteDataSourceOptions>) {
    super(instanceSettings);

    const { url, jsonData } = instanceSettings;
    const { cogniteProject, oauthPassThru } = jsonData;
    this.backendSrv = getBackendSrv();
    this.templateSrv = getTemplateSrv();
    this.url = url;
    this.connector = new Connector(cogniteProject, url, this.backendSrv, oauthPassThru);
    this.project = cogniteProject;
  }

  /**
   * used by panels to get timeseries data
   */
  async query(options: DataQueryRequest<CogniteQuery>): Promise<QueryResponse> {
    const queryTargets = filterEmptyQueryTargets(options.targets);
    let responseData = [];
    if (queryTargets.length) {
      try {
        const { failed, succeded } = await this.fetchTimeseriesForTargets(queryTargets, options);
        handleFailedTargets(failed);
        showWarnings(succeded);
        responseData = reduceTimeseries(succeded, getRange(options.range));
      } catch (error) {
        /* eslint-disable-next-line no-console  */
        console.error(error); // TODO: use app-events or something
      }
    }

    return { data: responseData };
  }

  async fetchTimeseriesForTargets(
    queryTargets: QueryTarget[],
    options: QueryOptions
  ): Promise<Responses<SuccessResponse, FailResponse>> {
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
            this.replaceVariable(label, options.scopedVars)
          );
        } catch (err) {
          handleError(err, target.refId);
        }
        return { target, labels };
      })
    );

    const getDataQueryRequestItemType = (items: DataQueryRequestItem[]) => {
      const isSynthetic = items.some((q) => !!q.expression);
      const isLatestValue = items.some((q) => !!q.before);
      if (isLatestValue) {
        return 'latest';
      }
      if (isSynthetic) {
        return 'synthetic';
      }
      return 'data';
    };

    const queryProxy = async ([data, metadata]: [CDFDataQueryRequest, ResponseMetadata]) => {
      const { target } = metadata;
      const type = getDataQueryRequestItemType(data.items);
      const chunkSize = type === 'synthetic' ? 10 : 100;

      const request = {
        data:
          type === 'latest'
            ? {
                items: data.items,
              }
            : data,
        path: datapointsPath(type),
        method: HttpMethod.POST,
        requestId: getRequestId(options, target),
      };

      try {
        const result = await this.connector.chunkAndFetch<
          CDFDataQueryRequest,
          DataQueryRequestResponse
        >(request, chunkSize);
        return new Ok({ result, metadata });
      } catch (error) {
        return new Err({ error, metadata });
      }
    };

    const requests = queries.map((query, i) => [query, metadata[i]]); // I.e queries.zip(metadata)
    return concurrent(requests, queryProxy);
  }

  private async getDataQueryRequestItems(
    target: QueryTarget,
    options: QueryOptions
  ): Promise<DataQueryRequestItem[]> {
    const { tab, target: tsId, assetQuery, expr, latestValue } = target;
    switch (tab) {
      default:
      case undefined:
      case Tab.Timeseries: {
        if (!latestValue) {
          return [targetToIdEither(target)];
        }
        return [{ ...targetToIdEither(target), before: options.range.to.valueOf() }];
      }
      case Tab.Asset: {
        const timeseries = await this.findAssetTimeseries(target, options);
        return timeseries.map(({ id }) => ({ id }));
      }
      case Tab.Custom: {
        const templatedExpr = this.replaceVariable(expr, options.scopedVars);
        const defaultInterval = toGranularityWithLowerBound(options.intervalMs);
        return formQueriesForExpression(templatedExpr, target, this.connector, defaultInterval);
      }
    }
  }

  replaceVariable(query: string, scopedVars?): string {
    return this.templateSrv.replace(query.trim(), scopedVars);
  }

  /**
   * used by dashboards to get annotations (events)
   */

  async annotationQuery(
    options: AnnotationQueryRequest<CogniteAnnotationQuery>
  ): Promise<AnnotationEvent[]> {
    const { range, annotation } = options;
    const { query, error } = annotation;
    const [startTime, endTime] = getRange(range);

    if (error || !query) {
      return [];
    }

    const replacedVariablesQuery = this.replaceVariable(query);
    const { filters, params } = parseQuery(replacedVariablesQuery);
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

  /**
   * used by query editor to search for assets/timeseries
   */
  async getOptionsForDropdown(
    query: string,
    type?: string,
    options?: any
  ): Promise<(SelectableValue<string> & Resource)[]> {
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
      cacheTime: CacheTime.Dropdown,
    });

    return items.map(resource2DropdownOption);
  }

  async findAssetTimeseries(
    { refId, assetQuery }: QueryTarget,
    { scopedVars }: QueryOptions
  ): Promise<TimeSeriesResponseItem[]> {
    const assetId = this.replaceVariable(assetQuery.target, scopedVars);
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
      (await appEventsLoader).emit(datapointsWarningEvent, {
        refId,
        warning: TIMESERIES_LIMIT_WARNING,
      });

      ts.splice(-1);
    }
    return ts;
  }

  /**
   * used by query editor to get metric suggestions (template variables)
   */
  async metricFindQuery({ query }: VariableQueryData): Promise<MetricDescription[]> {
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

    const assets = await this.connector.fetchItems<Resource>({
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

  fetchSingleTimeseries = (id: IdEither) => {
    return fetchSingleTimeseries(id, this.connector);
  };

  fetchSingleAsset = (id: IdEither) => {
    return fetchSingleAsset(id, this.connector);
  };

  /**
   * used by data source configuration page to make sure the connection is working
   */
  async testDatasource() {
    const { status, data } = await this.connector.request({ path: 'login/status' });

    if (status === 200) {
      const { project, loggedIn } = data?.data || {};
      if (loggedIn && (project === this.project || !project)) {
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

export function filterEmptyQueryTargets(targets: CogniteQuery[]): QueryTarget[] {
  return targets.filter((target) => {
    if (target && !target.hide) {
      const { tab, assetQuery } = target;
      switch (tab) {
        case Tab.Asset:
          return assetQuery && assetQuery.target;
        case Tab.Custom:
          return target.expr;
        case Tab.Timeseries:
        default:
          return target.target;
      }
    }
    return false;
  }) as QueryTarget[];
}

function handleFailedTargets(failed: FailResponse[]) {
  failed
    .filter(isError)
    .filter(({ error }) => !error.cancelled) // if response was cancelled, no need to show error message
    .forEach(({ error, metadata }) => handleError(error, metadata.target.refId));
}

export function resource2DropdownOption(resource: Resource): SelectableValue<string> & Resource {
  const { id, name, externalId, description } = resource;
  const value = id.toString();
  const label = name || externalId || value;
  return {
    label,
    value,
    description,
    externalId,
    id,
  };
}

export function getRange(range: TimeRange): Tuple<number> {
  const timeFrom = range.from.valueOf();
  const timeTo = range.to.valueOf();
  return [timeFrom, timeTo];
}

function handleError(error: any, refId: string) {
  const errMessage = stringifyError(error);
  appEventsLoader.then((events) => events.emit(failedResponseEvent, { refId, error: errMessage }));
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
      appEventsLoader.then((events) => events.emit(datapointsWarningEvent, { refId, warning }));
    }
  });
}
