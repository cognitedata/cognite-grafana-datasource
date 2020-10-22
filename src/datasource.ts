import { parse as parseDate } from 'grafana/app/core/utils/datemath';
import { getRequestId, applyFilters, toGranularityWithLowerBound } from './utils';
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
  TemplateQuery,
} from './types';
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
} from './cdfDatasource';
import { Connector } from './connector';
import { TimeRange } from '@grafana/data';
import { ParsedFilter, QueryCondition } from './parser/types';
import { datapointsWarningEvent, failedResponseEvent, TIMESERIES_LIMIT_WARNING } from './constants';
import { TemplatesConnector } from './templatesDatasource';

const { Asset, Custom, Timeseries, Template } = Tab;
const { POST } = HttpMethod;

export default class CogniteDatasource {
  /**
   * Parameters that are needed by grafana
   */
  id: number;
  url: string;
  name: string;

  project: string;
  connector: Connector;
  templatesConnector: TemplatesConnector;

  /** @ngInject */
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
    this.templatesConnector = new TemplatesConnector(
      jsonData.cogniteProject,
      url,
      backendSrv,
      templateSrv
    );
  }

  /**
   * used by panels to get timeseries data
   */
  async query(options: QueryOptions): Promise<QueryResponse> {
    const validQueryTargets = filterEmptyQueryTargets(options.targets);
    const queryTargets = validQueryTargets.filter(target => target.tab !== Template);
    const templateQueryTargets: TemplateQuery[] = validQueryTargets
      .filter(target => target.tab === Template)
      .map(target => target.templateQuery);
    let responseData = [];
    let templateResponseData = [];

    if (queryTargets.length) {
      try {
        const { failed, succeded } = await this.fetchTimeseriesForTargets(queryTargets, options);
        handleFailedTargets(failed);
        showWarnings(succeded);
        responseData = reduceTimeseries(succeded, getRange(options.range));
      } catch (error) {
        console.error(error); // not sure it ever happens
      }
    }

    if (templateQueryTargets.length) {
      try {
        const { data } = await this.templatesConnector.query({
          ...options,
          targets: templateQueryTargets,
        });
        templateResponseData = data;
      } catch (error) {
        console.error(error);
      }
    }

    return { data: [...responseData, ...templateResponseData] };
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
        handleError(e, target.refId);
      }
    });
    const queryData = (await Promise.all(itemsForTargetsPromises)).filter(
      data => data?.items?.length
    );

    const queries = formQueriesForTargets(queryData, options);
    const metadata = await Promise.all(
      queryData.map(async ({ target, items }) => {
        let labels = [];
        try {
          labels = (await getLabelsForTarget(target, items, this.connector)).map(label =>
            this.replaceVariable(label, options.scopedVars)
          );
        } catch (err) {
          handleError(err, target.refId);
        }
        return { target, labels };
      })
    );

    return promiser<DataQueryRequest, ResponseMetadata, DataQueryRequestResponse>(
      queries,
      metadata,
      async (data, { target }) => {
        const isSynthetic = data.items.some(q => !!q.expression);
        const chunkSize = isSynthetic ? 10 : 100;

        return this.connector.chunkAndFetch<DataQueryRequest, DataQueryRequestResponse>(
          {
            data,
            path: datapointsPath(isSynthetic),
            method: POST,
            requestId: getRequestId(options, target),
          },
          chunkSize
        );
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
      method: POST,
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
      appEvents.emit(datapointsWarningEvent, {
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
      method: POST,
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

  /**
   * used by templates query editor to search for domains
   */
  async getDomainsForDropdown(query: string): Promise<MetricFindQueryResponse> {
    const domains = await this.templatesConnector.listDomains();

    return domains
      .filter(d => d.externalId.match(new RegExp(query, 'gi')))
      .map(({ externalId }) => {
        return {
          text: externalId,
          value: externalId,
        };
      });
  }
  async getCurrentDomainVersion(domainExternalId: string): Promise<number | undefined> {
    const domains = await this.templatesConnector.listDomains();
    const domain = domains.find(d => d.externalId === domainExternalId);
    return domain?.version;
  }
}

export function filterEmptyQueryTargets(targets: InputQueryTarget[]): QueryTarget[] {
  return targets.filter(target => {
    if (target && !target.hide) {
      const { tab, assetQuery, templateQuery } = target;
      switch (tab) {
        case Asset:
          return assetQuery && assetQuery.target;
        case Custom:
          return target.expr;
        case Template:
          return (
            templateQuery &&
            templateQuery.domain &&
            templateQuery.domainVersion &&
            templateQuery.queryText
          );
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
    .forEach(({ error, metadata }) => handleError(error, metadata.target.refId));
}

export function getRange(range: TimeRange): Tuple<number> {
  const timeFrom = Math.ceil(parseDate(range.from));
  const timeTo = Math.ceil(parseDate(range.to));
  return [timeFrom, timeTo];
}

function handleError(error: any, refId: string) {
  const errMessage = stringifyError(error);
  appEvents.emit(failedResponseEvent, { refId, error: errMessage });
}

function showWarnings(responses: SuccessResponse<ResponseMetadata, DataQueryRequestResponse>[]) {
  responses.forEach(({ result, metadata }) => {
    const items = result.data.items;
    const limit = result.config.data.limit;
    const refId = metadata.target.refId;
    const warning = [getLimitsWarnings(items, limit), getCalculationWarnings(items)]
      .filter(Boolean)
      .join('\n');

    if (warning) {
      appEvents.emit(datapointsWarningEvent, { refId, warning });
    }
  });
}
