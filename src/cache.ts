import {
  DataSourceRequestOptions,
  isError,
  TimeSeriesResponseItem,
  QueryTarget,
  QueryOptions,
} from './types';
import { BackendSrv } from 'grafana/app/core/services/backend_srv';
import { timeseriesHash } from './utils';

// Cache requests for 10 seconds
const cacheTime = 1000 * 10;

const queries = {
  results: new Map(),
  requests: new Map(),
};

export const getQuery = async (query: DataSourceRequestOptions, backendSrv: BackendSrv) => {
  const stringQuery = JSON.stringify({ ...query, requestId: undefined });

  if (queries.requests.has(stringQuery)) {
    return queries.requests.get(stringQuery);
  }
  if (queries.results.has(stringQuery)) {
    return queries.results.get(stringQuery);
  }
  const promise = backendSrv.datasourceRequest(query).then(
    res => {
      if (!res) {
        // the item may not exist, or it may have been deleted
        return {};
      }
      const asset = res;
      if (!isError(asset)) {
        queries.results.set(stringQuery, asset);
        // set a timeout to clear the cache
        setTimeout(() => {
          queries.results.delete(stringQuery);
          queries.requests.delete(stringQuery);
        }, cacheTime);
      }
      queries.requests.delete(stringQuery);
      return asset;
    },
    error => {
      // clear the cache so that the request can be retried
      queries.requests.delete(stringQuery);
      // pass the error up to the caller
      throw error;
    }
  );
  queries.requests.set(stringQuery, promise);
  return promise;
};

const assetTimeseries = new Map<string, TimeSeriesResponseItem[]>();

export const getTimeseries = (options: QueryOptions, target: QueryTarget) => {
  return assetTimeseries.get(timeseriesHash(options, target));
};

export const setTimeseries = (
  options: QueryOptions,
  target: QueryTarget,
  timeseries: TimeSeriesResponseItem[]
) => {
  assetTimeseries.set(timeseriesHash(options, target), timeseries);
};

const cache = {
  getQuery,
  getTimeseries,
  setTimeseries,
};

export default cache;
