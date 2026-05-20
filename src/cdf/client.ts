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
  DMSFilter,
  CogniteUnit,
  CogniteActivity,
  InvolvedView,
  ContainerInspectResponse,
  DMSViewWithProperties,
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

/** Per-bucket `stateAggregates[]` with one series per state in the panel. */
const STATE_MULTI_AGGREGATES = new Set([
  'stateDuration',
  'stateCount',
  'stateTransitions',
]);

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
      const isStateTS = cogniteTimeSeries?.type === 'state';
      const isAggregated = aggregation && aggregation !== 'none';
      let aggregations: Aggregates & Granularity & TimeZone = null;
      if (isAggregated) {
        let aggregates: string[];
        if (isStateTS) {
          if (STATE_MULTI_AGGREGATES.has(aggregation)) {
            aggregates = [aggregation];
          } else if (aggregation === 'count') {
            aggregates = ['count'];
          } else {
            // dominantState: single series from stateDuration; API still returns stateAggregates
            aggregates = ['stateDuration'];
          }
        } else {
          aggregates = [aggregation];
        }
        aggregations = {
          aggregates,
          granularity: granularity || toGranularityWithLowerBound(intervalMs),
          timeZone,
        };
      }
      const limit = calculateDPLimitPerQuery(items.length, isAggregated);

      // Add targetUnit to items if specified for numeric CogniteTimeSeries queries (state TS doesn't use units)
      const targetUnit = !isStateTS ? cogniteTimeSeries?.targetUnit : undefined;
      const itemsWithUnit = targetUnit
        ? items.map((item) => item.instanceId ? { ...item, targetUnit } : item)
        : items;

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
      // Default label for CogniteTimeSeries: <space>:<externalId> of the picked instance.
      if (target.cogniteTimeSeries?.instanceId) {
        const space = target.cogniteTimeSeries.instanceId.space;
        const externalId = target.cogniteTimeSeries.instanceId.externalId;
        const instanceLabel = `${space}:${externalId}`;
        if (labelSrc && labelContainsVariableProps(labelSrc)) {
          const viewSpec = {
            space: target.cogniteTimeSeries.space,
            externalId: target.cogniteTimeSeries.externalId,
            version: target.cogniteTimeSeries.version,
          };
          const [props, viewProps] = await Promise.all([
            fetchCogniteTimeSeriesInstance(connector, viewSpec, target.cogniteTimeSeries.instanceId),
            fetchDMSViewProperties(connector, viewSpec),
          ]);
          return [interpolateCogniteTimeSeriesInstanceLabel(labelSrc, props, viewProps)];
        }
        return [labelSrc || instanceLabel];
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

/** Interpolate `{{property}}` tokens from a CogniteTimeSeries DMS instance + view schema. */
export function interpolateCogniteTimeSeriesInstanceLabel(
  labelSrc: string,
  props: Record<string, any>,
  viewPropertyNames: string[]
): string {
  // `space` and `externalId` come from the instance node itself (not the view
  // schema), but are exposed in `props` and useful in labels.
  const validPropNames = new Set([...viewPropertyNames, 'space', 'externalId']);
  return labelSrc.replace(variableLabelRegex, (_full, group) => {
    if (group.startsWith('$')) {
      return `{{${group}}}`;
    }
    const rootKey = group.split('.')[0];
    if (!validPropNames.has(rootKey)) {
      return `:${group}`;
    }
    const val = get(props, group);
    if (val == null) {
      return group.includes('.') ? `:${group}` : 'null';
    }
    if (typeof val === 'object') {
      return JSON.stringify(val);
    }
    return String(val);
  });
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

type StateAggregateEntry = {
  numericValue?: number;
  stringValue?: string;
  stateCount?: number;
  stateTransitions?: number;
  stateDuration?: number;
};

type StateBucket = {
  timestamp: number;
  stateAggregates?: StateAggregateEntry[];
};

/** Replaces all `{{$state}}` occurrences in a multi-state series label. */
const STATE_TOKEN_RE = /\{\{\s*\$state\s*\}\}/g;

function pickStateLabel(state: { numericValue: number; stringValue?: string }): string {
  return state.stringValue ?? String(state.numericValue);
}

function valueFromStateEntry(
  entry: StateAggregateEntry | undefined,
  field: 'stateDuration' | 'stateCount' | 'stateTransitions'
): number {
  if (!entry) {
    return 0;
  }
  switch (field) {
    case 'stateDuration':
      return entry.stateDuration ?? 0;
    case 'stateCount':
      return entry.stateCount ?? 0;
    case 'stateTransitions':
      return entry.stateTransitions ?? 0;
    default:
      return 0;
  }
}

/** One Grafana series per distinct state; missing entries in a bucket become 0. */
function expandMultiStateSeries(
  datapoints: StateBucket[],
  baseLabel: string,
  field: 'stateDuration' | 'stateCount' | 'stateTransitions',
  appendStateSuffix: boolean
): TimeSeries[] {
  const seen = new Map<number, { numericValue: number; stringValue?: string }>();
  for (const bucket of datapoints) {
    for (const e of bucket.stateAggregates ?? []) {
      if (e.numericValue === undefined) {
        continue;
      }
      if (!seen.has(e.numericValue)) {
        seen.set(e.numericValue, {
          numericValue: e.numericValue,
          stringValue: e.stringValue,
        });
      }
    }
  }
  const states = Array.from(seen.values()).sort((a, b) => a.numericValue - b.numericValue);
  return states.map((state) => {
    const suffix = pickStateLabel(state);
    const replaced = baseLabel.replace(STATE_TOKEN_RE, suffix);
    const target =
      replaced !== baseLabel
        ? replaced
        : appendStateSuffix
          ? `${baseLabel} - ${suffix}`
          : baseLabel;
    const datapointsOut: Array<[number, number]> = datapoints.map((bucket) => {
      const entry = (bucket.stateAggregates ?? []).find(
        (e) => e.numericValue === state.numericValue
      );
      const v = valueFromStateEntry(entry, field);
      return [v, bucket.timestamp];
    });
    return { target, datapoints: datapointsOut };
  });
}

export function reduceTimeseries(
  metaResponses: SuccessResponse[],
  [start, end]: Tuple<number>
): TimeSeries[] {
  const responseTimeseries: TimeSeries[] = [];

  metaResponses.forEach(({ result, metadata }) => {
    const { labels, type, target } = metadata;
    const { aggregates } = result.config.data;
    const { items } = result.data;

    const isStateTS = target?.cogniteTimeSeries?.type === 'state';
    let stateAggregation = isStateTS
      ? (type === 'latest' ? 'none' : target?.aggregation)
      : undefined;
    const stateAsNumeric = isStateTS && !!target?.cogniteTimeSeries?.displayAsNumeric;
    const useStateReducer = isStateTS && stateAggregation !== 'count';
    const isMultiStateAgg =
      isStateTS &&
      !!stateAggregation &&
      STATE_MULTI_AGGREGATES.has(stateAggregation);

    const series = items.flatMap(({ datapoints, externalId, id }, i) => {
      const label = labels && labels[i];
      const baseLabel = label || generateTargetTsLabel(id, aggregates, type, externalId);
      const dpsInRange =
        type === 'latest' ? datapoints : filterDpsOutOfRange(datapoints, start, end);

      if (isMultiStateAgg && stateAggregation) {
        // Only auto-append " - <state>" for the default label (user left Label blank).
        const appendStateSuffix = !target?.label;
        return expandMultiStateSeries(
          dpsInRange as StateBucket[],
          baseLabel,
          stateAggregation as 'stateDuration' | 'stateCount' | 'stateTransitions',
          appendStateSuffix
        );
      }

      const tuples = useStateReducer
        ? stateDatapoints2Tuples(dpsInRange, stateAggregation, stateAsNumeric)
        : datapoints2Tuples(dpsInRange, aggregates);
      return [
        {
          target: baseLabel,
          datapoints: tuples,
        } as TimeSeries,
      ];
    });

    responseTimeseries.push(...(series as TimeSeries[]));
  });

  return responseTimeseries;
}

type StateValue = number | string | null;
type StateTuple = [StateValue, number];

const entryValue = (
  e: StateAggregateEntry | undefined,
  asNumeric: boolean
): StateValue => {
  if (!e) {
    return null;
  }
  if (asNumeric) {
    return e.numericValue ?? null;
  }
  return e.stringValue ?? e.numericValue ?? null;
};

function reduceStateBucket(
  bucket: StateBucket,
  aggregation: string,
  asNumeric: boolean
): StateValue {
  const entries = bucket.stateAggregates;
  if (!entries || entries.length === 0) {
    return null;
  }
  switch (aggregation) {
    case 'dominantState': {
      let dominant = entries[0];
      for (const e of entries) {
        if ((e.stateDuration ?? 0) > (dominant.stateDuration ?? 0)) {
          dominant = e;
        }
      }
      return entryValue(dominant, asNumeric);
    }
    default:
      return null;
  }
}

export function stateDatapoints2Tuples(
  datapoints: any[],
  aggregation: string | undefined,
  asNumeric = false
): StateTuple[] {
  if (!aggregation || aggregation === 'none') {
    return datapoints
      .map((dp): StateTuple | null => {
        const value: StateValue = asNumeric
          ? (dp.numericValue ?? null)
          : (dp.stringValue ?? dp.numericValue ?? null);
        return value === null ? null : [value, dp.timestamp];
      })
      .filter((t): t is StateTuple => t !== null);
  }
  return datapoints
    .map((bucket: StateBucket): StateTuple | null => {
      const value = reduceStateBucket(bucket, aggregation, asNumeric);
      return value === null ? null : [value, bucket.timestamp];
    })
    .filter((t): t is StateTuple => t !== null);
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

// Fetch all property names of a specific DMS view (includes inherited properties)
export async function fetchDMSViewProperties(
  connector: Connector,
  viewSpec: { space: string; externalId: string; version: string }
): Promise<string[]> {
  try {
    const response = await connector.fetchData<{ data: { items: DMSViewWithProperties[] } }>({
      method: HttpMethod.POST,
      path: '/models/views/byids',
      data: {
        items: [{ space: viewSpec.space, externalId: viewSpec.externalId, version: viewSpec.version }],
        includeInheritedProperties: true,
      },
      cacheTime: CacheTime.ResourceByIds,
    });
    const view = response.data?.items?.[0];
    if (!view?.properties) {
      return [];
    }
    return Object.keys(view.properties);
  } catch (err) {
    console.warn('Failed to fetch DMS view properties:', err);
    return [];
  }
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
      const isRateLimitError = error?.status === 429;
      const hasRetriesLeft = attempt < maxRetries;

      if (!isRateLimitError || !hasRetriesLeft) {
        throw error;
      }

      const exponentialDelay = baseDelay * Math.pow(2, attempt);
      const jitter = Math.random() * exponentialDelay * 0.5;
      const delay = exponentialDelay + jitter;

      console.warn(
        `Rate limited (429). Retrying in ${Math.round(delay)}ms ` +
        `(attempt ${attempt + 1}/${maxRetries})`
      );

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

export interface TimeSeriesProperties {
  unit?: string;
  type?: string;
  stateSet?: { space: string; externalId: string };
}

export interface StateSetEntry {
  numericValue: number;
  stringValue: string;
}

export async function getTimeSeriesProperties(
  connector: Connector,
  instanceId: { space: string; externalId: string }
): Promise<TimeSeriesProperties> {
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
      // Only the structured `unit` direct relation (a CogniteUnit reference) qualifies as
      // a storage unit for conversion. The free-text `sourceUnit` is informational and not
      // resolvable against the unit catalog, so we ignore it here.
      const rawUnit = tsProps?.unit;
      const unit =
        rawUnit && typeof rawUnit === 'object' && typeof rawUnit.externalId === 'string'
          ? rawUnit.externalId
          : undefined;

      const rawType = tsProps?.type;
      const type = typeof rawType === 'string' ? rawType : undefined;

      const rawStateSet = tsProps?.stateSet;
      const stateSet = rawStateSet && typeof rawStateSet === 'object'
        && typeof rawStateSet.space === 'string'
        && typeof rawStateSet.externalId === 'string'
          ? { space: rawStateSet.space, externalId: rawStateSet.externalId }
          : undefined;

      return { unit, type, stateSet };
    }
  } catch (err) {
    console.warn('Failed to fetch timeseries properties:', err);
  }
  return {};
}

export async function getTimeSeriesUnit(
  connector: Connector,
  instanceId: { space: string; externalId: string }
): Promise<string | undefined> {
  return (await getTimeSeriesProperties(connector, instanceId)).unit;
}

// Fetch the entries of a CogniteStateSet by its instance reference.
// Returns the list of { numericValue, stringValue } pairs that the state TS can resolve to.
export async function getStateSetStates(
  connector: Connector,
  ref: { space: string; externalId: string }
): Promise<StateSetEntry[]> {
  if (!connector.isStateTimeSeriesEnabled()) {
    return [];
  }
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
              externalId: 'CogniteStateSet',
              version: 'v1',
            },
          }],
          items: [{
            instanceType: 'node',
            space: ref.space,
            externalId: ref.externalId,
          }],
          includeTyping: false,
        },
        headers: { 'cdf-version': 'beta' },
      })
    );

    if (!instances.length) {
      return [];
    }
    const props = instances[0].properties?.['cdf_cdm']?.['CogniteStateSet/v1'];
    const rawStates = Array.isArray(props?.states) ? props.states : [];
    return rawStates
      .map((s: any): StateSetEntry | null => {
        const numericValue = typeof s?.numericValue === 'number' ? s.numericValue : undefined;
        const stringValue = typeof s?.stringValue === 'string' ? s.stringValue : undefined;
        if (numericValue === undefined || stringValue === undefined) {
          return null;
        }
        return { numericValue, stringValue };
      })
      .filter((s: StateSetEntry | null): s is StateSetEntry => s !== null)
      .sort((a: StateSetEntry, b: StateSetEntry) => a.numericValue - b.numericValue);
  } catch (err) {
    console.warn('Failed to fetch state set states:', err);
    return [];
  }
}

