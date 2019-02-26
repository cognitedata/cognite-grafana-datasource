import { isError } from './datasource';

// Cache requests for 10 seconds
const cacheTime = 1000 * 10;

const queries = {
  results: new Map(),
  requests: new Map(),
};

export const getQuery = async (query, backendSrv) => {
  const stringQuery = JSON.stringify(query);

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

// store timeseries here instead of in the queryTarget object
const timeseries = new Map();

export const getTimeseries = (queryTarget, options) => {
  const id = `${options.dashboardId}-${options.panelId}-${queryTarget.refId}`;
  return timeseries.get(id);
};

export const setTimeseries = (queryTarget, options, timeseriesArr) => {
  const id = `${options.dashboardId}-${options.panelId}-${queryTarget.refId}`;
  return timeseries.set(id, timeseriesArr);
};

const cache = {
  getQuery,
  getTimeseries,
  setTimeseries,
};

export default cache;
