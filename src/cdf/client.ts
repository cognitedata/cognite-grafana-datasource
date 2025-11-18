import { get, cloneDeep } from 'lodash';
import { DataFrame, Field, TableData, TimeSeries, guessFieldTypeFromNameAndValue, getTimeZone } from '@grafana/data';
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
  DMSSpace,
  DMSView,
  DMSSearchRequest,
  DMSSearchResponse,
  DMSInstance,
  DMSListRequest,
  DMSListResponse,
  CogniteUnit,
} from '../types/dms';
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
  TimeZone,
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
  { range, intervalMs, timeZone }: QueryOptions & { timeZone: string }
): CDFDataQueryRequest {
  const { aggregation, granularity, cogniteTimeSeries } = target;
  const [start, end] = getRange(range);

  switch (type) {
    case 'synthetic': {
      const limit = calculateDPLimitPerQuery(items.length);
      return {
        items: items.map(({ expression }) => ({ expression, start, end, limit, timeZone })),
      };
    }
    case 'latest': {
      return {
        items: items.map((item) => ({ ...item, before: end })),
      };
    }
    default: {
      let aggregations: Aggregates & Granularity & TimeZone = null;
      const isAggregated = aggregation && aggregation !== 'none';
      if (isAggregated) {
        aggregations = {
          aggregates: [aggregation],
          granularity: granularity || toGranularityWithLowerBound(intervalMs),
          timeZone,
        };
      }
      const limit = calculateDPLimitPerQuery(items.length, isAggregated);
      
      // Add targetUnit to items if specified for CogniteTimeSeries queries
      const itemsWithUnit = items.map((item) => {
        if (cogniteTimeSeries?.targetUnit && item.instanceId) {
          return { ...item, targetUnit: cogniteTimeSeries.targetUnit };
        }
        return item;
      });
      
      return {
        ...aggregations,
        end,
        start,
        items: itemsWithUnit,
        limit
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
  const timeZoneValue = options.timezone === 'browser' ? Intl.DateTimeFormat().resolvedOptions().timeZone : options.timezone;
  const timeZone = timeZoneValue === 'utc' ? timeZoneValue.toUpperCase() : timeZoneValue
  return queriesData.map((itemsData) => formQueryForItems(itemsData, {...options, timeZone }));
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
    case Tab.CogniteTimeSeriesSearch: {
      // For CogniteTimeSeriesSearch, we use the instanceId format as a fallback
      // since name should be loaded at runtime, not persisted in JSON
      if (target.cogniteTimeSeries?.instanceId) {
        const space = target.cogniteTimeSeries.instanceId.space;
        const externalId = target.cogniteTimeSeries.instanceId.externalId;
        const instanceId = `${space}:${externalId}`;
        // If we have a custom label with variables, we can't inject properties from regular timeseries metadata
        // since this is a DMS instance, so we'll use the instanceId as fallback
        return labelSrc && !labelContainsVariableProps(labelSrc) ? [labelSrc] : [instanceId];
      }
      return [labelSrc || 'CogniteTimeSeries'];
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
    const [ts] = await getTimeseries({ items: [id] }, connector);
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

export const convertItemsToDataFrame = (
  items: Resource[],
  columns: string[],
  name: string,
  refId: string
): DataFrame => {

  const firstItem = items[0] ?? {}
  const entries = Object.entries(firstItem)
  const filteredProps = columns.length ?
    entries.filter(([key]) => columns.includes(key)) :
    entries

  const fields: Field[] = filteredProps.map(([key, _value]) => ({ 
    name: key,
    type: guessFieldTypeFromNameAndValue(key, _value),
    values: items.map((item) => item[key]),
    config: {  }
  }))

  return {
    fields,
    refId,
    name,
    length: items.length,
  }
}

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

// DMS API functions
export function fetchDMSSpaces(
  connector: Connector,
  limit = 1000
): Promise<DMSSpace[]> {
  return connector.fetchItems<DMSSpace>({
    method: HttpMethod.GET,
    path: '/models/spaces',
    data: undefined,
    params: { limit, includeGlobal: true },
    cacheTime: CacheTime.ResourceByIds,
  });
}

export function fetchDMSViews(
  connector: Connector,
  space?: string,
  limit = 1000
): Promise<DMSView[]> {
  const params = space 
    ? { space, limit, includeGlobal: true } 
    : { limit, includeGlobal: true };
  return connector.fetchItems<DMSView>({
    method: HttpMethod.GET,
    path: '/models/views',
    data: undefined,
    params,
    cacheTime: CacheTime.ResourceByIds,
  });
}

// Helper function to retry DMS API calls with exponential backoff and jitter on 429 errors
async function retryOnRateLimit<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Only retry on 429 (rate limit) errors
      if (error?.status !== 429 || attempt === maxRetries) {
        throw error;
      }
      
      // Calculate delay with exponential backoff and jitter
      const exponentialDelay = baseDelay * Math.pow(2, attempt);
      const jitter = Math.random() * exponentialDelay * 0.5; // Add up to 50% jitter
      const delay = exponentialDelay + jitter;
      
      console.warn(`Rate limited (429), retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${maxRetries})...`);
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

export function searchDMSInstances(
  connector: Connector,
  searchRequest: DMSSearchRequest
): Promise<DMSInstance[]> {
  return retryOnRateLimit(() =>
    connector.fetchItems<DMSInstance>({
      method: HttpMethod.POST,
      path: '/models/instances/search',
      data: searchRequest,
    })
  );
}

export async function listDMSInstances(
  connector: Connector,
  listRequest: DMSListRequest
): Promise<DMSInstance[]> {
  return retryOnRateLimit(() =>
    connector.fetchItems<DMSInstance>({
      method: HttpMethod.POST,
      path: '/models/instances/list',
      data: listRequest,
    })
  );
}

export async function fetchCogniteUnits(
  connector: Connector
): Promise<CogniteUnit[]> {
  try {
    const instances = await retryOnRateLimit(() =>
      connector.fetchItems<DMSInstance>({
        method: HttpMethod.POST,
        path: '/models/instances/list',
        data: {
          sources: [{
            source: {
              type: 'view',
              space: 'cdf_cdm',
              externalId: 'CogniteUnit',
              version: 'v1',
            },
          }],
          instanceType: 'node',
          limit: 1000,
          filter: {
            equals: {
              property: ['node', 'space'],
              value: 'cdf_cdm_units',
            },
          },
        },
      })
    );
    
    return instances.map((instance) => {
      const unitProps = instance.properties?.['cdf_cdm']?.['CogniteUnit/v1'] || {};
      return {
        space: instance.space,
        externalId: instance.externalId,
        name: unitProps.name || instance.externalId,
        description: unitProps.description,
        symbol: unitProps.symbol,
        quantity: unitProps.quantity,
        source: unitProps.source,
        sourceReference: unitProps.sourceReference,
      };
    });
  } catch (err) {
    console.warn('Failed to fetch units:', err);
    return [];
  }
}

export async function getTimeSeriesUnit(
  connector: Connector,
  instanceId: { space: string; externalId: string }
): Promise<string | undefined> {
  try {
    const instances = await retryOnRateLimit(() =>
      connector.fetchItems<DMSInstance>({
        method: HttpMethod.POST,
        path: '/models/instances/byids',
        data: {
          sources: [{
            source: {
              type: 'view',
              space: 'cdf_cdm',
              externalId: 'CogniteTimeSeries',
              version: 'v1',
            },
          }],
          items: [{
            instanceType: 'node',
            space: instanceId.space,
            externalId: instanceId.externalId,
          }],
          includeTyping: false,
        },
      })
    );

    if (instances.length > 0) {
      const tsProps = instances[0].properties?.['cdf_cdm']?.['CogniteTimeSeries/v1'];
      // Try both 'unit' and 'sourceUnit' properties
      const unit = tsProps?.unit || tsProps?.sourceUnit;
      
      // Handle both string and object formats
      if (typeof unit === 'string') {
        return unit;
      } else if (unit && typeof unit === 'object' && 'externalId' in unit) {
        return unit.externalId;
      }
    }
  } catch (err) {
    console.warn('Failed to fetch timeseries unit:', err);
  }
  return undefined;
}


