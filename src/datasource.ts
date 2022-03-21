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
  MutableDataFrame,
  FieldType,
} from '@grafana/data';
import { BackendSrv, getBackendSrv, getTemplateSrv, SystemJS, TemplateSrv } from '@grafana/runtime';
import { assign, each, get, isEmpty, partition } from 'lodash';
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
  convertItemsToTable,
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
  CogniteRelationshipResponse,
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
  RelationshipsQuery,
  RelationshipsSelectableValue,
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
  /**
   * used by panels to get timeseries data
   */
  async query(options: DataQueryRequest<CogniteQuery>): Promise<QueryResponse> {
    const queryTargets = filterEmptyQueryTargets(options.targets).map((t) =>
      this.replaceVariablesInTarget(t, options.scopedVars)
    );
    const { eventTargets, tsTargets } = groupTargets(queryTargets);
    const timeRange = getRange(options.range);
    let responseData: (TimeSeries | TableData | MutableDataFrame)[] = [];
    if (queryTargets.length) {
      try {
        const { failed, succeded } = await this.fetchTimeseriesForTargets(tsTargets, options);
        const eventResults = await this.fetchEventTargets(eventTargets, timeRange);
        const d = await this.fetchRelationshipsTargets(eventTargets);
        handleFailedTargets(failed);
        showWarnings(succeded);
        responseData = [...reduceTimeseries(succeded, timeRange), ...eventResults, ...d[0]];
      } catch (error) {
        /* eslint-disable-next-line no-console  */
        console.error(error); // TODO: use app-events or something
      }
    }
    return {
      data: [...responseData],
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

    const [exprTemplated, labelTemplated, assetTargetTemplated, eventExprTemplated] =
      this.replaceVariablesArr([expr, label, assetQuery?.target, eventQuery?.expr], scopedVars);

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

  async fetchRelationshipsTargets(targets: CogniteQuery[]) {
    return Promise.all(
      targets.map(async (target) => {
        return this.createRelationshipsNode(target.relationsShipsQuery, target.refId);
      })
    ); // .then((_) => _.reduce((total, actual) => actual));
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

  getRelationshipsDropdownOptions = async (
    type: string,
    selector: string,
    refId: string
  ): Promise<RelationshipsSelectableValue> => {
    const settings = {
      method: HttpMethod.POST,
      data: {
        filter: {},
        limit: 1000,
      },
    };
    try {
      const response = await this.connector.fetchItems({
        ...settings,
        path: `/${type}/list`,
      });
      return {
        [selector]: response.map(({ name, id, externalId }) => ({
          value: id || externalId,
          label: name,
        })),
      };
    } catch (error) {
      handleError(error, refId);
      return {
        [selector]: [],
      };
    }
  };

  createRelationshipsNode = async (queryTargets, refId: string) => {
    const generateDetailKey = (key: string): string => ['detail__', key.split(' ')].join('');
    const metaFieldsValues = (source, target, metaKeys) => {
      const sourceMeta = {};
      const targetMeta = {};
      metaKeys.map((key) => {
        const selector = generateDetailKey(key);
        assign(sourceMeta, {
          [selector]: get(source, `metadata.${key}`),
        });
        assign(targetMeta, {
          [selector]: get(target, `metadata.${key}`),
        });
        return null;
      });
      return { sourceMeta, targetMeta };
    };
    const generateNodesAndEdges = (realtionshipsList: CogniteRelationshipResponse[]) => {
      const getMetaKeys = (list) => {
        const metas = [];
        const setMeta = (object) => {
          Object.keys(object).map((key) => {
            if (!metas.includes(key)) {
              metas.push(key);
            }
            return key;
          });
        };
        const getItemMeta = (item) => {
          if (item.source) {
            setMeta(item.source);
          } else if (item.target) {
            setMeta(item.target);
          }
        };
        list.map(getItemMeta);
        return metas;
      };
      const nodesFrame = (metaKeys): MutableDataFrame => {
        const fields: any = {
          id: {
            type: FieldType.string,
          },
          title: {
            type: FieldType.string,
          },
          mainStat: {
            type: FieldType.string,
          },
        };

        const extendedFields = metaKeys.reduce((previousValue, currentValue) => {
          return {
            ...previousValue,
            [generateDetailKey(currentValue)]: {
              type: FieldType.string,
              config: {
                displayName: currentValue,
              },
            },
          };
        }, fields);
        return new MutableDataFrame({
          name: 'nodes',
          fields: Object.keys(extendedFields).map((key) => ({
            ...extendedFields[key],
            name: key,
          })),
          meta: {
            preferredVisualisationType: 'nodeGraph',
          },
          refId,
        });
      };
      const edgesFrame = (): MutableDataFrame => {
        const fields: any = {
          id: {
            type: FieldType.string,
          },
          source: {
            type: FieldType.string,
          },
          target: {
            type: FieldType.string,
          },
          mainStat: {
            type: FieldType.string,
          },
        };

        return new MutableDataFrame({
          name: 'edges',
          fields: Object.keys(fields).map((key) => ({
            ...fields[key],
            name: key,
          })),
          meta: {
            preferredVisualisationType: 'nodeGraph',
          },
          refId,
        });
      };
      const allMetaKeysFromSourceAndTarget = getMetaKeys(realtionshipsList);
      const nodes = nodesFrame(allMetaKeysFromSourceAndTarget);
      const edges = edgesFrame();
      realtionshipsList.map(
        ({ externalId, labels, sourceExternalId, targetExternalId, source, target }) => {
          const { sourceMeta, targetMeta } = metaFieldsValues(
            source,
            target,
            allMetaKeysFromSourceAndTarget
          );
          nodes.add({
            id: sourceExternalId,
            title: get(source, 'description'),
            mainStat: get(source, 'name'),
            ...sourceMeta,
          });
          nodes.add({
            id: targetExternalId,
            title: get(target, 'description'),
            mainStat: get(target, 'name'),
            ...targetMeta,
          });
          edges.add({
            id: externalId,
            source: sourceExternalId,
            target: targetExternalId,
            mainStat: labels
              .map(({ externalId }) => externalId)
              .join(', ')
              .trim(),
          });
          return null;
        }
      );

      return [nodes, edges];
    };
    const relationshipsFilters = ({
      labels,
      dataSetIds,
    }: RelationshipsQuery): RelationshipsQuery => {
      if (!isEmpty(labels.containsAll) || !isEmpty(dataSetIds)) {
        if (isEmpty(labels.containsAll)) {
          return {
            dataSetIds,
          };
        }
        if (isEmpty(dataSetIds)) {
          return {
            labels,
          };
        }
        return {
          labels,
          dataSetIds,
        };
      }
      return {};
    };
    const { labels, dataSetIds } = queryTargets;
    try {
      const filter = relationshipsFilters({ labels, dataSetIds });
      const realtionshipsList = await this.connector.fetchItems<CogniteRelationshipResponse>({
        method: HttpMethod.POST,
        path: '/relationships/list',
        data: {
          fetchResources: true,
          limit: 1000,
          filter,
        },
      });

      return generateNodesAndEdges(realtionshipsList);
    } catch (error) {
      handleError(error, refId);
      return [];
    }
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
      const { tab, assetQuery, eventQuery, relationsShipsQuery } = target;
      switch (tab) {
        case Tab.Event:
          return eventQuery?.expr;
        case Tab.Asset:
          return assetQuery?.target;
        case Tab.Custom:
          return target.expr;
        case Tab.Relationships: {
          return true;
        }
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
  }
  return { type, items, target };
}

function groupTargets(targets: CogniteQuery[]) {
  const [eventTargets, tsTargets] = partition(
    targets,
    ({ tab }) => tab === Tab.Event || tab === Tab.Relationships
  );
  return { eventTargets, tsTargets };
}
