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
  Datapoint,
} from './types';
import { get, cloneDeep } from 'lodash';
import { ms2String } from './utils';
import { Connector } from './connector';
import { getLabelsForExpression } from './parser/ts';
import { getRange } from './datasource';
import { TimeSeries } from '@grafana/ui';
import { CacheTime, DATAPOINTS_LIMIT_WARNING } from './constants';

const { Asset, Custom, Timeseries } = Tab;
const variableLabelRegex = /{{([^{}]+)}}/g;

export function formQueryForItems(
  items,
  { tab, aggregation, granularity },
  options
): DataQueryRequest {
  const [start, end] = getRange(options.range);
  if (tab === Custom) {
    const limit = calculateDPLimitPerQuery(items.length);
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
  const limit = calculateDPLimitPerQuery(items.length, isAggregated);
  return {
    ...aggregations,
    end,
    start,
    items,
    limit,
  };
}

function calculateDPLimitPerQuery(queriesNumber: number, hasAggregates: boolean = true) {
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

export async function getLabelsForTarget(
  target: QueryTarget,
  queryList: DataQueryRequestItem[],
  connector: Connector
): Promise<string[]> {
  const labelSrc = target.label || '';
  switch (target.tab) {
    case undefined:
    case Timeseries: {
      return [await getTimeseriesLabel(labelSrc, target.target, connector)];
    }
    case Asset: {
      const tsIds = queryList.map(({ id }) => ({ id }));
      /**
       * TODO: While this is ok perfomence-wise as we have caching, it is not very nice code here.
       * We should refactor labels logic someday
       */
      const timeseries = await getTimeseries({ items: tsIds }, connector, false);
      return timeseries.map(ts => getLabelWithInjectedProps(labelSrc, ts));
    }
    case Custom: {
      if (!labelSrc || labelContainsVariableProps(labelSrc)) {
        const expressions = queryList.map(({ expression }) => expression);
        return getLabelsForExpression(expressions, labelSrc, connector);
      }
      return queryList.map(() => labelSrc);
    }
  }
}

async function getTimeseriesLabel(
  label: string,
  id: number,
  connector: Connector
): Promise<string> {
  let resLabel = label;
  if (label && labelContainsVariableProps(label)) {
    const [ts] = await getTimeseries({ items: [{ id }] }, connector);
    resLabel = getLabelWithInjectedProps(label, ts);
  }
  return resLabel;
}

// injects prop values to ts label, ex. `{{description}} {{metadata.key1}}` -> 'tsDescription tsMetadataKey1Value'
export function getLabelWithInjectedProps(
  label: string,
  timeseries: TimeSeriesResponseItem
): string {
  // matches with any text within {{ }}
  return label.replace(variableLabelRegex, (full, group) => get(timeseries, group, full));
}

export function labelContainsVariableProps(label: string): boolean {
  return label && !!label.match(variableLabelRegex);
}

export async function getTimeseries(
  data: TimeseriesFilterQuery | Items<IdEither>,
  connector: Connector,
  filterIsString: boolean = true
): Promise<TimeSeriesResponseItem[]> {
  const method = HttpMethod.POST;
  let items: TimeSeriesResponseItem[];

  if ('items' in data) {
    items = await connector.fetchItems({
      data,
      method,
      path: `/timeseries/byids`,
      cacheTime: CacheTime.TimeseriesByIds,
    });
  } else {
    items = await connector.fetchAndPaginate({
      data,
      method,
      path: `/timeseries/list`,
      cacheTime: CacheTime.TimeseriesList,
    });
  }

  return cloneDeep(filterIsString ? items.filter(ts => !ts.isString) : items);
}

export function stringifyError(error: any) {
  const { data, status } = error;
  const errorMessage = data?.error?.message || error.message;
  const errorCode = status ? `${status} ` : '';
  return errorMessage ? `[${errorCode}ERROR] ${errorMessage}` : `Unknown error`;
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

export function getLimitsWarnings(items: Datapoint[], limit: number) {
  const hasMorePoints = items.some(({ datapoints }) => datapoints.length >= limit);
  return hasMorePoints ? DATAPOINTS_LIMIT_WARNING : '';
}

export function getCalculationWarnings(items: Datapoint[]) {
  const datapointsErrors = new Set<string>();

  items.forEach(({ datapoints }) => {
    (datapoints as [])
      .map(({ error }) => error)
      .filter(Boolean)
      .forEach(error => {
        datapointsErrors.add(error);
      });
  });

  return Array.from(datapointsErrors).join('\n');
}

export function datapointsPath(isSynthetic: boolean) {
  return `/timeseries/${isSynthetic ? 'synthetic/query' : 'data/list'}`;
}
