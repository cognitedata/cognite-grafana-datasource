import {
  DataQueryRequest,
  DataSourceApi,
  DataSourceInstanceSettings,
  SelectableValue,
  ScopedVars,
  TableData,
  TimeSeries,
  DataQueryResponse,
  MutableDataFrame,
  AnnotationQuery,
} from '@grafana/data';
import { BackendSrv, BackendSrvRequest, DataSourceWithBackend, getBackendSrv, getTemplateSrv, TemplateSrv } from '@grafana/runtime';
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
  CogniteDataSourceOptions,
  HttpMethod,
  CogniteQuery,
  MetricDescription,
  QueryTarget,
  Tab,
  VariableQueryData,
} from './types';
import { applyFilters, getRange, isAnnotationTarget } from './utils';
import {
  FlexibleDataModellingDatasource,
  RelationshipsDatasource,
  TemplatesDatasource,
  TimeseriesDatasource,
  EventsDatasource,
  ExtractionPipelinesDatasource,
} from './datasources';
import AnnotationsQueryEditor from 'components/annotationsQueryEditor';
import { lastValueFrom, Observable, from, map } from 'rxjs';

export default class CogniteDatasource extends DataSourceWithBackend<
  CogniteQuery,
  CogniteDataSourceOptions//,
  // AnnotationQuery
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

    const defaultFetcher = {
      fetch: (options: BackendSrvRequest) => {
        const observable = this.backendSrv.fetch(options);
        return lastValueFrom(observable);
      }
    }

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
    const connector = new Connector(
      this.project,
      url,
      defaultFetcher,
      oauthPassThru,
      oauthClientCreds,
      enableTemplates,
      enableEventsAdvancedFiltering,
      enableFlexibleDataModelling,
      enableExtractionPipelines
    );
    this.initSources(connector);
  }

  initSources (connector: Connector) {
    this.connector = connector;
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

  annotations = {
    QueryEditor: AnnotationsQueryEditor,
  }

  // Queries the backend by using `super.query`
   queryBackend(
    backendTargets: QueryTarget[],
    options: DataQueryRequest<CogniteQuery>
  ): Observable<DataQueryResponse> {
    const request = {
      ...options,
      targets: backendTargets,
    };

    // Leverage super.query to make a backend request via Grafana
    return super.query(request);
  }

  /**
   * used by panels to get timeseries data
   */
  query(options: DataQueryRequest<CogniteQuery>): Observable<DataQueryResponse> {
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

    let observables: Array<Observable<DataQueryResponse>> = [];

    if (queryTargets.length) {
      // If there are backend targets (e.g., Tab.Backend), send them to the backend
      const backendTargets = queryTargets.filter((t) => t.tab === Tab.DataModellingV2);
      if (backendTargets.length) {
        const backendObservable = this.queryBackend(backendTargets, options);
        observables.push(backendObservable);
      }

      // Handle other datasources (Timeseries, Events, etc.) in the frontend
      if (tsTargets.length) {
        const tsObservable = from(
          this.timeseriesDatasource.query({
            ...options,
            targets: tsTargets,
          })
        ).pipe(map((result) => ({ data: result.data })));
        observables.push(tsObservable);
      }

      if (eventTargets.length) {
        const eventObservable = from(
          this.eventsDatasource.query({
            ...options,
            targets: eventTargets,
          })
        ).pipe(map((result) => ({ data: result.data })));
        observables.push(eventObservable);
      }

      if (templatesTargets.length) {
        const templatesObservable = from(
          this.templatesDatasource.query({
            ...options,
            targets: templatesTargets,
          })
        ).pipe(map((result) => ({ data: result.data })));
        observables.push(templatesObservable);
      }

      if (relationshipsTargets.length) {
        const relationshipsObservable = from(
          this.relationshipsDatasource.query({
            ...options,
            targets: relationshipsTargets,
          })
        ).pipe(map((result) => ({ data: result.data })));
        observables.push(relationshipsObservable);
      }

      if (extractionPipelinesTargets.length) {
        const extractionPipelinesObservable = from(
          this.extractionPipelinesDatasource.query({
            ...options,
            targets: extractionPipelinesTargets,
          })
        ).pipe(map((result) => ({ data: result.data })));
        observables.push(extractionPipelinesObservable);
      }

      if (flexibleDataModellingTargets.length) {
        const flexibleDataModellingObservable = from(
          this.flexibleDataModellingDatasource.query({
            ...options,
            targets: flexibleDataModellingTargets,
          })
        ).pipe(map((result) => ({ data: result.data })));
        observables.push(flexibleDataModellingObservable);
      }
    }

    return this.mergeObservables(observables);
  }

  // A utility function to merge multiple observables into one
  mergeObservables(observables: Array<Observable<DataQueryResponse>>): Observable<DataQueryResponse> {
    return new Observable((subscriber) => {
      let allData: any[] = [];

      const subscriptions = observables.map((obs) =>
        obs.subscribe({
          next: (response) => {
            allData = [...allData, ...response.data];
          },
          error: (err) => {
            subscriber.error(err);
          },
          complete: () => {
            if (allData.length > 0) {
              subscriber.next({ data: allData });
              subscriber.complete();
            }
          },
        })
      );

      // Clean up subscriptions when the observable is unsubscribed
      return () => subscriptions.forEach((sub) => sub.unsubscribe());
    });
  }

  private replaceVariablesInTarget(target: QueryTarget, scopedVars: ScopedVars): QueryTarget {
    const { expr, query, assetQuery, label, eventQuery, flexibleDataModellingQuery, templateQuery } =
      target;

    const [
      exprTemplated,
      labelTemplated,
      queryTemplated,
      assetTargetTemplated,
      eventExprTemplated,
      templategraphQlQueryTemplated,
      flexibleDataModellinggraphQlQueryTemplated,
    ] = this.replaceVariablesArr(
      [
        expr,
        label,
        query,
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
      query: queryTemplated,
      expr: exprTemplated,
      label: labelTemplated,
    };
  }
  replaceVariable(query: string, scopedVars?): string {
    return this.templateSrv.replace(query.trim(), scopedVars);
  }

  replaceVariablesArr(arr: Array<string | undefined>, scopedVars: ScopedVars) {
    return arr.map((str) => str && this.replaceVariable(str, scopedVars));
  }

  /**
   * used by query editor to search for assets/timeseries
   */
  async getOptionsForDropdown(
    query: string,
    type?: string,
    options?: any
  ): Promise<Array<SelectableValue<string> & Resource>> {
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

    [hasAccessToProject, isLoggedIn] = await this.checkLoginStatusOAuth();

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
        case Tab.DataModellingV2:
          return target.dataModellingV2Query.externalId && target.dataModellingV2Query.space && target.dataModellingV2Query.version;
        case Tab.ExtractionPipelines:
          return true;
        case Tab.Timeseries:
        default:
          return target.target || isAnnotationTarget(target);
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
  const groupedByTab = _.groupBy(targets, (target) => target.tab ?? (isAnnotationTarget(target) ? Tab.Event : Tab.Timeseries));
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