// Fetch the full property bag of a CogniteTimeSeries instance from a specific view, so
// label templates like `{{name}}` or `{{metadata.foo}}` can be interpolated at query time.
export async function fetchCogniteTimeSeriesInstance(
  connector: Connector,
  viewSpec: { space: string; externalId: string; version: string },
  instanceId: { space: string; externalId: string }
): Promise<Record<string, any>> {
  try {
    const instances = await retryOnRateLimit(() =>
      connector.fetchItems<DMSInstance>({
        method: HttpMethod.POST,
        path: '/models/instances/byids',
        data: {
          sources: [{
            source: {
              type: 'view',
              space: viewSpec.space,
              externalId: viewSpec.externalId,
              version: viewSpec.version,
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
    if (!instances.length) {
      return {};
    }
    const instance = instances[0];
    const props =
      instance.properties?.[viewSpec.space]?.[`${viewSpec.externalId}/${viewSpec.version}`] ?? {};
    return {
      space: instance.space,
      externalId: instance.externalId,
      ...props,
    };
  } catch (err) {
    console.warn('Failed to fetch CogniteTimeSeries instance:', err);
    return {};
  }
}

// Fetch views that implement the CogniteTimeSeries container
export async function fetchCogniteTimeSeriesViews(
  connector: Connector
): Promise<InvolvedView[]> {
  try {
    const response = await retryOnRateLimit(() =>
      connector.fetchData<{ data: ContainerInspectResponse }>({
        method: HttpMethod.POST,
        path: '/models/containers/inspect',
        data: {
          items: [
            {
              space: 'cdf_cdm',
              externalId: 'CogniteTimeSeries',
            },
          ],
          inspectionOperations: {
            involvedViews: {
              allVersions: true,
            },
            totalInvolvedViewCount: {
              allVersions: true,
              includeUnavailableViews: true,
            },
          },
        },
        cacheTime: CacheTime.ResourceByIds,
      })
    );

    const item = response.data?.items?.[0];
    if (item?.inspectionResults?.involvedViews) {
      return item.inspectionResults.involvedViews;
    }
    return [];
  } catch (err) {
    console.warn('Failed to fetch CogniteTimeSeries views:', err);
    return [];
  }
}

// Fetch views that implement the CogniteActivity container
export async function fetchCogniteActivityViews(
  connector: Connector
): Promise<InvolvedView[]> {
  try {
    const response = await retryOnRateLimit(() =>
      connector.fetchData<{ data: ContainerInspectResponse }>({
        method: HttpMethod.POST,
        path: '/models/containers/inspect',
        data: {
          items: [
            {
              space: 'cdf_cdm',
              externalId: 'CogniteActivity',
            },
          ],
          inspectionOperations: {
            involvedViews: {
              allVersions: true,
            },
            totalInvolvedViewCount: {
              allVersions: true,
              includeUnavailableViews: true,
            },
          },
        },
        cacheTime: CacheTime.ResourceByIds,
      })
    );

    const item = response.data?.items?.[0];
    if (item?.inspectionResults?.involvedViews) {
      return item.inspectionResults.involvedViews;
    }
    return [];
  } catch (err) {
    console.warn('Failed to fetch CogniteActivity views:', err);
    return [];
  }
}

async function fetchCogniteContainerViews(connector: Connector, containerExternalId: string): Promise<InvolvedView[]> {
  try {
    const response = await retryOnRateLimit(() =>
      connector.fetchData<{ data: ContainerInspectResponse }>({
        method: HttpMethod.POST,
        path: '/models/containers/inspect',
        data: {
          items: [{ space: 'cdf_cdm', externalId: containerExternalId }],
          inspectionOperations: {
            involvedViews: { allVersions: true },
            totalInvolvedViewCount: { allVersions: true, includeUnavailableViews: true },
          },
        },
        cacheTime: CacheTime.ResourceByIds,
      })
    );
    const item = response.data?.items?.[0];
    if (item?.inspectionResults?.involvedViews) {
      return item.inspectionResults.involvedViews;
    }
    return [];
  } catch (err) {
    console.warn(`Failed to fetch ${containerExternalId} views:`, err);
    return [];
  }
}

export function fetchCogniteAssetViews(connector: Connector): Promise<InvolvedView[]> {
  return fetchCogniteContainerViews(connector, 'CogniteAsset');
}

export function fetchCogniteEquipmentViews(connector: Connector): Promise<InvolvedView[]> {
  return fetchCogniteContainerViews(connector, 'CogniteEquipment');
}

// Fetch activities from DMS for a given time range, filtered to a specific time series
export async function fetchActivitiesFromDMS(
  connector: Connector,
  viewSpec: { space: string; externalId: string; version: string },
  timeRange: [number, number],
  useScheduledTime: boolean,
  timeSeriesInstanceId: { space: string; externalId: string }
): Promise<CogniteActivity[]> {
  try {
    const [rangeStart, rangeEnd] = timeRange;
    const startTimeProperty = useScheduledTime ? 'scheduledStartTime' : 'startTime';
    const endTimeProperty = useScheduledTime ? 'scheduledEndTime' : 'endTime';

    // Convert Unix timestamps (ms) to ISO 8601 strings as required by DMS
    const rangeStartISO = new Date(rangeStart).toISOString();
    const rangeEndISO = new Date(rangeEnd).toISOString();

    // Build filter for time range - activities that overlap the time range
    // We check: startTime <= rangeEnd AND endTime >= rangeStart
    // PLUS filter to only activities related to the selected time series
    const timeFilter: DMSFilter = {
      and: [
        // Activity starts before or during the range end
        {
          range: {
            property: [viewSpec.space, `${viewSpec.externalId}/${viewSpec.version}`, startTimeProperty],
            lte: rangeEndISO,
          },
        },
        // Activity ends after or during the range start
        {
          range: {
            property: [viewSpec.space, `${viewSpec.externalId}/${viewSpec.version}`, endTimeProperty],
            gte: rangeStartISO,
          },
        },
        // Activity is related to the selected time series
        {
          in: {
            property: [viewSpec.space, `${viewSpec.externalId}/${viewSpec.version}`, 'timeSeries'],
            values: [{
              space: timeSeriesInstanceId.space,
              externalId: timeSeriesInstanceId.externalId,
            }],
          },
        },
      ],
    };

    const listRequest: DMSListRequest = {
      sources: [
        {
          source: {
            type: 'view',
            space: viewSpec.space,
            externalId: viewSpec.externalId,
            version: viewSpec.version,
          },
        },
      ],
      instanceType: 'node',
      limit: 1000,
      filter: timeFilter,
    };

    const instances = await retryOnRateLimit(() =>
      connector.fetchItems<DMSInstance>({
        method: HttpMethod.POST,
        path: '/models/instances/list',
        data: listRequest,
      })
    );

    // Convert DMS instances to CogniteActivity objects
    return instances.map((instance) => {
      const props = instance.properties?.[viewSpec.space]?.[`${viewSpec.externalId}/${viewSpec.version}`] || {};
      return {
        space: instance.space,
        externalId: instance.externalId,
        version: instance.version,
        lastUpdatedTime: instance.lastUpdatedTime,
        createdTime: instance.createdTime,
        name: props.name,
        description: props.description,
        startTime: props.startTime,
        endTime: props.endTime,
        scheduledStartTime: props.scheduledStartTime,
        scheduledEndTime: props.scheduledEndTime,
        type: props.type,
        ...props, // Include any additional properties
      };
    });
  } catch (err) {
    console.warn('Failed to fetch activities from DMS:', err);
    return [];
  }
}

// Fetch activities from DMS filtered by a set of related instances (assets, equipment, or timeSeries)
export async function fetchActivitiesByAssets(
  connector: Connector,
  viewSpec: { space: string; externalId: string; version: string },
  assetInstances: Array<{ space: string; externalId: string }>,
  filterProperty = 'assets'
): Promise<CogniteActivity[]> {
  if (!assetInstances.length) {
    return [];
  }
  try {
    const filter: DMSFilter = {
      in: {
        property: [viewSpec.space, `${viewSpec.externalId}/${viewSpec.version}`, filterProperty],
        values: assetInstances.map((a) => ({ space: a.space, externalId: a.externalId })),
      },
    };

    const listRequest: DMSListRequest = {
      sources: [
        {
          source: {
            type: 'view',
            space: viewSpec.space,
            externalId: viewSpec.externalId,
            version: viewSpec.version,
          },
        },
      ],
      instanceType: 'node',
      limit: 1000,
      filter,
    };

    const instances = await retryOnRateLimit(() =>
      connector.fetchItems<DMSInstance>({
        method: HttpMethod.POST,
        path: '/models/instances/list',
        data: listRequest,
      })
    );

    return instances.map((instance) => {
      const props =
        instance.properties?.[viewSpec.space]?.[`${viewSpec.externalId}/${viewSpec.version}`] || {};
      return {
        space: instance.space,
        externalId: instance.externalId,
        version: instance.version,
        lastUpdatedTime: instance.lastUpdatedTime,
        createdTime: instance.createdTime,
        name: props.name,
        description: props.description,
        startTime: props.startTime,
        endTime: props.endTime,
        scheduledStartTime: props.scheduledStartTime,
        scheduledEndTime: props.scheduledEndTime,
        type: props.type,
        ...props,
      };
    });
  } catch (err) {
    console.warn('Failed to fetch activities by assets from DMS:', err);
    return [];
  }
}

