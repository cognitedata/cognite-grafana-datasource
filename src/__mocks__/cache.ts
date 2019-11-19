// import { TimeSeriesResponseItem } from '../types';
// import Utils from '../utils';

// // for tests just send the request to the mocked backendsrv
// export const getQuery = async (query, backendSrv) => backendSrv.datasourceRequest(query);

// const assetTimeseries = new Map<string, TimeSeriesResponseItem[]>();
// export const getTimeseries = (options, target) => {
//   return assetTimeseries.get(Utils.timeseriesHash(options, target));
// };
// export const setTimeseries = (options, target, timeseries) => {
//   assetTimeseries.set(Utils.timeseriesHash(options, target), timeseries);
// };

// const cache = {
//   getQuery,
//   getTimeseries,
//   setTimeseries,
// };

// export default cache;
