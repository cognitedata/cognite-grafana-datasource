// for tests just send the request to the mocked backendsrv
export const getQuery = async (query, backendSrv) => backendSrv.datasourceRequest(query);

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
