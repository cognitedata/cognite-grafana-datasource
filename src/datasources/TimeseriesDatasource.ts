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
} from '../cdf/client';
import { StateSetEntry } from '../cdf/typedFrames';
import {
  datapointsModeOf,
  isAggregateAllowed,
  isTimeSeriesKind,
  TimeSeriesKind,
  unavailableAggregateMessage,
} from '../cdf/aggregates';
import { emitEvent, handleError, showWarnings } from '../appEventHandler';
import { TimeSeriesResponseItem } from '../cdf/types';
import { responseWarningEvent, TIMESERIES_LIMIT_WARNING } from '../constants';
import { formQueriesForExpression } from '../parser/ts';
import { formQueriesForCdmExpression } from '../parser/dms';
import { normalizeCdmSyntheticQuery } from '../cdf/cdmExpression';

function handleFailedTargets(failed: FailResponse[]) {
  failed
    .filter(isError)
    .filter(({ error }) => !error.cancelled) // if response was cancelled, no need to show error message
    .forEach(({ error, metadata }) => handleError(error, metadata.target.refId));
}
function getDataQueryRequestType({ tab, latestValue }: QueryTarget) {
  switch (tab) {
    case Tab.Custom:
    case Tab.CogniteTimeSeriesExpression: {
      return 'synthetic';
    }
    default: {
      return latestValue ? 'latest' : 'data';
    }
  }
}
async function findTsByAssetAndRelationships(
  { refId, assetQuery }: QueryTarget,
  connector: Connector,
  timeFrame
): Promise<TimeSeriesResponseItem[]> {
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
  if (timeseriesFromAssets.length >= limit) {
    emitEvent(responseWarningEvent, { refId, warning: TIMESERIES_LIMIT_WARNING });
    timeseriesFromAssets.splice(-1);
  }
  if (timeseriesFromRelationships.length >= limit) {
    emitEvent(responseWarningEvent, { refId, warning: TIMESERIES_LIMIT_WARNING });
    timeseriesFromRelationships.splice(-1);
  }
  return _.uniqBy([...timeseriesFromAssets, ...timeseriesFromRelationships], 'id');
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
      const timeseries = await findTsByAssetAndRelationships(target, connector, timeFrame);
      items = timeseries.map(({ id }) => ({ id }));
      break;
    }
    case Tab.Custom: {
      // An auto step (`auto:fewer`, say) is resolved here, so the expression
      // carries the granularity the API understands.
      const granularity = resolveDatapointsGranularity(target.granularity, intervalMs);
      items = await formQueriesForExpression(expr, { ...target, granularity }, connector, granularity);
      break;
    }
    case Tab.CogniteTimeSeriesExpression: {
      // Raw (aggregation 'none', as DatapointsFields encodes it) sends no aggregate or granularity.
      const datapoints = datapointsModeOf(target) === 'raw' ? 'raw' : 'aggregate';
      const granularity = resolveDatapointsGranularity(target.granularity, intervalMs);
      ({ items, scopes, warnings } = await formQueriesForCdmExpression(
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
          stateSet = stateSetRef ? await getStateSet(connector, stateSetRef) : undefined;
        } else {
          ({ kind, stateSet } = await resolveTimeSeriesKind(connector, instanceIdItems[0].instanceId, target, type));
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
      ({ kind, stateSet } = await resolveTimeSeriesKind(connector, instanceId, target, type));
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
): Promise<{ kind: TimeSeriesKind; stateSet?: StateSetEntry[] }> {
  // A failed lookup fails the query: guessing numeric would send a request CDF
  // refuses for string and state series, with a less useful error.
  const properties = await getTimeSeriesProperties(connector, instanceId, { rethrow: true });
  const kind = isTimeSeriesKind(properties.type) ? properties.type : 'numeric';
  if (type === 'data' && !isAggregateAllowed(kind, aggregation)) {
    throw new Error(unavailableAggregateMessage(kind, aggregation));
  }
  const stateSet =
    kind === 'state' && properties.stateSet ? await getStateSet(connector, properties.stateSet) : undefined;
  return { kind, stateSet };
}
export class TimeseriesDatasource {
  constructor(private connector: Connector) {}
  async fetchTimeseriesForTargets(
    queryTargets: QueryTarget[],
    options: QueryOptions
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
        handleError(e, target.refId);
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
            handleError(err, target.refId);
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
        target.tab === Tab.CogniteTimeSeriesExpression
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
  async query(options: DataQueryRequest<CogniteQuery>): Promise<DataQueryResponse> {
    const timeRange = getRange(options.range);
    const { failed, succeded } = await this.fetchTimeseriesForTargets(options.targets, options);

    handleFailedTargets(failed);
    showWarnings(succeded);
    return {
      data: reduceTimeseries(succeded, timeRange),
    };
  }
}
