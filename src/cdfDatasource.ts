import {
  Tab,
  QueryTarget,
  DataQueryRequest,
  DataQueryRequestItem,
  QueryOptions,
  TimeSeriesResponseItem,
  HttpMethod,
  TimeseriesFilterQuery,
  TimeSeriesDatapoint,
  Timestamp,
  DataQueryRequestResponse,
  ResponseMetadata,
  Aggregates,
  Granularity,
  Tuple,
  QueriesData,
  SuccessResponse,
  Responses,
} from './types';
import { get, cloneDeep } from 'lodash';
import { ms2String, getDatasourceValueString } from './utils';
import cache from './cache';
import { Connector } from './connector';
import { getRange } from './datasource';
import { TimeSeries } from '@grafana/ui';
import { TemplateSrv } from 'grafana/app/features/templating/template_srv';

export function formQueryForItems(
  items,
  { tab, aggregation, granularity },
  options
): DataQueryRequest {
  if (tab === Tab.Custom && items[0].expression) {
    // why zero?
    // todo: something here, whe might need to assign limits for each synthetic or something
    // synthetics don't support all those limits etc yet
    return { items };
  }
  {
    // TODO: limit used to be divided by qlChunk.length, but I am not sure it works that way

    const [start, end] = getRange(options.range);
    let aggregations: Aggregates & Granularity = null;
    const hasAggregates = aggregation && aggregation !== 'none';
    if (hasAggregates) {
      aggregations = {
        aggregates: [aggregation],
        granularity: granularity || ms2String(options.intervalMs),
      };
    }
    return {
      ...aggregations,
      end,
      start,
      items,
      limit: hasAggregates ? 10_000 : 100_000,
    };
  }
}

export function formQueriesForTargets(
  queriesData: QueriesData,
  options: QueryOptions
): DataQueryRequest[] {
  return queriesData.map(({ target, items }) => {
    return formQueryForItems(items, target, options);
  });
}

export async function formMetadatasForTargets(
  queriesData: QueriesData,
  options: QueryOptions,
  connector: Connector,
  templateSrv: TemplateSrv
): Promise<ResponseMetadata[]> {
  const promises = queriesData.map(async ({ target, items }) => {
    const rawLabels = await getLabelsForTarget(target, options, items, connector);
    const labels = rawLabels.map(raw => templateSrv.replace(raw, options.scopedVars));
    return {
      target,
      labels,
    };
  });
  return Promise.all(promises);
}

async function getLabelsForTarget(
  target: QueryTarget,
  options: QueryOptions,
  queryList: DataQueryRequestItem[],
  connector: Connector
): Promise<string[]> {
  // assign labels to each timeseries
  const labels = [];
  switch (target.tab) {
    case undefined:
    case Tab.Timeseries:
      {
        labels.push(await getTimeseriesLabel(target.label, target.target, target, connector));
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
      const useExternalId = !target.label && queryList[0].expression; // if using custom functions and no label is specified just use the externalId of the last timeseries in the function
      for (let i = 0, count = 0; i < ts.length && count < queryList.length; i++) {
        if (ts[i].selected) {
          count++; // todo: I don't think this count is needed actually
          if (useExternalId) {
            labels.push(ts[i].externalId);
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
  connector: Connector
): Promise<string> {
  let resLabel = '';
  if (label && label.match(/{{.*}}/)) {
    try {
      const [ts] = await getTimeseries({ externalId }, target, connector);
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
  connector: Connector
): Promise<TimeSeriesResponseItem[]> {
  try {
    const endpoint = 'id' in filter || 'externalId' in filter ? 'byids' : 'list';

    const items = await connector.fetchItems<TimeSeriesResponseItem>({
      path: `/timeseries/${endpoint}`,
      method: HttpMethod.POST,
      data: filter,
    });
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

export function reduceTimeseries(
  metaResponses: SuccessResponse<ResponseMetadata, DataQueryRequestResponse>[],
  [start, end]: Tuple<number>
): TimeSeries[] {
  const responseTimeseries: TimeSeries[] = [];

  metaResponses.forEach(({ result, metadata }) => {
    const { labels } = metadata;
    const { aggregates } = result.config.data;
    const { items } = result.data;
    const aggregateStr = aggregates ? `${aggregates} ` : '';

    const series = items.map(({ datapoints, externalId, id }, i) => {
      const label = labels && labels[i];
      const resTarget = label || `${aggregateStr}${externalId || id}`;
      const filteredDatapoints = (datapoints as Timestamp[]).filter(
        ({ timestamp }) => timestamp >= start && timestamp <= end
      );
      const rawDatapoints = datapoints2Tuples(filteredDatapoints, aggregates);
      return {
        target: resTarget,
        datapoints: rawDatapoints,
      };
    });

    responseTimeseries.push(...series);
  });

  return responseTimeseries;
}

export function datapoints2Tuples<T extends Timestamp[]>(
  datapoints: T,
  aggregates
): Tuple<number>[] {
  const prop = getDatasourceValueString(aggregates);
  return datapoints.map(d => datapoint2Tuple(d, prop));
}

function datapoint2Tuple(
  dp: Timestamp | TimeSeriesDatapoint,
  aggregateProp: string
): Tuple<number> {
  const value = aggregateProp in dp ? dp[aggregateProp] : (dp as TimeSeriesDatapoint).value;
  return [value, dp.timestamp];
}

export async function promiser<Query, Metadata, Response>(
  queries: Query[],
  metadatas: Metadata[],
  toPromise: (query: Query, metadata: Metadata) => Promise<Response>
): Promise<Responses<Metadata, Response>> {
  const succeded = [];
  const failed = [];
  const promises = queries.map(async (query, i) => {
    const metadata = metadatas[i];
    try {
      const result = await toPromise(query, metadata);
      succeded.push({ result, metadata });
    } catch (error) {
      failed.push({ error, metadata });
    }
  });
  await Promise.all(promises);
  return {
    succeded,
    failed,
  };
}
