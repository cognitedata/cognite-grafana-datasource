import { TimeSeriesResponseItem, QueryOptions, QueryTarget } from '../types';

// for tests just send the request to the mocked backendsrv
export const getQuery = async (query, backendSrv) => backendSrv.datasourceRequest(query);

const assetTimeseries = new Map<string, TimeSeriesResponseItem[]>();
export const getTimeseries = (options: QueryOptions, target: QueryTarget) => {
  const id: string = `${options.dashboardId}_${options.panelId}_${target.refId}_${
    target.assetQuery.templatedTarget
  }_${target.assetQuery.includeSubtrees}`;
  return assetTimeseries.get(id);
};
export const setTimeseries = (
  options: QueryOptions,
  target: QueryTarget,
  timeseries: TimeSeriesResponseItem[]
) => {
  const id: string = `${options.dashboardId}_${options.panelId}_${target.refId}_${
    target.assetQuery.templatedTarget
  }_${target.assetQuery.includeSubtrees}`;
  assetTimeseries.set(id, timeseries);
};

const cache = {
  getQuery,
  getTimeseries,
  setTimeseries,
};

export default cache;
