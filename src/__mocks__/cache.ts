// for tests just send the request to the mocked backendsrv
export const getQuery = async (query, backendSrv) => backendSrv.datasourceRequest(query);
const cache = {
  getQuery,
};

export default cache;
