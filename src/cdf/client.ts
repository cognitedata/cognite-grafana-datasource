import { get, cloneDeep } from 'lodash';
import { TableData, TimeSeries } from '@grafana/data';
import {
  TimeSeriesDatapoint,
  Timestamp,
  Items,
  Datapoint,
  IdEither,
  TimeSeriesResponseItem,
  Resource,
  CogniteRelationshipResponse,
  RelationshipsFilter,
  EventsFilterTimeParams,
} from './types';
import {
  Tab,
  QueryTarget,
  CDFDataQueryRequest,
  DataQueryRequestItem,
  QueryOptions,
  HttpMethod,
  TimeseriesFilterQuery,
  DataQueryRequestResponse,
  ResponseMetadata,
  Aggregates,
  Granularity,
  Tuple,
  SuccessResponse,
  Responses,
  Result,
  Ok,
  Err,
  CogniteTargetObj,
  QueriesDataItem,
  DataQueryRequestType,
} from '../types';
import { toGranularityWithLowerBound, getRange } from '../utils';
import { Connector } from '../connector';
import { getLabelsForExpression } from '../parser/ts';
import { CacheTime, DATAPOINTS_LIMIT_WARNING, DateFields } from '../constants';
import { filterdataSetIds, filterExternalId, filterLabels } from './helper';

const { Asset, Custom, Timeseries } = Tab;
const variableLabelRegex = /{{([^{}]+)}}/g;

