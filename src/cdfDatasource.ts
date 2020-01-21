import {
  Tab,
  QueryTarget,
  DataQueryRequest,
  DataQueryRequestItem,
  QueryOptions,
  TimeSeriesResponseItem,
  HttpMethod,
  RequestParams,
  Response,
  TimeseriesFilterQuery,
  isError,
  TimeSeriesDatapoint,
  Timestamp,
  DataResponse,
  Datapoint,
  ItemsResponse,
} from './types';
import { chunk, get, cloneDeep } from 'lodash';
import { intervalToGranularity, getQueryString, getDatasourceValueString } from './utils';
import cache from './cache';
import { BackendSrv } from 'grafana/app/core/services/backend_srv';
import { TimeSeries } from '@grafana/ui';
const { Asset, Custom, Timeseries } = Tab;

export function filterEmptyQueryTargets(targets): QueryTarget[] {
  // we cannot just map them because it's used somewhere as an input
  // TODO: figure it out and fix
  targets.forEach(target => {
    if (target) {
      target.error = '';
      target.warning = '';
    }
  });

  return targets.filter(target => {
    if (target && !target.hide) {
      if (target.tab === Timeseries || target.tab === undefined) {
        return target.target && target.target !== 'Start typing tag id here';
      }
      if (target.tab === Asset || target.tab === Custom) {
        return target.assetQuery && target.assetQuery.target;
      }
    }
    return false;
  });
}

type Aggregates = Pick<DataQueryRequest, 'aggregates'>;
type Granularity = Pick<DataQueryRequest, 'granularity'>;

export function formQueriesForChunks(
  qlChunks,
  timeFrom: number,
  timeTo: number,
  targetQueriesCount,
  { tab, aggregation, granularity, refId },
  options
): DataQueryRequest[] {
  const resQueries = [];
  let aggregateAndGranularity: Aggregates & Granularity = null;
  const hasAggregates = aggregation && aggregation !== 'none';
  if (hasAggregates) {
    aggregateAndGranularity = {
      aggregates: [aggregation],
      granularity: granularity || intervalToGranularity(options.intervalMs),
    };
  }
  const requestBase = {
    ...aggregateAndGranularity,
    start: timeFrom,
    end: timeTo,
  };
  for (const qlChunk of qlChunks) {
    // keep track of target lengths so we can assign errors later
    targetQueriesCount.push({
      refId,
      count: qlChunk.length,
    });
    // create query requests
    let queryReq: DataQueryRequest;

    if (tab === Tab.Custom && qlChunk[0].expression) {
      // todo: something here, whe might need to assign limits for each synthetic or something
      // synthetics don't support all those limits etc yet
      queryReq = {
        items: qlChunk,
      };
    } else {
      const limit = Math.floor((hasAggregates ? 10_000 : 100_000) / qlChunk.length);
      queryReq = {
        limit,
        ...requestBase,
        items: qlChunk,
      };
    }
    resQueries.push(queryReq);
  }
  return resQueries;
}

export async function formQueriesForTargets(
  targets: QueryTarget[],
  queryLists: DataQueryRequestItem[][],
  timeFrom: number,
  timeTo: number,
  targetQueriesCount: any[],
  options: QueryOptions,
  apiUrl: string,
  project: string,
  backendSrv: BackendSrv
): Promise<[DataQueryRequest[], string[][]]> {
  const resQueries: DataQueryRequest[] = [];
  const resLabels: string[][] = [];
  for (let i = 0; i < targets.length; i++) {
    const [target, queryList] = [targets[i], queryLists[i]];
    if (queryList.length === 0 || target.error) {
      continue;
    }

    // /api/v1/projects/{project}/timeseries/data/list is limited to 100 items, so we chunk
    const qlChunks = chunk(queryList, 100);
    resQueries.push(
      ...formQueriesForChunks(qlChunks, timeFrom, timeTo, targetQueriesCount, target, options)
    );

    const targetLabels = chunk(
      await getLabelsForTarget(target, options, apiUrl, project, backendSrv, queryList),
      100
    );
    resLabels.push(...targetLabels);
  }
  return [resQueries, resLabels];
}

async function getLabelsForTarget(
  target: QueryTarget,
  options: QueryOptions,
  apiUrl: string,
  project: string,
  backendSrv: BackendSrv,
  queryList: DataQueryRequestItem[]
): Promise<string[]> {
  // assign labels to each timeseries
  const labels = [];
  switch (target.tab) {
    case undefined:
    case Tab.Timeseries:
      {
        labels.push(
          await getTimeseriesLabel(target.label, target.target, target, apiUrl, project, backendSrv)
        );
      }
      break;
    case Tab.Asset:
      {
        target.assetQuery.timeseries.forEach(ts => {
          if (ts.selected) {
            labels.push(getLabelWithInjectedProps(target.label || '', ts));
          }
        });
      }
      break;
    case Tab.Custom: {
      const ts = cache.getTimeseries(options, target);
      const useTimeseriesName = !target.label && queryList[0].expression; // if using custom functions and no label is specified just use the name of the last timeseries in the function
      for (let i = 0, count = 0; i < ts.length && count < queryList.length; i++) {
        if (ts[i].selected) {
          count++; // todo: I don't think this count is needed actually
          if (useTimeseriesName) {
            labels.push(ts[i].name);
          } else {
            labels.push(getLabelWithInjectedProps(target.label || '', ts[i]));
          }
        }
      }
    }
  }
  return labels;
}

