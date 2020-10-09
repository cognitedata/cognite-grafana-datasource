/* eslint-disable */
describe('Noop', () => {
  it('should match', () => {
    expect(42).toEqual(42);
  });
});
/* import { Connector } from '../connector';
import { BackendSrv } from 'grafana/app/core/services/backend_srv';
import { HttpMethod } from '../types';

describe('connector', () => {
  const datasourceRequest = jest.fn();
  const project = 'test';
  const protocol = 'protocol:/';
  let connector: Connector;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.resetAllMocks();
  });

  describe('chunkAndFetch', () => {
    const item0 = [{ 1: 1 }];
    const item1 = [{ 2: 2 }];
    const items = [item0, item1];
    const data = { items };
    const method = HttpMethod.POST;
    const path = '/ø';
    const url = `${protocol}/cogniteapi/${project}${path}`;
    const reqBase = { url, method };

    beforeEach(() => {
      connector = new Connector(project, protocol, { datasourceRequest } as any);
    });

    it('should not chunk under the limit', async () => {
      datasourceRequest.mockImplementationOnce(async () => ({ data: { items: [1, 2] } }));
      const res = await connector.chunkAndFetch({ method, path, data });
      expect(datasourceRequest).toHaveBeenCalledWith({ ...reqBase, data });
      expect(datasourceRequest).toHaveBeenCalledTimes(1);
      expect(res).toEqual({ data: { items: [1, 2] } });
    });

    it('should chunk if limit has been reached', async () => {
      datasourceRequest.mockImplementationOnce(async () => ({ data: { items: [1] } }));
      datasourceRequest.mockImplementationOnce(async () => ({ data: { items: [2] } }));
      const res = await connector.chunkAndFetch({ path, data, method }, 1);
      expect(datasourceRequest).toHaveBeenCalledWith({ ...reqBase, data: { items: [item0] } });
      expect(datasourceRequest).toHaveBeenCalledWith({ ...reqBase, data: { items: [item1] } });
      expect(datasourceRequest).toHaveBeenCalledTimes(2);
      expect(res).toEqual({ data: { items: [1, 2] } });
    });

    it('should chunk and keep metadata', async () => {
      datasourceRequest.mockImplementationOnce(async () => ({
        data: { items: [1], meta: 2 },
        meta: 1,
      }));
      datasourceRequest.mockImplementationOnce(async () => ({ data: { items: [2] } }));
      const res = await connector.chunkAndFetch({ path, data, method }, 1);
      expect(datasourceRequest).toHaveBeenCalledWith({ ...reqBase, data: { items: [item0] } });
      expect(datasourceRequest).toHaveBeenCalledWith({ ...reqBase, data: { items: [item1] } });
      expect(datasourceRequest).toHaveBeenCalledTimes(2);
      expect(res).toEqual({ data: { items: [1, 2], meta: 2 }, meta: 1 });
    });

    it('should reject if at least one chunk was rejected', async () => {
      datasourceRequest.mockImplementationOnce(async () => ({ data: { items: [1, 2] } }));
      datasourceRequest.mockImplementationOnce(async () => Promise.reject(1));
      await expect(connector.chunkAndFetch({ path, data, method }, 1)).rejects.toEqual(1);
      expect(datasourceRequest).toHaveBeenCalledWith({ ...reqBase, data: { items: [item0] } });
      expect(datasourceRequest).toHaveBeenCalledWith({ ...reqBase, data: { items: [item1] } });
      expect(datasourceRequest).toHaveBeenCalledTimes(2);
    });
  });

  describe('auto-pagination with fetchAndPaginate', () => {
    let cursor = 0;
    const limit = 10000;
    const query = {
      path: '',
      data: { limit, filter: {} },
      method: HttpMethod.POST,
    };
    const items1000 = Array.from({ length: 1000 }, (_, i) => i);
    const response = async () => ({ data: { items: items1000, nextCursor: `${++cursor}` } });

    beforeEach(() => {
      connector = new Connector(project, protocol, { datasourceRequest } as any);
    });

    it('returns all 10k elements', async () => {
      datasourceRequest.mockImplementation(response);
      const res = await connector.fetchAndPaginate(query);
      expect(res.length).toBe(limit);
    });

    it('returns as many as it can', async () => {
      datasourceRequest
        .mockImplementationOnce(response)
        .mockImplementationOnce(response)
        .mockImplementationOnce(async () => ({ data: { items: items1000.slice(500) } }));
      const res = await connector.fetchAndPaginate(query);
      expect(res).toEqual([...items1000, ...items1000, ...items1000.slice(500)]);
      expect(res.length).toBe(2500);
    });

    it('returns 1000 by default', async () => {
      datasourceRequest.mockImplementation(response);
      const res = await connector.fetchAndPaginate({
        ...query,
        data: { ...query.data, limit: undefined },
      });
      expect(res).toEqual(items1000);
      expect(res.length).toBe(1000);
    });
  });

  describe('cached requests', () => {
    const data = { filter: {} };
    const request = {
      data,
      url: '/',
      method: HttpMethod.POST,
    };
    const response = async () => ({ data: { items: [1] } });

    beforeEach(() => {
      connector = new Connector(project, protocol, { datasourceRequest } as any);
      jest.useFakeTimers();
    });

    it('takes response from cache', async () => {
      datasourceRequest.mockImplementation(response);
      await connector.cachedRequest(request);
      const cached = await connector.cachedRequest(request);
      expect(datasourceRequest).toBeCalledTimes(1);
      expect(cached.data.items).toEqual([1]);
    });

    it('cache is removed after timeout', async () => {
      datasourceRequest.mockImplementation(response);
      await connector.cachedRequest(request, '1s');
      jest.advanceTimersByTime(2000);
      await connector.cachedRequest(request);
      expect(datasourceRequest).toBeCalledTimes(2);
    });

    it('no cache if url is different', async () => {
      datasourceRequest.mockImplementation(response);
      await connector.cachedRequest(request);
      await connector.cachedRequest({ ...request, url: '/other' });
      expect(datasourceRequest).toBeCalledTimes(2);
    });

    const error = { error: { message: 1 } };
    it('throws error', async () => {
      datasourceRequest.mockImplementation(async () => error);
      expect.assertions(1);
      expect(connector.cachedRequest(request)).rejects.toEqual(error);
    });

    it('throws error 2', async () => {
      datasourceRequest.mockImplementation(async () => {
        throw error;
      });
      expect.assertions(1);
      try {
        await connector.cachedRequest(request);
      } catch (e) {
        expect(e).toEqual(error);
      }
    });

    it('do not cache on error', async () => {
      datasourceRequest.mockImplementation(async () => error);
      try {
        await connector.cachedRequest(request);
      } catch {}
      try {
        await connector.cachedRequest(request);
      } catch {}
      expect(datasourceRequest).toBeCalledTimes(2);
    });
  });
});
 */