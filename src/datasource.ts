import { isArray } from 'lodash';
import { parse as parseDate } from 'grafana/app/core/utils/datemath';
import { getRequestId, applyFilters } from './utils';
import { parse } from './parser/events-assets';
import { formQueriesForExpression } from './parser/ts';
import { BackendSrv } from 'grafana/app/core/services/backend_srv';
import { TemplateSrv } from 'grafana/app/features/templating/template_srv';
import { appEvents } from 'grafana/app/core/core';
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
  FilterRequest,
  AssetsFilterRequestParams,
  EventsFilterRequestParams,
} from './types';
import {
  formQueriesForTargets,
  getTimeseries,
  reduceTimeseries,
  formMetadatasForTargets,
  promiser,
} from './cdfDatasource';
import { Connector } from './connector';
import { TimeRange } from '@grafana/ui';
import { ParsedFilter, QueryCondition } from './parser/types';
import { datapointsLimitWarningEvent, failedResponseEvent } from './constants';

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
  async query(options: QueryOptions): Promise<QueryResponse> {
    const queryTargets = filterEmptyQueryTargets(options.targets);
    let responseData = [];

    if (queryTargets.length) {
      try {
        const { failed, succeded } = await this.fetchTimeseriesForTargets(queryTargets, options);
        handleFailedTargets(failed);
        showTooMuchDatapointsWarningIfNeeded(succeded);
        responseData = reduceTimeseries(succeded, getRange(options.range));
      } catch (error) {
        console.error(error); // not sure it ever happens
      }
    }

    return { data: responseData };
  }

  async fetchTimeseriesForTargets(
    queryTargets: QueryTarget[],
    options: QueryOptions
  ): Promise<MetaResponses> {
    const itemsForTargetsPromises = queryTargets.map(async target => {
      try {
        const items = await this.getDataQueryRequestItems(target, options);
        return { items, target };
      } catch (e) {
        appEvents.emit(failedResponseEvent, { refId: target.refId, error: e.message });
        return null;
      }
    });
    const queryData = await Promise.all(itemsForTargetsPromises);
    const filteredQueryData = queryData.filter(data => data && data.items && data.items.length);

    const queries = formQueriesForTargets(filteredQueryData, options);
    let metadata = await formMetadatasForTargets(filteredQueryData, options, this.connector);
    metadata = metadata.map(({ target, labels: labelsWithVariables }) => {
      const labels = labelsWithVariables.map(label =>
        this.replaceVariable(label, options.scopedVars)
      );
      return { labels, target };
    });

    return promiser<DataQueryRequest, ResponseMetadata, DataQueryRequestResponse>(
      queries,
      metadata,
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
    const { tab, target: tsId, assetQuery, expr } = target;
    switch (tab) {
      case undefined:
      case Timeseries: {
        return [{ id: tsId }];
      }
      case Asset: {
        /**
         *  todo: here target.assetQuery.timeseries mutability is used
         *  to reuse timeseries data during label generation for Asset tab
         *  need to be redone in functional way
         **/
        await this.findAssetTimeseries(target, options);
        return assetQuery.timeseries.filter(ts => ts.selected).map(({ id }) => ({ id }));
      }
      case Tab.Custom: {
        const templatedExpr = this.replaceVariable(expr, options.scopedVars);
        return formQueriesForExpression(templatedExpr, target, this.connector);
      }
    }
  }

  replaceVariable(query: string, scopedVars?): string {
    return this.templateSrv.replace(query.trim(), scopedVars);
  }

  /**
   * used by dashboards to get annotations (events)
   */
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
    const assetId = this.replaceVariable(target.assetQuery.target, options.scopedVars);
    const filter = target.assetQuery.includeSubtrees
      ? {
          assetSubtreeIds: [{ id: Number(assetId) }],
        }
      : {
          assetIds: [assetId],
        };

    // since /dataquery can only have 100 items and checkboxes become difficult to use past 100 items,
    //  we only get the first 100 timeseries, and show a warning if there are too many timeseries
    const limit = 101;
    const ts = await getTimeseries({ filter, limit }, target, this.connector);
    if (ts.length === limit) {
      const warning =
        "[WARNING] Only showing first 100 timeseries. To get better results, either change the selected asset or use 'Custom Query'.";

      appEvents.emit(datapointsLimitWarningEvent, { warning, refId: target.refId });

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
  return targets.filter(target => {
    if (target && !target.hide) {
      const { tab, assetQuery } = target;
      switch (tab) {
        case Asset:
          return assetQuery && assetQuery.target;
        case Custom:
          return target.expr;
        case Timeseries:
        case undefined:
          return target.target;
      }
    }
  }) as QueryTarget[];
}

function handleFailedTargets(failed: FailResponse<ResponseMetadata>[]) {
  failed
    .filter(isError)
    .filter(({ error }) => !error.cancelled) // if response was cancelled, no need to show error message
    .forEach(({ error, metadata }) => {
      const message =
        error.data && error.data.error
          ? `[${error.status} ERROR] ${error.data.error.message}`
          : 'Unknown error';

      appEvents.emit(failedResponseEvent, { refId: metadata.target.refId, error: message });
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
  responses.forEach(
    ({
      result: {
        data: { items },
        config: {
          data: { limit },
        },
      },
      metadata: {
        target: { refId },
      },
    }) => {
      const hasMorePoints = items.some(({ datapoints }) => datapoints.length >= limit);
      const warning =
        '[WARNING] Datapoints limit was reached, so not all datapoints may be shown. Try increasing the granularity, or choose a smaller time range.';

      if (hasMorePoints) {
        appEvents.emit(datapointsLimitWarningEvent, { refId, warning });
      }
    }
  );
}