async function getTimeseriesLabel(
  label,
  externalId,
  target,
  apiUrl,
  project,
  backendSrv
): Promise<string> {
  let resLabel = '';
  if (label && label.match(/{{.*}}/)) {
    try {
      // need to fetch the timeseries
      // todo: batch it, even though it goes though the cache
      const [ts] = await getTimeseries({ externalId }, target, apiUrl, project, backendSrv);
      resLabel = getLabelWithInjectedProps(label, ts);
    } catch {}
  }
  return resLabel;
}

// injects prop values to ts label, ex. `{description}} {{metadata.key1}}` -> 'tsDescription tsMetadataKey1Value'
function getLabelWithInjectedProps(label: string, timeseries: TimeSeriesResponseItem): string {
  // matches with any text within {{ }}
  const variableRegex = /{{([^{}]*)}}/g;
  return label.replace(variableRegex, (full, group) => get(timeseries, group, full));
}

export async function getTimeseries(
  filter: TimeseriesFilterQuery,
  target: QueryTarget,
  apiUrl: string,
  project: string,
  backendSrv: BackendSrv
): Promise<TimeSeriesResponseItem[]> {
  try {
    const endpoint = 'id' in filter || 'externalId' in filter ? 'byids' : 'list';

    const items = await fetchItems<TimeSeriesResponseItem>(
      {
        path: `/timeseries/${endpoint}`,
        method: HttpMethod.POST,
        data: filter,
      },
      apiUrl,
      project,
      backendSrv
    );
    return cloneDeep(items.filter(ts => !ts.isString));
  } catch ({ data, status }) {
    if (data && data.error) {
      target.error = `[${status} ERROR] ${data.error.message}`;
    } else {
      target.error = 'Unknown error';
    }
    return [];
  }
}

export function fetchData<T>(
  request: RequestParams,
  apiUrl: string,
  project: string,
  backendSrv: BackendSrv
): Promise<Response<T>> {
  const { path, data, method, params, requestId, playground } = request;
  const paramsString = params ? `?${getQueryString(params)}` : '';
  const url = `${apiUrl}/${
    playground ? 'playground' : 'cogniteapi'
  }/${project}${path}${paramsString}`;
  const body: any = { url, data, method };
  if (requestId) {
    body.requestId = requestId;
  }
  return cache.getQuery(body, backendSrv);
}

export async function fetchItems<T>(
  params: RequestParams,
  apiUrl: string,
  project: string,
  backendSrv: BackendSrv
) {
  const { data } = await fetchData<T>(params, apiUrl, project, backendSrv);
  return data.items;
}

function showTooMuchDatapointsWarningIfNeeded(items: Datapoint[], limit: number, target) {
  const hasLimitNumberOfDatapoints = items.some(({ datapoints }) => datapoints.length >= limit);
  if (hasLimitNumberOfDatapoints) {
    target.warning =
      '[WARNING] Datapoints limit was reached, so not all datapoints may be shown. Try increasing the granularity, or choose a smaller time range.';
  }
}

export function reduceTimeseries(
  timeseries,
  targetQueriesCount,
  queryTargets,
  timeFrom,
  timeTo
): TimeSeries[] {
  const responseTimeseries: TimeSeries[] = [];

  for (let i = 0; i < timeseries.length; i++) {
    const response = timeseries[i];
    const refId = targetQueriesCount[i].refId;
    const target = queryTargets.find(x => x.refId === refId);
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
    } else {
      const { data, config, labels } = response as DataResponse<ItemsResponse<Datapoint>> & {
        config: any;
        labels: string[];
      };
      const { aggregates, limit } = config.data;
      const { items } = data;
      const aggregateStr = aggregates ? `${aggregates} ` : '';

      showTooMuchDatapointsWarningIfNeeded(items, limit, target);
      const series: TimeSeries[] = items.map(({ datapoints, externalId, id }, i) => {
        const resTarget = labels && labels[i] ? labels[i] : `${aggregateStr}${externalId || id}`;
        const rawDatapoints = datapoints2Tuples(
          (datapoints as Timestamp[]).filter(({ timestamp: ts }) => ts >= timeFrom && ts <= timeTo),
          aggregates
        );
        return {
          target: resTarget,
          datapoints: rawDatapoints,
        };
      });

      responseTimeseries.push(...series);
    }
  }

  return responseTimeseries;
}

export function datapoints2Tuples<T extends Timestamp[]>(
  datapoints: T,
  aggregates
): [number, number][] {
  const prop = getDatasourceValueString(aggregates);
  return datapoints.map(d => datapoint2Tuple(d, prop));
}

function datapoint2Tuple(
  dp: Timestamp | TimeSeriesDatapoint,
  aggregateProp: string
): [number, number] {
  const value = aggregateProp in dp ? dp[aggregateProp] : (dp as TimeSeriesDatapoint).value;
  return [value, dp.timestamp];
}
