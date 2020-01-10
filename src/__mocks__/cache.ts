import { TimeSeriesResponseItem } from '../types';
import { timeseriesHash } from '../utils';

// for tests just send the request to the mocked backendsrv
export const getQuery = async (query, backendSrv) => backendSrv.datasourceRequest(query);

const assetTimeseries = new Map<string, TimeSeriesResponseItem[]>();
export const getTimeseries = (options, target) => {
  return assetTimeseries.get(timeseriesHash(options, target));
};
export const setTimeseries = (options, target, timeseries) => {
  assetTimeseries.set(timeseriesHash(options, target), timeseries);
};

const cache = {
  getQuery,
  getTimeseries,
  setTimeseries,
};

export default cache;
