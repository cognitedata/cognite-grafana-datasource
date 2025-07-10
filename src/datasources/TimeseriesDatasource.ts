import { DataQueryRequest, DataQueryResponse } from '@grafana/data';
import _ from 'lodash';
import {
  CDFDataQueryRequest,
  CogniteQuery,
  DataQueryRequestItem,
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
import { getRange, getRequestId, toGranularityWithLowerBound } from '../utils';
import {
  concurrent,
  datapointsPath,
  fetchRelationships,
  formQueriesForTargets,
  getLabelsForTarget,
  getTimeseries,
  reduceTimeseries,
  targetToIdEither,

} from '../cdf/client';
import { emitEvent, handleError, showWarnings } from '../appEventHandler';
import { TimeSeriesResponseItem } from '../cdf/types';
import { responseWarningEvent, TIMESERIES_LIMIT_WARNING } from '../constants';
import { formQueriesForExpression } from '../parser/ts';

function handleFailedTargets(failed: FailResponse[]) {
  failed
    .filter(isError)
    .filter(({ error }) => !error.cancelled) // if response was cancelled, no need to show error message
    .forEach(({ error, metadata }) => handleError(error, metadata.target.refId));
}
function getDataQueryRequestType({ tab, latestValue }: QueryTarget) {
  switch (tab) {
    case Tab.Custom: {
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
      const defaultInterval = toGranularityWithLowerBound(intervalMs);
      items = await formQueriesForExpression(expr, target, connector, defaultInterval);
      break;
    }
    case Tab.FlexibleDataModelling: {
      items = _.map(flexibleDataModellingQuery.targets, (externalId) => ({ externalId }));
      break;
    }
    case Tab.CogniteTimeSeriesSearch: {
      // By this point, filterEmptyQueryTargets should have already filtered out empty queries
      items = [{
        instanceId: {
          space: cogniteTimeSeries.instanceId.space,
          externalId: cogniteTimeSeries.instanceId.externalId,
        },
      }];
      break;
    }
  }

  return { type, items, target };
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
      queryData.map(async ({ target, items, type }) => {
        let labels = [];
        try {
          labels = target.flexibleDataModellingQuery?.labels?.length
            ? target.flexibleDataModellingQuery.labels
            : await getLabelsForTarget(target, items, this.connector);
        } catch (err) {
          handleError(err, target.refId);
        }
        return { target, labels, type };
      })
    );
    const queryProxy = async ([data, metadata]: [CDFDataQueryRequest, ResponseMetadata]) => {
      const { target, type } = metadata;
      const chunkSize = type === 'synthetic' ? 10 : 100;
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
        >(request, chunkSize);
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