export function formQueryForItems(
  { items, type, target }: QueriesDataItem,
  { range, intervalMs }: QueryOptions
): CDFDataQueryRequest {
  const { aggregation, granularity } = target;
  const [start, end] = getRange(range);

  switch (type) {
    case 'synthetic': {
      const limit = calculateDPLimitPerQuery(items.length);
      return {
        items: items.map(({ expression }) => ({ expression, start, end, limit })),
      };
    }
    case 'latest': {
      return {
        items: items.map((item) => ({ ...item, before: end })),
      };
    }
    default: {
      let aggregations: Aggregates & Granularity = null;
      const isAggregated = aggregation && aggregation !== 'none';
      if (isAggregated) {
        aggregations = {
          aggregates: [aggregation],
          granularity: granularity || toGranularityWithLowerBound(intervalMs),
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
  }
}

function calculateDPLimitPerQuery(queriesNumber: number, hasAggregates = true) {
  return Math.floor((hasAggregates ? 10_000 : 100_000) / Math.min(queriesNumber, 100));
}

export function formQueriesForTargets(
  queriesData: QueriesDataItem[],
  options: QueryOptions
): CDFDataQueryRequest[] {
  return queriesData.map((itemsData) => formQueryForItems(itemsData, options));
}

export async function getLabelsForTarget(
  target: QueryTarget,
  queryList: DataQueryRequestItem[],
  connector: Connector
): Promise<string[]> {
  const labelSrc = target.label || '';
  switch (target.tab) {
    default:
    case Timeseries: {
      return [await getTimeseriesLabel(labelSrc, targetToIdEither(target), connector)];
    }
    case Asset: {
      const tsIds = queryList.map(({ id }) => ({ id }));
      /**
       * TODO: While this is ok perfomence-wise as we have caching, it is not very nice code here.
       * We should refactor labels logic someday
       */
      const timeseries = await getTimeseries({ items: tsIds }, connector, false);
      return timeseries.map((ts) => getLabelWithInjectedProps(labelSrc, ts));
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
  id: IdEither,
  connector: Connector
): Promise<string> {
  let resLabel = label;
  if (label && labelContainsVariableProps(label)) {
    const [ts] = await getTimeseries({ items: [id] }, connector, false);
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
  filterIsString = true
): Promise<TimeSeriesResponseItem[]> {
  const method = HttpMethod.POST;
  let items: TimeSeriesResponseItem[];

  if ('items' in data) {
    items = await connector.fetchItems({
      data,
      method,
      path: `/timeseries/byids`,
      cacheTime: CacheTime.ResourceByIds,
    });
  } else {
    items = await connector.fetchAndPaginate({
      data,
      method,
      path: `/timeseries/list`,
      cacheTime: CacheTime.TimeseriesList,
    });
  }
  return cloneDeep(filterIsString ? items.filter((ts) => !ts.isString) : items);
}

export function fetchSingleTimeseries(id: IdEither, connector: Connector) {
  return connector.fetchItems<Resource>({
    data: { items: [id] },
    path: `/timeseries/byids`,
    method: HttpMethod.POST,
    cacheTime: CacheTime.ResourceByIds,
  });
}

export function fetchSingleAsset(id: IdEither, connector: Connector) {
  return connector.fetchItems<Resource>({
    data: { items: [id] },
    path: `/assets/byids`,
    method: HttpMethod.POST,
    cacheTime: CacheTime.ResourceByIds,
  });
}

export function stringifyError(error: any) {
  const { data, status } = error;
  const errorMessage = data?.error?.message || error.message;
  const missing = data?.error?.missing && data?.error?.missing.map(JSON.stringify);
  const missingStr = missing ? `\nMissing: ${missing}` : '';
  const errorCode = status ? `${status} ` : '';
  return errorMessage ? `[${errorCode}ERROR] ${errorMessage}${missingStr}` : `Unknown error`;
}

function filterDpsOutOfRange(datapoints: Timestamp[], start: number, end: number) {
  return datapoints.filter(({ timestamp }) => timestamp >= start && timestamp <= end);
}

function generateTargetTsLabel(
  id: number,
  aggregates: string,
  type: DataQueryRequestType,
  externalId?: string
) {
  const idEither = `${externalId || id}`;
  const aggregateStr = aggregates ? `${aggregates} ` : '';
  return type === 'latest' ? idEither : `${aggregateStr}${idEither}`;
}

export function reduceTimeseries(
  metaResponses: SuccessResponse[],
  [start, end]: Tuple<number>
): TimeSeries[] {
  const responseTimeseries: TimeSeries[] = [];

  metaResponses.forEach(({ result, metadata }) => {
    const { labels, type } = metadata;
    const { aggregates } = result.config.data;
    const { items } = result.data;

    const series = items.map(({ datapoints, externalId, id }, i) => {
      const label = labels && labels[i];
      const resTarget = label || generateTargetTsLabel(id, aggregates, type, externalId);
      const dpsInRange =
        type === 'latest' ? datapoints : filterDpsOutOfRange(datapoints, start, end);
      const rawDatapoints = datapoints2Tuples(dpsInRange, aggregates);
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
): Array<Tuple<number>> {
  return datapoints.map((d) => datapoint2Tuple(d, aggregate));
}

function datapoint2Tuple(
  dp: Timestamp | TimeSeriesDatapoint,
  aggregateProp: string
): Tuple<number> {
  const value = aggregateProp in dp ? dp[aggregateProp] : (dp as TimeSeriesDatapoint).value;
  return [value, dp.timestamp];
}

export async function concurrent<TQuery, TResult, TError>(
  queries: TQuery[],
  queryProxy: (query: TQuery) => Promise<Result<TResult, TError>>
): Promise<Responses<TResult, TError>> {
  const later = queries.map(queryProxy);
  const results = await Promise.all(later);
  const failed = results.filter((res) => res.isErr).map((err: Err<TResult, TError>) => err.error);
  const succeded = results.filter((res) => res.isOk).map((ok: Ok<TResult, TError>) => ok.value);

  return { succeded, failed };
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
      .forEach((error) => {
        datapointsErrors.add(error);
      });
  });

  return Array.from(datapointsErrors).join('\n');
}

export function datapointsPath(type: DataQueryRequestType) {
  const paths = {
    synthetic: 'synthetic/query',
    latest: 'data/latest',
    data: 'data/list',
  };
  return `/timeseries/${paths[type]}`;
}

export const targetToIdEither = (obj: CogniteTargetObj) => {
  return obj.targetRefType === 'externalId'
    ? {
        externalId: obj.target,
      }
    : {
        id: obj.target,
      };
};

export const convertItemsToTable = (
  items: Resource[],
  columns: string[],
  name: string
): TableData => {
  const rows = items.map((item) =>
    columns.map((field) => {
      const res = get(item, field);
      const isDate = res !== undefined && res !== null && DateFields.includes(field);
      return isDate ? new Date(res) : res;
    })
  );

  return {
    rows,
    type: 'table',
    columns: columns.map((text) => ({ text })),
    name,
  };
};

export function fetchRelationships(
  {
    labels = { containsAny: [] },
    dataSetIds = [],
    sourceExternalIds = [],
    limit = 1000,
    isTypeTimeseries,
  }: RelationshipsFilter,
  connector: Connector,
  timeFrame:
    | []
    | {
        activeAtTime: {
          max: number;
          min: number;
        };
      }
) {
  const filter = {
    ...filterLabels(labels),
    ...filterdataSetIds(dataSetIds),
    ...filterExternalId(sourceExternalIds, isTypeTimeseries),
    ...timeFrame,
  };
  return connector.fetchItems<CogniteRelationshipResponse>({
    method: HttpMethod.POST,
    path: '/relationships/list',
    data: {
      fetchResources: true,
      limit,
      filter,
    },
  });
}
