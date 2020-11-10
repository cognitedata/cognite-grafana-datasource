import { BackendSrv } from 'grafana/app/core/services/backend_srv';
import * as dateMath from 'grafana/app/core/utils/datemath';
import { TemplateSrv } from 'grafana/app/features/templating/template_srv';
import _ from 'lodash';
import cache from './cache';
import { parse, parseExpression } from './parser';
import {
  AnnotationQueryOptions,
  AnnotationResponse,
  CogniteDataSourceSettings,
  DataQueryError,
  DataQueryRequest,
  DataQueryRequestItem,
  DataQueryRequestResponse,
  isError,
  MetricFindQueryResponse,
  ParseType,
  QueryOptions,
  QueryResponse,
  QueryTarget,
  Tab,
  Table,
  TimeSeriesResponse,
  TimeSeriesResponseItem,
  TimeseriesSearchQuery,
  VariableQueryData,
} from './types';
import Utils from './utils';

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
    this.id = instanceSettings.id;
    this.url = instanceSettings.url;
    this.project = instanceSettings.jsonData.cogniteProject;
    this.name = instanceSettings.name;
  }

  public async query(options: QueryOptions): Promise<QueryResponse> {
    const queryTargets: QueryTarget[] = options.targets.reduce((targets, target) => {
      target.error = '';
      target.warning = '';
      if (
        !target ||
        target.hide ||
        ((target.tab === Tab.Timeseries || target.tab === undefined) &&
          (!target.target || target.target === 'Start typing tag id here')) ||
        ((target.tab === Tab.Asset || target.tab === Tab.Custom) &&
          (!target.assetQuery || target.assetQuery.target === ''))
      ) {
        return targets;
      }
      return targets.concat(target);
    }, []);

    if (queryTargets.length === 0) {
      return Promise.resolve({ data: [] });
    }

    const queries: Promise<QueryResponse>[] = [];
    for (const target of queryTargets) {
      queries.push(this.processTarget(target, options));
    }

    const queryResponses: QueryResponse[] = await Promise.all(queries);

    return _.reduce(queryResponses, (prev, curr) => {
      return {
        data: prev.data.concat(curr.data),
      };
    });
  }

  private async processTarget(target: QueryTarget, options: QueryOptions): Promise<QueryResponse> {
    const timeFrom = Math.ceil(dateMath.parse(options.range.from));
    const timeTo = Math.ceil(dateMath.parse(options.range.to));
    const queries: DataQueryRequest[] = [];
    let labels = [];

    if (target.tab === Tab.Event) {
      return this.processEventTarget(target, options, timeFrom, timeTo);
    }

    const queryList: DataQueryRequestItem[] = await this.getDataQueryRequestItems(target, options);
    if (queryList.length === 0 || target.error) {
      return Promise.resolve({ data: [] });
    }

    // /dataquery is limited to 100 items, so we need to add new calls if we go over 100 items
    // may want to change how much we split into, but for now, 100 seems like the best
    const qlChunks = _.chunk(queryList, 100);
    for (const qlChunk of qlChunks) {
      // create query requests
      const queryReq: DataQueryRequest = {
        items: qlChunk,
        start: timeFrom,
        end: timeTo,
      };
      if (target.aggregation && target.aggregation !== 'none') {
        queryReq.aggregates = target.aggregation;
        if (!target.granularity) {
          queryReq.granularity = Utils.intervalToGranularity(options.intervalMs);
        } else {
          queryReq.granularity = target.granularity;
        }
      }
      if (target.tab === Tab.Custom && qlChunk[0].function) {
        let idsCount = 0;
        const idRegex = /\[.*?\]/g; // look for [something]
        for (const q of qlChunk) {
          const matches = q.function.match(idRegex);
          if (!matches) break;
          const idsObj = {};
          for (const match of matches) {
            idsObj[match.substr(1, match.length - 2)] = true;
          }
          idsCount += Object.keys(idsObj).length;
        }
        if (idsCount === 0) idsCount = 1; // will fail anyways, just show the api error message

        // check if any aggregates are being used
        const usesAggregates = qlChunk.some(item => item.aliases.length > 0);

        queryReq.limit = Math.floor((usesAggregates ? 10_000 : 100_000) / idsCount);
      } else {
        queryReq.limit = Math.floor((queryReq.aggregates ? 10_000 : 100_000) / qlChunk.length);
      }
      queries.push(queryReq);
    }

    // get the label to each timeseries
    if (target.tab === Tab.Timeseries || target.tab === undefined) {
      if (!target.label) target.label = '';
      if (target.label.match(/{{.*}}/)) {
        try {
          // need to fetch the timeseries
          const ts = await this.getTimeseries(
            {
              q: target.target,
              limit: 1,
            },
            target
          );
          labels.push(this.getTimeseriesLabel(target.label, ts[0]));
        } catch {
          labels.push(target.label);
        }
      } else {
        labels.push(target.label);
      }
    } else if (target.tab === Tab.Asset) {
      target.assetQuery.timeseries.forEach(ts => {
        if (ts.selected) {
          if (!target.label) target.label = '';
          labels.push(this.getTimeseriesLabel(target.label, ts));
        }
      });
    } else {
      let count = 0;
      while (count < queryList.length) {
        cache.getTimeseries(options, target).forEach(ts => {
          if (ts.selected && count < queryList.length) {
            count += 1;
            if (!target.label) {
              if (queryList[0].function) {
                // if using custom functions and no label is specified just use the name of the last timeseries in the function
                labels.push(ts.name);
                return;
              }
              target.label = '';
            }
            labels.push(this.getTimeseriesLabel(target.label, ts));
          }
        });
      }
    }

    // replace variables in labels as well
    labels = labels.map(label => this.templateSrv.replace(label, options.scopedVars));

    const queryRequests = queries.map(q =>
      cache
        .getQuery(
          {
            url: `${this.url}/cogniteapi/${this.project}/timeseries/dataquery`,
            method: 'POST',
            data: q,
            requestId: Utils.getRequestId(options, target),
          },
          this.backendSrv
        )
        .catch(error => {
          return { error };
        })
    );

    let timeseries: (DataQueryRequestResponse | DataQueryError)[];
    try {
      timeseries = await Promise.all(queryRequests);
    } catch (error) {
      return { data: [] };
    }

    let count = 0;
    return {
      data: timeseries.reduce((datapoints, response) => {
        if (isError(response)) {
          // if response was cancelled, no need to show error message
          if (!response.error.cancelled) {
            let errmsg: string;
            if (response.error.data && response.error.data.error) {
              errmsg = `[${response.error.status} ERROR] ${response.error.data.error.message}`;
            } else {
              errmsg = 'Unknown error';
            }
            target.error = errmsg;
          }
          count += 100; // skip over entire batch
          return datapoints;
        }

        const aggregation = response.config.data.aggregates;
        const aggregationPrefix = aggregation ? `${aggregation} ` : '';
        return datapoints.concat(
          response.data.data.items.map(item => {
            if (item.datapoints.length >= response.config.data.limit) {
              target.warning =
                '[WARNING] Datapoints limit was reached, so not all datapoints may be shown. Try increasing the granularity, or choose a smaller time range.';
            }
            return {
              target: labels[count++] ? labels[count - 1] : aggregationPrefix + item.name,
              datapoints: item.datapoints
                .filter(d => d.timestamp >= timeFrom && d.timestamp <= timeTo)
                .map(d => {
                  const val = Utils.getDatasourceValueString(response.config.data.aggregates);
                  return [d[val] === undefined ? d.value : d[val], d.timestamp];
                }),
            };
          })
        );
      }, []),
    };
  }

  private async getDataQueryRequestItems(
    target: QueryTarget,
    options: QueryOptions
  ): Promise<DataQueryRequestItem[]> {
    if (target.tab === Tab.Timeseries || target.tab === undefined) {
      const query: DataQueryRequestItem = {
        name: target.target,
      };
      return [query];
    }

    if (target.tab === Tab.Asset) {
      await this.findAssetTimeseries(target, options);
      return target.assetQuery.timeseries.filter(ts => ts.selected).map(ts => ({ name: ts.name }));
    }

    if (target.tab === Tab.Custom) {
      await this.findAssetTimeseries(target, options);
      // if we don't have any timeseries just return
      if (cache.getTimeseries(options, target).length === 0) {
        target.warning = '[WARNING] No timeseries found.';
        return [];
      }
      if (!target.expr) return [];
      // apply the search expression
      try {
        return parseExpression(
          target.expr,
          options,
          cache.getTimeseries(options, target),
          this.templateSrv,
          target
        );
      } catch (e) {
        target.error = e;
        return [];
      }
    }

    return [];
  }

  private async processEventTarget(
    target: QueryTarget,
    options: QueryOptions,
    startTime: number,
    endTime: number
  ): Promise<QueryResponse> {
    const { expr, filter, columns } = target.eventQuery;
    if (!expr || !columns) return Promise.resolve({ data: [] });

    const events = await this.getEvents(expr, filter, startTime, endTime);

    const columnsList = columns.split(';').filter(column => column !== '');

    const table: Table = {
      columns: columnsList.map(column => {
        return { text: column };
      }),
      rows: [],
      type: 'table',
    };

    events
      .filter(e => e.selected === true)
      .forEach(event => {
        const row = columnsList.map(field => {
          const value = _.get(event, field);
          if (!value) {
            return null;
          }
          if (!isNaN(value)) {
            // if the value is numeric, convert it
            return +value;
          }
          return value;
        });
        table.rows.push(row);
      });

    console.log(events.filter(e => e.selected === true));
    console.log(table);

    return {
      data: [table],
    };
  }

  public async annotationQuery(options: AnnotationQueryOptions): Promise<AnnotationResponse[]> {
    const { range, annotation } = options;
    const { expr, filter, error } = annotation;
    const startTime = Math.ceil(dateMath.parse(range.from));
    const endTime = Math.ceil(dateMath.parse(range.to));
    if (error || !expr) return [];

    const events = await this.getEvents(expr, filter, startTime, endTime);

    return events
      .filter(e => e.selected === true)
      .map(event => ({
        annotation,
        isRegion: true,
        text: event.description,
        time: event.startTime,
        timeEnd: event.endTime,
        title: event.type,
      }));
  }

  private async getEvents(expr: string, filter: string, startTime: number, endTime: number) {
    const queryOptions = parse(expr, ParseType.Event, this.templateSrv);
    if (queryOptions.error) {
      console.error(queryOptions.error);
      return [];
    }
    const filterOptions = parse(filter || '', ParseType.Event, this.templateSrv);
    if (filter && filterOptions.error) {
      console.error(filterOptions.error);
      return [];
    }

    // use maxStartTime and minEndTime so that we include events that are partially in range
    const queryParams = {
      limit: 1000,
      maxStartTime: endTime,
      minEndTime: startTime,
      ...queryOptions.filters.reduce((obj, filter) => {
        obj[filter.property] = filter.value;
        return obj;
      }, {}),
    };

    const result = await cache.getQuery(
      {
        url: `${this.url}/cogniteapi/${this.project}/events/?${Utils.getQueryString(queryParams)}`,
        method: 'GET',
      },
      this.backendSrv
    );
    const events = result.data.items;
    if (!events || events.length === 0) return [];

    Utils.applyFilters(filterOptions.filters, events);

    return events;
  }

  public async getOptionsForDropdown(
    query: string,
    type?: string,
    options?: any
  ): Promise<MetricFindQueryResponse> {
    let urlEnd: string;
    if (type === Tab.Asset) {
      if (query.length === 0) {
        urlEnd = `/cogniteapi/${this.project}/assets?`;
      } else {
        urlEnd = `/cogniteapi/${this.project}/assets/search?query=${query}`;
      }
    } else if (type === Tab.Timeseries) {
      if (query.length === 0) {
        urlEnd = `/cogniteapi/${this.project}/timeseries?`;
      } else {
        urlEnd = `/cogniteapi/${this.project}/timeseries/search?query=${query}`;
      }
    }
    if (options) {
      urlEnd += `&${Utils.getQueryString(options)}`;
    }

    return cache
      .getQuery(
        {
          url: this.url + urlEnd,
          method: 'GET',
        },
        this.backendSrv
      )
      .then((result: { data: TimeSeriesResponse }) =>
        result.data.data.items.map(timeSeriesResponseItem => ({
          text: timeSeriesResponseItem.description
            ? `${timeSeriesResponseItem.name} (${timeSeriesResponseItem.description})`
            : timeSeriesResponseItem.name,
          value:
            type === Tab.Asset ? String(timeSeriesResponseItem.id) : timeSeriesResponseItem.name,
        }))
      );
  }

  async findAssetTimeseries(target: QueryTarget, options: QueryOptions): Promise<void> {
    // replace variables with their values
    const assetId = this.templateSrv.replace(target.assetQuery.target, options.scopedVars);
    const searchQuery: Partial<TimeseriesSearchQuery> = {
      path: target.assetQuery.includeSubtrees ? [assetId] : undefined,
      assetId: !target.assetQuery.includeSubtrees ? assetId : undefined,
      limit: 10000,
    };

    // for custom queries, use cache instead of storing in target object
    if (target.tab === Tab.Custom) {
      target.assetQuery.templatedTarget = assetId;
      const timeseries = cache.getTimeseries(options, target);
      if (!timeseries) {
        const ts = await this.getTimeseries(searchQuery, target);
        cache.setTimeseries(
          options,
          target,
          ts.map(ts => {
            ts.selected = true;
            return ts;
          })
        );
      }
      return Promise.resolve();
    }

    // check if assetId has changed, if not we do not need to perform this query again
    if (
      target.assetQuery.old &&
      assetId === target.assetQuery.old.target &&
      target.assetQuery.includeSubtrees === target.assetQuery.old.includeSubtrees
    ) {
      return Promise.resolve();
    }
    target.assetQuery.old = {
      target: String(assetId),
      includeSubtrees: target.assetQuery.includeSubtrees,
    };

    // since /dataquery can only have 100 items and checkboxes become difficult to use past 100 items,
    //  we only get the first 100 timeseries, and show a warning if there are too many timeseries
    searchQuery.limit = 101;
    const ts = await this.getTimeseries(searchQuery, target);
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

  async getTimeseries(
    searchQuery: Partial<TimeseriesSearchQuery>,
    target: QueryTarget
  ): Promise<TimeSeriesResponseItem[]> {
    return cache
      .getQuery(
        {
          url: `${this.url}/cogniteapi/${this.project}/timeseries?${Utils.getQueryString(
            searchQuery
          )}`,
          method: 'GET',
        },
        this.backendSrv
      )
      .then(
        (result: { data: TimeSeriesResponse }) => {
          return _.cloneDeep(result.data.data.items.filter(ts => !ts.isString));
        },
        error => {
          if (error.data && error.data.error) {
            target.error = `[${error.status} ERROR] ${error.data.error.message}`;
          } else {
            target.error = 'Unknown error';
          }
          return [];
        }
      );
  }

  // this function is for getting metrics (template variables)
  async metricFindQuery(query: VariableQueryData): Promise<MetricFindQueryResponse> {
    const queryOptions = parse(query.query, ParseType.Asset, this.templateSrv);
    if (queryOptions.error) {
      return [{ text: queryOptions.error, value: '-' }];
    }
    const filterOptions = parse(query.filter, ParseType.Asset, this.templateSrv);
    if (query.filter && filterOptions.error) {
      return [{ text: filterOptions.error, value: '-' }];
    }
    const urlEnd = `/cogniteapi/${this.project}/assets/search?`;

    const queryParams = {
      limit: 1000,
      ...queryOptions.filters.reduce((obj, filter) => {
        obj[filter.property] = filter.value;
        return obj;
      }, {}),
    };

    const result = await cache.getQuery(
      {
        url: this.url + urlEnd + Utils.getQueryString(queryParams),
        method: 'GET',
      },
      this.backendSrv
    );

    const assets = result.data.data.items;

    // now filter over these assets with the rest of the filters
    Utils.applyFilters(filterOptions.filters, assets);
    const filteredAssets = assets.filter(asset => asset.selected === true);

    return filteredAssets.map(asset => ({
      text: asset.name,
      value: asset.id,
    }));
  }

  private getTimeseriesLabel(label: string, timeseries: TimeSeriesResponseItem): string {
    // matches with any text within {{ }}
    const variableRegex = /{{([^{}]*)}}/g;
    return label.replace(variableRegex, (full, group) => {
      return _.get(timeseries, group, full);
    });
  }

  testDatasource() {
    return this.backendSrv
      .datasourceRequest({
        url: `${this.url}/cogniteloginstatus`,
        method: 'GET',
      })
      .then(response => {
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
      });
  }
}
