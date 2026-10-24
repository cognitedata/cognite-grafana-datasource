import { DataQueryRequest, DataQueryResponse } from '@grafana/data';
import _ from 'lodash';
import {
  CDFDataQueryRequest,
  CogniteQuery,
  DataQueryRequestItem,
  DataQueryRequestType,
  DataQueryRequestResponse,
  Err,
  FailResponse,
  HttpMethod,
  isError,
  Ok,
  QueriesDataItem,
  QueryOptions,
  QueryTarget,
  ResponseMetadata,
  Responses,
  SuccessResponse,
  Tab,
} from '../types';
import { Connector } from '../connector';
import { getRange, getRequestId } from '../utils';
import { resolveDatapointsGranularity } from '../cdf/granularity';
import {
  concurrent,
  datapointsPath,
  fetchRelationships,
  formQueriesForTargets,
  getLabelsForTarget,
  getTimeseries,
  reduceTimeseries,
  targetToIdEither,
  resolveTargetFill,
  getTimeSeriesProperties,
  getStateSet,
  chunkSyntheticItems,
  getCalculationWarnings,
  getLimitsWarnings,
} from '../cdf/client';
import { StateSetEntry } from '../cdf/typedFrames';
import {
  datapointsModeOf,
  isAggregateAllowed,
  isTimeSeriesKind,
  TimeSeriesKind,
  unavailableAggregateMessage,
} from '../cdf/aggregates';
import { errorMessageOf, QueryMessages } from '../queryMessages';
import { TimeSeriesResponseItem } from '../cdf/types';
import { TIMESERIES_LIMIT_WARNING } from '../constants';
import { formQueriesForExpression } from '../parser/ts';
import { formQueriesForSyntheticQuery } from '../parser/dms';
import { normalizeCdmSyntheticQuery } from '../cdf/syntheticTimeSeries';

function handleFailedTargets(failed: FailResponse[], messages: QueryMessages) {
  failed
    .filter(isError)
    .forEach(({ error, metadata }) => messages.error(error, metadata.target.refId));
}

/** What each response's caller should know: warnings raised while building it, and CDF's limits. */
function noteResponseWarnings(responses: SuccessResponse[], messages: QueryMessages) {
  responses.forEach(({ result, metadata }) => {
    const { items } = result.data;
    const { limit } = result.config.data;
    const { refId } = metadata.target;
    [...(metadata.warnings ?? []), getLimitsWarnings(items, limit), getCalculationWarnings(items)].forEach(
      (warning) => messages.warning(warning, refId)
    );
  });
}
function getDataQueryRequestType({ tab, latestValue }: QueryTarget) {
  switch (tab) {
    case Tab.Custom:
    case Tab.SyntheticTimeSeries: {
      return 'synthetic';
    }
    default: {
      return latestValue ? 'latest' : 'data';
    }
  }
}
async function findTsByAssetAndRelationships(
  { assetQuery }: QueryTarget,
  connector: Connector,
  timeFrame
): Promise<{ timeseries: TimeSeriesResponseItem[]; warnings: string[] }> {
  const assetId = assetQuery.target;
  const filter = assetQuery.includeSubtrees
    ? {
        assetSubtreeIds: [{ id: Number(assetId) }],
      }
    : {
        assetIds: [assetId],
      };
  // since /dataquery can only have 100 items and checkboxes become difficult to use past 100 items,
  //  we only get the first 100 timeseries, and show a warning if there are too many timeseries
  const limit = 101;

  let timeseriesFromRelationships = [];
  const timeseriesFromAssets =
    assetQuery?.includeSubTimeseries !== false
      ? await getTimeseries({ filter, limit }, connector)
      : [];

  if (assetQuery?.withRelationships) {
    const relationshipsList = await fetchRelationships(
      assetQuery?.relationshipsQuery,
      connector,
      timeFrame
    );
    timeseriesFromRelationships = _.map(relationshipsList, 'target');
  }
  const warnings: string[] = [];
  if (timeseriesFromAssets.length >= limit) {
    warnings.push(TIMESERIES_LIMIT_WARNING);
    timeseriesFromAssets.splice(-1);
  }
  if (timeseriesFromRelationships.length >= limit) {
    warnings.push(TIMESERIES_LIMIT_WARNING);
    timeseriesFromRelationships.splice(-1);
  }
  return {
    timeseries: _.uniqBy([...timeseriesFromAssets, ...timeseriesFromRelationships], 'id'),
    warnings,
  };
}

