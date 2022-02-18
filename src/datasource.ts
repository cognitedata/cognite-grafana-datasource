import {
  AnnotationEvent,
  AnnotationQueryRequest,
  DataQueryRequest,
  DataSourceApi,
  DataSourceInstanceSettings,
  TimeRange,
  SelectableValue,
  ScopedVars,
  TableData,
  TimeSeries,
  AppEvent,
  DataFrame,
  DataQueryResponse,
} from '@grafana/data';
import { BackendSrv, getBackendSrv, getTemplateSrv, SystemJS, TemplateSrv } from '@grafana/runtime';
import { NodeGraphDataFrameFieldNames } from '@grafana/ui';
import {
  assign,
  assignIn,
  partition,
  map,
  filter,
  replace,
  defaults,
  split,
  join,
  trim,
  toString,
  mapKeys,
  keys,
  get,
  head,
} from 'lodash';
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
  fetchSingleExtractor,
  targetToIdEither,
  convertItemsToTable,
  fetchTemplateName,
  fetchTemplateVersion,
  fetchTemplateForTargets,
  fetchRelationshipsList,
} from './cdf/client';
import {
  AssetsFilterRequestParams,
  EventsFilterRequestParams,
  FilterRequest,
  TimeSeriesResponseItem,
  Resource,
  IdEither,
  CogniteEvent,
  EventsFilterTimeParams,
  CogniteExtractor,
} from './cdf/types';
import { Connector } from './connector';
import {
  CacheTime,
  failedResponseEvent,
  TIMESERIES_LIMIT_WARNING,
  EVENTS_PAGE_LIMIT,
  responseWarningEvent,
  EVENTS_LIMIT_WARNING,
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
  QueriesDataItem,
  TemplateQuery,
  defaultQuery,
  MetricFindSelectResponse,
} from './types';
import {
  applyFilters,
  getRequestId,
  toGranularityWithLowerBound,
  getDataPathArray,
  createDatapointsDataFrame,
  getDocs,
} from './utils';
import { edgesFrame, nodesFrame } from './utils2';

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
    const { cogniteProject, oauthPassThru, oauthClientCreds } = jsonData;
    this.backendSrv = getBackendSrv();
    this.templateSrv = getTemplateSrv();
    this.url = url;
    this.connector = new Connector(
      cogniteProject,
      url,
      this.backendSrv,
      oauthPassThru,
      oauthClientCreds
    );
    this.project = cogniteProject;
  }
  cachedDomains = [];

  /**
   * used by panels to get timeseries data
   */
  async query(options: DataQueryRequest<CogniteQuery>): Promise<QueryResponse> {
    const validQueryTargets = filterEmptyQueryTargets(options.targets);
    const queryTargets = map(validQueryTargets, (t) =>
      this.replaceVariablesInTarget(t, options.scopedVars)
    );
    const templateQueryTargets: TemplateQuery[] = map(
      filter(validQueryTargets, { tab: Tab.Template }),
      'templateQuery'
    );
    const relationShipsQueryTargets = map(
      filter(validQueryTargets, { tab: Tab.Relationships }),
      'relationsShipsQuery'
    );

    const { eventTargets, tsTargets, extractorTargets } = groupTargets(queryTargets);
    const timeRange = getRange(options.range);

    let responseData: (TimeSeries | TableData)[] = [];
    let templateResponseData: DataFrame[] = [];
    let nodeResponse = [];
    if (queryTargets.length) {
      try {
        const { failed, succeded } = await this.fetchTimeseriesForTargets(tsTargets, options);
        const eventResults = await this.fetchEventTargets(eventTargets, timeRange);
        const extractorResults = await this.fetchExtractorTargets(extractorTargets);
        handleFailedTargets(failed);
        showWarnings(succeded);
        responseData = [
          ...reduceTimeseries(succeded, timeRange),
          ...eventResults,
          ...extractorResults,
        ];
      } catch (error) {
        /* eslint-disable-next-line no-console  */
        console.error(error); // TODO: use app-events or something
      }
    }
    if (templateQueryTargets.length) {
      try {
        const { data } = await this.templateQuery({
          ...options,
          targets: templateQueryTargets,
        });
        templateResponseData = data;
      } catch (error) {
        /* eslint-disable-next-line no-console  */
        console.error(error);
      }
    }
    if (relationShipsQueryTargets.length) {
      try {
        const { data } = await this.createRelationshipsNode();
        nodeResponse = data;
      } catch (error) {
        /* eslint-disable-next-line no-console  */
        console.error(error);
      }
    }
    return {
      data: [...responseData, ...templateResponseData, ...nodeResponse],
    };
  }

  async fetchTimeseriesForTargets(
    queryTargets: QueryTarget[],
    options: QueryOptions
  ): Promise<Responses<SuccessResponse, FailResponse>> {
    const itemsForTargetsPromises = queryTargets.map(async (target) => {
      try {
        return await getDataQueryRequestItems(target, this.connector, options.intervalMs);
      } catch (e) {
        handleError(e, target.refId);
      }
      return null;
    });

    const queryData = (await Promise.all(itemsForTargetsPromises)).filter(
      (data) => data?.items?.length
    );

    const queries = formQueriesForTargets(queryData, options);
    const metadata = await Promise.all(
      queryData.map(async ({ target, items, type }) => {
        let labels = [];
        try {
          labels = await getLabelsForTarget(target, items, this.connector);
        } catch (err) {
          handleError(err, target.refId);
        }
        return { target, labels, type };
      })
    );

    const queryProxy = async ([data, metadata]: [CDFDataQueryRequest, ResponseMetadata]) => {
      const { target, type } = metadata;
      const chunkSize = type === 'synthetic' ? 10 : 100;

      const request = {
        data,
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

  /**
   * Resolves Grafana variables in QueryTarget object (props: label, expr, assetQuery.target)
   * E.g. {..., label: 'date: ${__from:date:YYYY-MM}'} -> {..., label: 'date: 2020-07'}
   */
  private replaceVariablesInTarget(target: QueryTarget, scopedVars: ScopedVars): QueryTarget {
    const { expr, assetQuery, label, eventQuery } = target;

    const [
      exprTemplated,
      labelTemplated,
      assetTargetTemplated,
      eventExprTemplated,
    ] = this.replaceVariablesArr([expr, label, assetQuery?.target, eventQuery?.expr], scopedVars);

    const templatedAssetQuery = assetQuery && {
      assetQuery: {
        ...assetQuery,
        target: assetTargetTemplated,
      },
    };

    const templatedEventQuery = eventQuery && {
      eventQuery: {
        ...eventQuery,
        expr: eventExprTemplated,
      },
    };

    return {
      ...target,
      ...templatedAssetQuery,
      ...templatedEventQuery,
      expr: exprTemplated,
      label: labelTemplated,
    };
  }

  replaceVariable(query: string, scopedVars?): string {
    return this.templateSrv.replace(query.trim(), scopedVars);
  }

  replaceVariablesArr(arr: (string | undefined)[], scopedVars: ScopedVars) {
    return arr.map((str) => str && this.replaceVariable(str, scopedVars));
  }

  async fetchEventsForTarget(
    { eventQuery, refId }: CogniteQuery,
    timeFrame: EventsFilterTimeParams
  ) {
    const timeRange = eventQuery.activeAtTimeRange ? timeFrame : {};
    try {
      const { items, hasMore } = await this.fetchEvents(eventQuery.expr, timeRange);
      if (hasMore) {
        emitEvent(responseWarningEvent, { refId, warning: EVENTS_LIMIT_WARNING });
      }
      return items;
    } catch (e) {
      handleError(e, refId);
    }
    return [];
  }

  async fetchExtractorsForTarget({ extractorQuery, refId }: CogniteQuery) {
    try {
      const { items } = await this.fetchExtractors(extractorQuery.expr);

      // if (hasMore) {
      //   emitEvent(responseWarningEvent, { refId, warning: EXTRACTOR_LIMIT_WARNING });
      // }
      return items;
    } catch (e) {
      handleError(e, refId);
    }
    return [];
  }

  async fetchEventTargets(targets: CogniteQuery[], [start, end]: Tuple<number>) {
    const timeFrame = {
      activeAtTime: { min: start, max: end },
    };
    return Promise.all(
      targets.map(async (target) => {
        const events = await this.fetchEventsForTarget(target, timeFrame);
        return convertItemsToTable(events, target.eventQuery.columns);
      })
    );
  }

  async fetchExtractorTargets(targets: CogniteQuery[]) {
    return Promise.all(
      targets.map(async (target) => {
        const extpipes = await this.fetchExtractorsForTarget(target);
        return convertItemsToTable(extpipes, target.extractorQuery.columns);
      })
    );
  }

  async fetchEvents(expr: string, timeRange: EventsFilterTimeParams) {
    const { filters, params } = parseQuery(expr);
    const data: FilterRequest<EventsFilterRequestParams> = {
      filter: { ...timeRange, ...params },
      limit: EVENTS_PAGE_LIMIT,
    };

    const items = await this.connector.fetchItems<CogniteEvent>({
      data,
      path: `/events/list`,
      method: HttpMethod.POST,
    });

    return {
      items: applyFilters(items, filters),
      hasMore: items.length === EVENTS_PAGE_LIMIT,
    };
  }

  async fetchExtractors(expr: string) {
    const data = {};
    const items = await this.connector.fetchItems<CogniteExtractor>({
      data,
      path: `/extpipes/list`,
      method: HttpMethod.POST,
    });

    return {
      items,
    };
  }

  /**
   * used by dashboards to get annotations (events)
   */
  async annotationQuery(
    options: AnnotationQueryRequest<CogniteAnnotationQuery>
  ): Promise<AnnotationEvent[]> {
    const { range, annotation } = options;
    const { query, error } = annotation;

    if (error || !query) {
      return [];
    }

    const [rangeStart, rangeEnd] = getRange(range);
    const timeRange = {
      activeAtTime: { min: rangeStart, max: rangeEnd },
    };
    const evaluatedQuery = this.replaceVariable(query);
    const { items } = await this.fetchEvents(evaluatedQuery, timeRange);

    return items.map(({ description, startTime, endTime, type }) => ({
      annotation,
      isRegion: true,
      text: description,
      time: startTime,
      timeEnd: endTime || rangeEnd,
      title: type,
    }));
  }

  /**
   * used by dashboards to get annotations (events)
   */
  async extPipelinesQuery(
    options: AnnotationQueryRequest<CogniteAnnotationQuery>
  ): Promise<AnnotationEvent[]> {
    const { range, annotation } = options;
    const { query, error } = annotation;

    if (error || !query) {
      return [];
    }

    const [rangeStart, rangeEnd] = getRange(range);
    const timeRange = {
      activeAtTime: { min: rangeStart, max: rangeEnd },
    };
    const evaluatedQuery = this.replaceVariable(query);
    const { items } = await this.fetchExtractors(evaluatedQuery);

    return items.map(({ id }) => ({
      annotation,
      isRegion: true,
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
    const data: any = query ? { search: { query } } : {};

    const items = await this.connector.fetchItems<TimeSeriesResponseItem>({
      data,
      path: `/${resources[type]}/search`,
      method: HttpMethod.POST,
      params: options,
      cacheTime: CacheTime.Dropdown,
    });

    return items.map(resource2DropdownOption);
  }

  /**
   * used by query editor to search for assets/timeseries
   */
  async getOptionsForExtractorDropdown(
    query: string
  ): Promise<(SelectableValue<string> & Resource)[]> {
    const resources = {
      [Tab.Asset]: 'assets',
      [Tab.Timeseries]: 'timeseries',
    };
    const data: any = query ? { search: { query } } : {};

    const items = await this.connector.fetchItems<TimeSeriesResponseItem>({
      data,
      path: `/extpipes`,
      method: HttpMethod.GET,
      cacheTime: CacheTime.Dropdown,
    });

    return items.map(resource2DropdownOption);
  }

  /**
   * used by query editor to get metric suggestions (template variables)
   */
  async metricFindQuery({ query }: VariableQueryData): Promise<MetricDescription[]> {
    let params: QueryCondition;
    let filters: ParsedFilter[];

    try {
      ({ params, filters } = parseQuery(this.replaceVariable(query)));
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

  fetchSingleExtractor = (id: IdEither) => {
    return fetchSingleExtractor(id, this.connector);
  };

  async listDomains() {
    if (this.cachedDomains.length) {
      return this.cachedDomains;
    }
    return this.fetchTemplateName().then((res) => {
      this.cachedDomains = res.data.items;
      return this.cachedDomains;
    });
  }

  async getDomainsForDropdown(): Promise<MetricFindSelectResponse> {
    const domains = await this.listDomains();

    // need maybe filter?
    return map(domains, ({ externalId }) => {
      return {
        label: externalId,
        value: replace(externalId, ' ', '%20'),
      };
    });
  }

  async getCurrentDomainVersion(domainExternalId: string): Promise<any> {
    return this.fetchTemplateVersion(domainExternalId);
  }

  private postQuery(query: Partial<TemplateQuery>, payload: string) {
    const params = {
      ...query,
      expr: payload,
    };
    return this.fetchTemplateForTargets(params)
      .then((results: any) => {
        return { query, results };
      })
      .catch((err: any) => {
        if (err.data && err.data.error) {
          throw {
            message: `GraphQL error: ${err.data.error.reason}`,
            error: err.data.error,
          };
        }

        throw err;
      });
  }

  private createQuery(
    query: TemplateQuery,
    range: TimeRange | undefined,
    intervalMs,
    scopedVars: ScopedVars | undefined = undefined
  ) {
    let payload = query.expr;
    if (range) {
      payload = replace(payload, '$__from', range.from.valueOf().toString());
      payload = replace(payload, '$__to', range.to.valueOf().toString());
      payload = replace(payload, '$__granularity', `"${toGranularityWithLowerBound(intervalMs)}"`);
    }
    payload = this.templateSrv.replace(payload, scopedVars);
    return this.postQuery(query, payload);
  }

  async templateQuery(options: DataQueryRequest<TemplateQuery>): Promise<DataQueryResponse> {
    return Promise.all(
      options.targets.map((target) => {
        return this.createQuery(
          defaults(target, defaultQuery),
          options.range,
          options.intervalMs,
          options.scopedVars
        );
      })
    ).then((results: any) => {
      const dataFrameArray: DataFrame[] = [];
      map(results, (res) => {
        const { refId } = res.query;
        const dataPathArray: string[] = getDataPathArray(res.query.dataPath);
        const { groupBy, aliasBy, dataPointsPath } = res.query;
        const datapointsPaths = split(dataPointsPath, ',');
        const splited = split(groupBy, ',');
        const groupByList: string[] = [];
        map(splited, (element) => {
          const trimmed = element.trim();
          if (trimmed) {
            groupByList.push(trimmed);
          }
        });
        map(dataPathArray, (dataPath) => {
          const dataFrameMap = {};
          const docs: any[] = getDocs(res.results.data, dataPath);
          map(docs, (doc) => {
            const identifiers = [];
            map(groupByList, (groupByElement) => {
              identifiers.push(get(doc, groupByElement));
            });
            const identifiersString = identifiers.toString();
            const dataFrame = createDatapointsDataFrame(identifiersString, refId);
            map(datapointsPaths, (datapointsPath) => {
              const trimmedDatapointsPath = datapointsPath.trim();
              const value = get(doc, trimmedDatapointsPath);
              assignIn(dataFrameMap, { [identifiersString]: dataFrame });
              const hasDatapoints = value != null && value.length > 0;
              if (hasDatapoints) {
                map(value, (datapoint) => {
                  return dataFrame.add(datapoint);
                });
              }
            });
          });
          map(dataFrameMap, (d) => dataFrameArray.push(d));
        });
      });
      return { data: dataFrameArray };
    });
  }

  fetchTemplateName = (): Promise<any> => {
    return fetchTemplateName(this.connector);
  };

  fetchTemplateVersion = (domain: string): Promise<any> => {
    return fetchTemplateVersion(domain, this.connector);
  };

  fetchTemplateForTargets = (params): Promise<any> => {
    return fetchTemplateForTargets(params, this.connector);
  };

  fetchRelationshipsList = () => {
    return fetchRelationshipsList({}, this.connector);
  };

  createRelationshipsNode = async () => {
    const realtionshipsList = await this.fetchRelationshipsList();
    const iterrer = head(map(realtionshipsList, ({ source }) => keys(source.metadata)));
    const nodes = nodesFrame(iterrer);
    const edges = edgesFrame();
    map(
      realtionshipsList,
      ({ externalId, labels, sourceExternalId, targetExternalId, source, target }) => {
        const newSourceMeta = {};
        const newTargetMeta = {};
        map(iterrer, (key) => {
          assign(newSourceMeta, {
            [`${NodeGraphDataFrameFieldNames.detail}${key}`]: get(source.metadata, key),
          });
          assign(newTargetMeta, {
            [`${NodeGraphDataFrameFieldNames.detail}${key}`]: get(target.metadata, key),
          });
        });
        nodes.add({
          [NodeGraphDataFrameFieldNames.id]: `${sourceExternalId}`,
          [NodeGraphDataFrameFieldNames.title]: source.description,
          [NodeGraphDataFrameFieldNames.mainStat]: source.name,
          ...map(newSourceMeta),
        });
        nodes.add({
          [NodeGraphDataFrameFieldNames.id]: `${targetExternalId}`,
          [NodeGraphDataFrameFieldNames.mainStat]: target.name,
          [NodeGraphDataFrameFieldNames.title]: target.description,
          ...map(newTargetMeta),
        });
        edges.add({
          [NodeGraphDataFrameFieldNames.id]: externalId,
          [NodeGraphDataFrameFieldNames.source]: sourceExternalId,
          [NodeGraphDataFrameFieldNames.target]: targetExternalId,
          [NodeGraphDataFrameFieldNames.mainStat]: trim(join(map(labels, 'externalId'), ' ')),
        });
      }
    );

    return { data: [nodes, edges] };
  };

  async checkLoginStatusApiKey() {
    let hasAccessToProject = false;
    let isLoggedIn = false;
    const { status, data } = await this.connector.request({ path: 'login/status' });

    if (status === 200) {
      const { project, loggedIn } = data?.data || {};
      hasAccessToProject = project === this.project;
      isLoggedIn = loggedIn;
    }

    return [hasAccessToProject, isLoggedIn];
  }

  async checkLoginStatusOAuth() {
    let hasAccessToProject = false;
    let isLoggedIn = false;
    const { status, data } = await this.connector.request({ path: 'api/v1/token/inspect' });

    if (status === 200) {
      const { projects = [] } = data || {};
      const projectNames = projects.map(({ projectUrlName }) => projectUrlName);
      hasAccessToProject = projectNames.includes(this.project);
      isLoggedIn = true;
    }

    return [hasAccessToProject, isLoggedIn];
  }

  /**
   * used by data source configuration page to make sure the connection is working
   */
  async testDatasource() {
    let hasAccessToProject = false;
    let isLoggedIn = false;

    if (this.connector.isUsingOAuth()) {
      [hasAccessToProject, isLoggedIn] = await this.checkLoginStatusOAuth();
    } else {
      [hasAccessToProject, isLoggedIn] = await this.checkLoginStatusApiKey();
    }

    switch (true) {
      case isLoggedIn && hasAccessToProject:
        return {
          status: 'success',
          message: 'Your Cognite credentials are valid',
          title: 'Success',
        };
      case isLoggedIn:
        return {
          status: 'warning',
          message: `Cannot access '${this.project}' project`,
          title: 'Warning',
        };
      default:
        return {
          status: 'error',
          message: 'Your Cognite credentials are invalid',
          title: 'Error',
        };
    }
  }
}

export function filterEmptyQueryTargets(targets: CogniteQuery[]): QueryTarget[] {
  return targets.filter((target) => {
    if (target && !target.hide) {
      const {
        tab,
        assetQuery,
        eventQuery,
        templateQuery,
        extractorQuery,
        relationsShipsQuery,
      } = target;
      switch (tab) {
        case Tab.Event:
          return eventQuery?.expr;
        case Tab.Extractor:
          return true;
        case Tab.Asset:
          return assetQuery?.target;
        case Tab.Custom:
          return target.expr;
        case Tab.Template:
          return (
            templateQuery &&
            templateQuery.domain &&
            templateQuery.domainVersion &&
            templateQuery.expr
          );
        case Tab.Relationships:
          return relationsShipsQuery;
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

async function emitEvent<T>(event: AppEvent<T>, payload: T): Promise<void> {
  const appEvents = await appEventsLoader;
  return appEvents.emit(event, payload);
}

function handleError(error: any, refId: string) {
  const errMessage = stringifyError(error);
  emitEvent(failedResponseEvent, { refId, error: errMessage });
}

function showWarnings(responses: SuccessResponse[]) {
  responses.forEach(({ result, metadata }) => {
    const { items } = result.data;
    const { limit } = result.config.data;
    const { refId } = metadata.target;
    const warning = [getLimitsWarnings(items, limit), getCalculationWarnings(items)]
      .filter(Boolean)
      .join('\n\n');

    if (warning) {
      emitEvent(responseWarningEvent, { refId, warning });
    }
  });
}

function getDataQueryRequestType({ tab, latestValue }: QueryTarget) {
  switch (tab) {
    case Tab.Custom: {
      return 'synthetic';
    }
    default: {
      return latestValue ? 'latest' : 'data';
    }
  }
}

async function findAssetTimeseries(
  { refId, assetQuery }: QueryTarget,
  connector: Connector
): Promise<TimeSeriesResponseItem[]> {
  const assetId = assetQuery.target;
  const filter = assetQuery.includeSubtrees
    ? { assetSubtreeIds: [{ id: Number(assetId) }] }
    : { assetIds: [assetId] };

  // since /dataquery can only have 100 items and checkboxes become difficult to use past 100 items,
  //  we only get the first 100 timeseries, and show a warning if there are too many timeseries
  const limit = 101;
  const ts = await getTimeseries({ filter, limit }, connector);
  if (ts.length === limit) {
    emitEvent(responseWarningEvent, { refId, warning: TIMESERIES_LIMIT_WARNING });

    ts.splice(-1);
  }
  return ts;
}
export async function getDataQueryRequestItems(
  target: QueryTarget,
  connector: Connector,
  intervalMs: number
): Promise<QueriesDataItem> {
  const { tab, expr } = target;
  const type = getDataQueryRequestType(target);
  let items: DataQueryRequestItem[];
  switch (tab) {
    default:
    case undefined:
    case Tab.Timeseries: {
      items = [targetToIdEither(target)];
      break;
    }
    case Tab.Asset: {
      const timeseries = await findAssetTimeseries(target, connector);
      items = timeseries.map(({ id }) => ({ id }));
      break;
    }
    case Tab.Custom: {
      const defaultInterval = toGranularityWithLowerBound(intervalMs);
      items = await formQueriesForExpression(expr, target, connector, defaultInterval);
      break;
    }
    case Tab.Relationships: {
      break;
    }
    case Tab.Template: {
      break;
    }
  }
  return { type, items, target };
}

function groupTargets(targets: CogniteQuery[]) {
  const [eventTargets, tsTargets] = partition(targets, ({ tab }) => tab === Tab.Event);
  const [extractorTargets] = partition(targets, ({ tab }) => tab === Tab.Extractor);
  return { eventTargets, tsTargets, extractorTargets };
}
