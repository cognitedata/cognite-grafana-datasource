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
  IdEither,
  Items,
} from './types';
import { get, cloneDeep } from 'lodash';
import { ms2String } from './utils';
import { Connector } from './connector';
import { getLabelsForExpression, hasAggregates } from './parser/ts';
import { getRange } from './datasource';
import { TimeSeries } from '@grafana/ui';
import { TemplateSrv } from 'grafana/app/features/templating/template_srv';

const { Asset, Custom, Timeseries} = Tab;

export function formQueryForItems(
  items,
  { tab, aggregation, granularity },
  options
): DataQueryRequest {
  const [start, end] = getRange(options.range);
  if (tab === Custom) {
    const isAggregated = items.some(({ expression}) => hasAggregates(expression));
    const limit = calculateDPLimitPerQuery(isAggregated, items.length);
    return {
      items: items.map(({ expression }) => ({ expression, start, end, limit })),
    };
  }
  let aggregations: Aggregates & Granularity = null;
  const isAggregated = aggregation && aggregation !== 'none';
  if (isAggregated) {
    aggregations = {
      aggregates: [aggregation],
      granularity: granularity || ms2String(options.intervalMs),
    };
  }
  const limit = calculateDPLimitPerQuery(isAggregated, items.length);
  return {
    ...aggregations,
    end,
    start,
    items,
    limit,
  };
}

function calculateDPLimitPerQuery(hasAggregates: boolean, queriesNumber: number) {
  return Math.floor((hasAggregates ? 10_000 : 100_000) / Math.min(queriesNumber, 100));
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
    const rawLabels = await getLabelsForTarget(target, items, connector);
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
  queryList: DataQueryRequestItem[],
  connector: Connector
): Promise<string[]> {
  switch (target.tab) {
    case undefined:
    case Timeseries: {
      return [await getTimeseriesLabel(target.label, target.target, target, connector)];
    }
    case Asset: {
      const labelSrc = target.label || '';
      return target.assetQuery.timeseries
        .filter(ts => ts.selected)
        .map(ts => getLabelWithInjectedProps(labelSrc, ts));
    }
    case Custom: {
      const expressions = queryList.map(({ expression }) => expression);
      const labels = await getLabelsForExpression(expressions, target.label, target, connector);
      return labels;
    }
  }
}

async function getTimeseriesLabel(
  label: string = '',
  id: number,
  target: QueryTarget,
  connector: Connector
): Promise<string> {
  let resLabel = label;
  if (label && label.match(/{{.*}}/)) {
    try {
      const [ts] = await getTimeseries({ items: [{ id }] }, target, connector);
      resLabel = getLabelWithInjectedProps(label, ts);
    } catch {}
  }
  return resLabel;
}

// injects prop values to ts label, ex. `{description}} {{metadata.key1}}` -> 'tsDescription tsMetadataKey1Value'
export function getLabelWithInjectedProps(
  label: string,
  timeseries: TimeSeriesResponseItem
): string {
  // matches with any text within {{ }}
  const variableRegex = /{{([^{}]*)}}/g;
  return label.replace(variableRegex, (full, group) => get(timeseries, group, full));
}

export async function getTimeseries(
  data: TimeseriesFilterQuery | Items<IdEither>,
  target: QueryTarget,
  connector: Connector,
  filterIsString: boolean = true
): Promise<TimeSeriesResponseItem[]> {
  try {
    const method = HttpMethod.POST;
    let items: TimeSeriesResponseItem[];

    if ('items' in data) {
      items = await connector.fetchItems({
        data,
        method,
        path: `/timeseries/byids`,
      });
    } else {
      items = await connector.fetchAndPaginate({
        data,
        method,
        path: `/timeseries/list`,
      });
    }

    return cloneDeep(filterIsString ? items.filter(ts => !ts.isString) : items);
  } catch (error) {
    const { data, status } = error;
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
  aggregate: string
): Tuple<number>[] {
  return datapoints.map(d => datapoint2Tuple(d, aggregate));
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