export async function getDataQueryRequestItems(
  target: QueryTarget,
  connector: Connector,
  intervalMs: number,
  timeFrame
): Promise<QueriesDataItem> {
  const { tab, expr, flexibleDataModellingQuery, cogniteTimeSeries } = target;
  const type = getDataQueryRequestType(target);
  let items: DataQueryRequestItem[];
  let kind: TimeSeriesKind | undefined;
  let stateSet: StateSetEntry[] | undefined;
  let scopes: QueriesDataItem['scopes'];
  let warnings: string[] | undefined;

  switch (tab) {
    default:
    case undefined:
    case Tab.Timeseries: {
      items = [targetToIdEither(target)];
      break;
    }
    case Tab.Asset: {
      const found = await findTsByAssetAndRelationships(target, connector, timeFrame);
      items = found.timeseries.map(({ id }) => ({ id }));
      warnings = found.warnings.length ? found.warnings : undefined;
      break;
    }
    case Tab.Custom: {
      // An auto step (`auto:fewer`, say) is resolved here, so the expression
      // carries the granularity the API understands.
      const granularity = resolveDatapointsGranularity(target.granularity, intervalMs);
      items = await formQueriesForExpression(expr, { ...target, granularity }, connector, granularity);
      break;
    }
    case Tab.SyntheticTimeSeries: {
      // Raw (aggregation 'none', as DatapointsFields encodes it) sends no aggregate or granularity.
      const datapoints = datapointsModeOf(target) === 'raw' ? 'raw' : 'aggregate';
      const granularity = resolveDatapointsGranularity(target.granularity, intervalMs);
      ({ items, scopes, warnings } = await formQueriesForSyntheticQuery(
        normalizeCdmSyntheticQuery(target.cdmSyntheticQuery),
        { datapoints, granularity },
        connector
      ));
      break;
    }
    case Tab.FlexibleDataModelling: {
      // Handle both legacy externalId-based targets and new instanceId-based targets
      const externalIdItems = _.map(flexibleDataModellingQuery.targets, (externalId) => ({ externalId }));
      const instanceIdItems = _.map(flexibleDataModellingQuery.instanceIds, (instanceId) => ({ instanceId }));
      items = [...externalIdItems, ...instanceIdItems];
      // The tab sends one series per request, with its type and, for a state
      // series, its state set when the tab looked them up. Otherwise they are
      // looked up here.
      if (instanceIdItems.length === 1 && !externalIdItems.length) {
        const hint = flexibleDataModellingQuery.instanceKinds?.[0];
        const stateSetRef = flexibleDataModellingQuery.instanceStateSets?.[0];
        // A state series' state set is known when the tab passes it, or null for none.
        if (hint && (hint !== 'state' || stateSetRef !== undefined)) {
          if (type === 'data' && !isAggregateAllowed(hint, target.aggregation)) {
            throw new Error(unavailableAggregateMessage(hint, target.aggregation));
          }
          kind = hint;
          if (stateSetRef) {
            const loaded = await loadStateSet(connector, stateSetRef);
            stateSet = loaded.stateSet;
            warnings = loaded.warning ? [loaded.warning] : warnings;
          }
        } else {
          const resolved = await resolveTimeSeriesKind(connector, instanceIdItems[0].instanceId, target, type);
          ({ kind, stateSet } = resolved);
          warnings = resolved.warning ? [resolved.warning] : warnings;
        }
      }
      break;
    }
    case Tab.CogniteTimeSeriesSearch: {
      // By this point, filterEmptyQueryTargets should have already filtered out empty queries
      const instanceId = {
        space: cogniteTimeSeries.instanceId.space,
        externalId: cogniteTimeSeries.instanceId.externalId,
      };
      items = [{ instanceId }];
      const resolved = await resolveTimeSeriesKind(connector, instanceId, target, type);
      ({ kind, stateSet } = resolved);
      warnings = resolved.warning ? [resolved.warning] : warnings;
      break;
    }
  }

  return { type, items, target, kind, stateSet, scopes, ...(warnings?.length ? { warnings } : {}) };
}

/**
 * The type of the CogniteTimeSeries a query reads, looked up when the query runs:
 * saved and provisioned queries, and instance ids from variables, carry no type.
 * Throws when the query's aggregation is one CDF refuses for that type.
 */
