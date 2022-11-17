import {
  AnnotationEvent,
  AnnotationQueryRequest,
  DataQueryRequest,
  DataSourceApi,
  DataSourceInstanceSettings,
  SelectableValue,
  ScopedVars,
  TableData,
  TimeSeries,
  DataQueryResponse,
  MutableDataFrame,
} from '@grafana/data';
import { BackendSrv, getBackendSrv, getTemplateSrv, TemplateSrv } from '@grafana/runtime';
import _ from 'lodash';
import { fetchSingleAsset, fetchSingleTimeseries } from './cdf/client';
import {
  AssetsFilterRequestParams,
  FilterRequest,
  TimeSeriesResponseItem,
  Resource,
  IdEither,
} from './cdf/types';
import { Connector } from './connector';
import { CacheTime } from './constants';
import { parse as parseQuery } from './parser/events-assets';
import { ParsedFilter, QueryCondition } from './parser/types';
import {
  CogniteAnnotationQuery,
  CogniteDataSourceOptions,
  HttpMethod,
  CogniteQuery,
  MetricDescription,
  QueryTarget,
  Tab,
  VariableQueryData,
} from './types';
import { applyFilters, getRange } from './utils';
import {
  FlexibleDataModellingDatasource,
  RelationshipsDatasource,
  TemplatesDatasource,
  TimeseriesDatasource,
  EventsDatasource,
  ExtractionPipelinesDatasource,
} from './datasources';

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
  eventsDatasource: EventsDatasource;
  templatesDatasource: TemplatesDatasource;
  relationshipsDatasource: RelationshipsDatasource;
  extractionPipelinesDatasource: ExtractionPipelinesDatasource;
  timeseriesDatasource: TimeseriesDatasource;
  flexibleDataModellingDatasource: FlexibleDataModellingDatasource;

  constructor(instanceSettings: DataSourceInstanceSettings<CogniteDataSourceOptions>) {
    super(instanceSettings);

    const { url, jsonData } = instanceSettings;
    const {
      cogniteProject,
      defaultProject,
      oauthPassThru,
      oauthClientCreds,
      enableTemplates,
      enableEventsAdvancedFiltering,
      enableFlexibleDataModelling,
      enableExtractionPipelines,
    } = jsonData;
    this.backendSrv = getBackendSrv();
    this.templateSrv = getTemplateSrv();
    this.url = url;
    this.project = cogniteProject ?? defaultProject;
    this.connector = new Connector(
      this.project,
      url,
      this.backendSrv,
      oauthPassThru,
      oauthClientCreds,
      enableTemplates,
      enableEventsAdvancedFiltering,
      enableFlexibleDataModelling,
      enableExtractionPipelines
    );
    this.templatesDatasource = new TemplatesDatasource(this.connector);
    this.timeseriesDatasource = new TimeseriesDatasource(this.connector);
    this.eventsDatasource = new EventsDatasource(this.connector);
    this.relationshipsDatasource = new RelationshipsDatasource(this.connector);
    this.extractionPipelinesDatasource = new ExtractionPipelinesDatasource(this.connector);
    this.flexibleDataModellingDatasource = new FlexibleDataModellingDatasource(
      this.connector,
      this.timeseriesDatasource
    );
  }

  /**
   * used by panels to get timeseries data
   */
  async query(options: DataQueryRequest<CogniteQuery>): Promise<DataQueryResponse> {
    const queryTargets = filterEmptyQueryTargets(options.targets).map((t) =>
      this.replaceVariablesInTarget(t, options.scopedVars)
    );

    const {
      eventTargets,
      tsTargets,
      templatesTargets,
      relationshipsTargets,
      extractionPipelinesTargets,
      flexibleDataModellingTargets,
    } = groupTargets(queryTargets);
    let responseData: (TimeSeries | TableData | MutableDataFrame)[] = [];
    if (queryTargets.length) {
      try {
        const timeseriesResults = await this.timeseriesDatasource.query({
          ...options,
          targets: tsTargets,
        });
        const eventResults = await this.eventsDatasource.query({
          ...options,
          targets: eventTargets,
        });
        const templatesResults = await this.templatesDatasource.query({
          ...options,
          targets: templatesTargets,
        });
        const relationshipsResults = await this.relationshipsDatasource.query({
          ...options,
          targets: relationshipsTargets,
        });
        const extractionPipelinesResult = await this.extractionPipelinesDatasource.query({
          ...options,
          targets: extractionPipelinesTargets,
        });
        const flexibleDataModellingResult = await this.flexibleDataModellingDatasource.query({
          ...options,
          targets: flexibleDataModellingTargets,
        });
        responseData = [
          ...timeseriesResults.data,
          ...eventResults.data,
          ...relationshipsResults.data,
          ...templatesResults.data,
          ...extractionPipelinesResult.data,
          ...flexibleDataModellingResult.data,
        ];
      } catch (error) {
        return {
          data: [],
          error: {
            message: error?.message ?? error,
          },
        };
      }
    }
    return { data: responseData };
  }
  private replaceVariablesInTarget(target: QueryTarget, scopedVars: ScopedVars): QueryTarget {
    const { expr, assetQuery, label, eventQuery, flexibleDataModellingQuery, templateQuery } =
      target;

    const [
      exprTemplated,
      labelTemplated,
      assetTargetTemplated,
      eventExprTemplated,
      templategraphQlQueryTemplated,
      flexibleDataModellinggraphQlQueryTemplated,
    ] = this.replaceVariablesArr(
      [
        expr,
        label,
        assetQuery?.target,
        eventQuery?.expr,
        templateQuery?.graphQlQuery,
        flexibleDataModellingQuery?.graphQlQuery,
      ],
      scopedVars
    );
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

    const templatedTemplateQuery = templateQuery && {
      templateQuery: {
        ...templateQuery,
        graphQlQuery: templategraphQlQueryTemplated,
      },
    };
    const templatedflexibleDataModellingQuery = flexibleDataModellingQuery && {
      flexibleDataModellingQuery: {
        ...flexibleDataModellingQuery,
        graphQlQuery: flexibleDataModellinggraphQlQueryTemplated,
      },
    };
    return {
      ...target,
      ...templatedAssetQuery,
      ...templatedEventQuery,
      ...templatedTemplateQuery,
      ...templatedflexibleDataModellingQuery,
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
    const { items } = await this.eventsDatasource.fetchEvents(
      {
        expr: evaluatedQuery,
        advancedFilter: '',
      },
      timeRange
    );
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

  /**
   * used by query editor to get metric suggestions (template variables)
   */
  async metricFindQuery({ query, valueType }: VariableQueryData): Promise<MetricDescription[]> {
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
    return filteredAssets.map((asset) => {
      console.log(asset, asset[valueType?.value]);
      return {
        text: asset.name,
        value: asset[valueType?.value] || asset.id,
      };
    });
  }

  fetchSingleTimeseries = (id: IdEither) => {
    return fetchSingleTimeseries(id, this.connector);
  };

  fetchSingleAsset = (id: IdEither) => {
    return fetchSingleAsset(id, this.connector);
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
        relationshipsQuery,
        flexibleDataModellingQuery,
      } = target;
      switch (tab) {
        case Tab.Event:
          return eventQuery?.expr || eventQuery?.advancedFilter;
        case Tab.Asset: {
          return assetQuery?.target;
        }
        case Tab.Templates:
          return (
            templateQuery &&
            templateQuery.groupExternalId &&
            templateQuery.version &&
            templateQuery.graphQlQuery
          );
        case Tab.Custom:
          return target.expr;
        case Tab.Relationships:
          return (
            !!relationshipsQuery?.dataSetIds.length ||
            !!relationshipsQuery?.labels?.containsAny?.length
          );
        case Tab.FlexibleDataModelling:
          return (
            !!flexibleDataModellingQuery?.version &&
            !!flexibleDataModellingQuery?.graphQlQuery.length
          );
        case Tab.ExtractionPipelines:
          return true;
        case Tab.Timeseries:
        default:
          return target.target;
      }
    }
    return false;
  }) as QueryTarget[];
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

function groupTargets(targets: CogniteQuery[]) {
  const groupedByTab = _.groupBy(targets, ({ tab }) => tab || Tab.Timeseries);
  return {
    eventTargets: groupedByTab[Tab.Event] ?? [],
    templatesTargets: groupedByTab[Tab.Templates] ?? [],
    relationshipsTargets: groupedByTab[Tab.Relationships] ?? [],
    extractionPipelinesTargets: groupedByTab[Tab.ExtractionPipelines] ?? [],
    flexibleDataModellingTargets: groupedByTab[Tab.FlexibleDataModelling] ?? [],
    tsTargets: [
      ...(groupedByTab[Tab.Timeseries] ?? []),
      ...(groupedByTab[Tab.Asset] ?? []),
      ...(groupedByTab[Tab.Custom] ?? []),
    ],
  };
}