async function resolveTimeSeriesKind(
  connector: Connector,
  instanceId: { space: string; externalId: string },
  { aggregation }: QueryTarget,
  type: DataQueryRequestType
): Promise<{ kind: TimeSeriesKind; stateSet?: StateSetEntry[]; warning?: string }> {
  // A failed lookup fails the query: guessing numeric would send a request CDF
  // refuses for string and state series, with a less useful error.
  const properties = await getTimeSeriesProperties(connector, instanceId);
  const kind = isTimeSeriesKind(properties.type) ? properties.type : 'numeric';
  if (type === 'data' && !isAggregateAllowed(kind, aggregation)) {
    throw new Error(unavailableAggregateMessage(kind, aggregation));
  }
  if (kind !== 'state' || !properties.stateSet) {
    return { kind };
  }
  return { kind, ...(await loadStateSet(connector, properties.stateSet)) };
}

/** A state set, or the warning that it could not be read: the series still plots without it. */
async function loadStateSet(
  connector: Connector,
  ref: { space: string; externalId: string }
): Promise<{ stateSet?: StateSetEntry[]; warning?: string }> {
  try {
    return { stateSet: await getStateSet(connector, ref) };
  } catch (error) {
    return { warning: `Couldn't read the state set: ${errorMessageOf(error)}` };
  }
}
export class TimeseriesDatasource {
  constructor(private connector: Connector) {}
  async fetchTimeseriesForTargets(
    queryTargets: QueryTarget[],
    options: QueryOptions,
    messages: QueryMessages
  ): Promise<Responses<SuccessResponse, FailResponse>> {
    const itemsForTargetsPromises = queryTargets.map(async (target) => {
      try {
        const [min, max] = getRange(options.range);
        const timeFrame = target?.assetQuery?.relationshipsQuery?.isActiveAtTime && {
          activeAtTime: { max, min },
        };
        return await getDataQueryRequestItems(
          target,
          this.connector,
          options.intervalMs,
          timeFrame
        );
      } catch (e) {
        messages.error(e, target.refId);
      }
      return null;
    });
    const queryData = (await Promise.all(itemsForTargetsPromises)).filter(
      (data) => data?.items?.length
    );
    const queries = formQueriesForTargets(queryData, options);
    const metadata = await Promise.all(
      queryData.map(
        async ({ target, items, type, kind, stateSet, scopes, warnings: itemWarnings }): Promise<ResponseMetadata> => {
          let labels = [];
          try {
            labels = target.flexibleDataModellingQuery?.labels?.length
              ? target.flexibleDataModellingQuery.labels
              : await getLabelsForTarget(target, items, this.connector, scopes);
          } catch (err) {
            // The data still comes back, under default labels.
            messages.warning(`Couldn't build the labels: ${errorMessageOf(err)}`, target.refId);
          }
          const { warning } = resolveTargetFill(target, type, options.intervalMs);
          const warnings = [...(itemWarnings ?? []), ...(warning ? [warning] : [])];
          return { target, labels, type, kind, stateSet, ...(warnings.length ? { warnings } : {}) };
        }
      )
    );
    const queryProxy = async ([data, metadata]: [CDFDataQueryRequest, ResponseMetadata]) => {
      const { target, type } = metadata;
      // The deprecated Custom query tab keeps its plain chunks.
      const split =
        target.tab === Tab.SyntheticTimeSeries
          ? chunkSyntheticItems
          : type === 'synthetic'
            ? 10
            : 100;
      const request = {
        data,
        path: datapointsPath(type),
        method: HttpMethod.POST,
        requestId: getRequestId(options, target),
      };

      try {
        const result = await this.connector.chunkAndFetch<
          CDFDataQueryRequest,
          DataQueryRequestResponse
        >(request, split);
        return new Ok({ result, metadata });
      } catch (error) {
        return new Err({ error, metadata });
      }
    };

    const requests = queries.map((query, i) => [query, metadata[i]]); // I.e queries.zip(metadata)
    return concurrent(requests, queryProxy);
  }
  /** Errors and warnings go to `messages`; the caller puts them in the response. */
  async query(
    options: DataQueryRequest<CogniteQuery>,
    messages: QueryMessages
  ): Promise<DataQueryResponse> {
    const timeRange = getRange(options.range);
    const { failed, succeded } = await this.fetchTimeseriesForTargets(options.targets, options, messages);

    handleFailedTargets(failed, messages);
    noteResponseWarnings(succeded, messages);
    return {
      data: reduceTimeseries(succeded, timeRange),
    };
  }
}
