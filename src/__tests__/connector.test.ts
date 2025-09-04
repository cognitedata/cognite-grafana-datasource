import { Connector } from '../connector';
import { HttpMethod } from '../types';
import { API_V1 } from '../constants';

describe('connector', () => {
  const project = 'test';
  const protocol = 'protocol:/';
  let connector: Connector;
  const fetcher = { fetch: jest.fn() };

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
    const url = `${protocol}/cdf-oauth/${API_V1}/${project}${path}`;
    const reqBase = { url, method };

    beforeEach(() => {
      connector = new Connector(project, protocol, fetcher, false, false, true, true, true, true, true, true, true, true, true, true, true, true);
    });

    it('should not chunk under the limit', async () => {
      fetcher.fetch.mockImplementationOnce(async () => ({ data: { items: [1, 2] } }));
      const res = await connector.chunkAndFetch({ method, path, data });
      expect(fetcher.fetch).toHaveBeenCalledWith({ ...reqBase, data });
      expect(fetcher.fetch).toHaveBeenCalledTimes(1);
      expect(res).toEqual({ data: { items: [1, 2] } });
    });

    it('should chunk if limit has been reached', async () => {
      fetcher.fetch.mockImplementationOnce(async () => ({ data: { items: [1] } }));
      fetcher.fetch.mockImplementationOnce(async () => ({ data: { items: [2] } }));
      const res = await connector.chunkAndFetch({ path, data, method }, 1);
      expect(fetcher.fetch).toHaveBeenCalledWith({ ...reqBase, data: { items: [item0] } });
      expect(fetcher.fetch).toHaveBeenCalledWith({ ...reqBase, data: { items: [item1] } });
      expect(fetcher.fetch).toHaveBeenCalledTimes(2);
      expect(res).toEqual({ data: { items: [1, 2] } });
    });

    it('should chunk and keep metadata', async () => {
      fetcher.fetch.mockImplementationOnce(async () => ({
        data: { items: [1], meta: 2 },
        meta: 1,
      }));
      fetcher.fetch.mockImplementationOnce(async () => ({ data: { items: [2] } }));
      const res = await connector.chunkAndFetch({ path, data, method }, 1);
      expect(fetcher.fetch).toHaveBeenCalledWith({ ...reqBase, data: { items: [item0] } });
      expect(fetcher.fetch).toHaveBeenCalledWith({ ...reqBase, data: { items: [item1] } });
      expect(fetcher.fetch).toHaveBeenCalledTimes(2);
      expect(res).toEqual({ data: { items: [1, 2], meta: 2 }, meta: 1 });
    });

    it('should reject if at least one chunk was rejected', async () => {
      fetcher.fetch.mockImplementationOnce(async () => ({ data: { items: [1, 2] } }));
      fetcher.fetch.mockImplementationOnce(async () => Promise.reject(1));
      await expect(connector.chunkAndFetch({ path, data, method }, 1)).rejects.toEqual(1);
      expect(fetcher.fetch).toHaveBeenCalledWith({ ...reqBase, data: { items: [item0] } });
      expect(fetcher.fetch).toHaveBeenCalledWith({ ...reqBase, data: { items: [item1] } });
      expect(fetcher.fetch).toHaveBeenCalledTimes(2);
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
    const response = async () => {
      cursor += 1;
      return { data: { items: items1000, nextCursor: `${cursor}` } };
    };

    beforeEach(() => {
      connector = new Connector(project, protocol, fetcher, false, false, true, true, true, true, true, true, true, true, true, true, true, true);
    });

    it('returns all 10k elements', async () => {
      fetcher.fetch.mockImplementation(response);
      const res = await connector.fetchAndPaginate(query);
      expect(res.length).toBe(limit);
    });

    it('returns as many as it can', async () => {
      fetcher.fetch
        .mockImplementationOnce(response)
        .mockImplementationOnce(response)
        .mockImplementationOnce(async () => ({ data: { items: items1000.slice(500) } }));
      const res = await connector.fetchAndPaginate(query);
      expect(res).toEqual([...items1000, ...items1000, ...items1000.slice(500)]);
      expect(res.length).toBe(2500);
    });

    it('returns 1000 by default', async () => {
      fetcher.fetch.mockImplementation(response);
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
      connector = new Connector(project, protocol, fetcher, false, false, true, true, true, true, true, true, true, true, true, true, true, true);
      jest.useFakeTimers();
    });

    it('takes response from cache', async () => {
      fetcher.fetch.mockImplementation(response);
      await connector.cachedRequest(request);
      const cached = await connector.cachedRequest(request);
      expect(fetcher.fetch).toBeCalledTimes(1);
      expect(cached.data.items).toEqual([1]);
    });

    it('cache is removed after timeout', async () => {
      fetcher.fetch.mockImplementation(response);
      await connector.cachedRequest(request, '1s');
      jest.advanceTimersByTime(2000);
      await connector.cachedRequest(request);
      expect(fetcher.fetch).toBeCalledTimes(2);
    });

    it('no cache if url is different', async () => {
      fetcher.fetch.mockImplementation(response);
      await connector.cachedRequest(request);
      await connector.cachedRequest({ ...request, url: '/other' });
      expect(fetcher.fetch).toBeCalledTimes(2);
    });

    const error = { error: { message: 1 } };
    it('throws error', async () => {
      fetcher.fetch.mockImplementation(async () => error);
      expect.assertions(1);
      expect(connector.cachedRequest(request)).rejects.toEqual(error);
    });

    it('throws error 2', async () => {
      fetcher.fetch.mockImplementation(async () => {
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
      fetcher.fetch.mockImplementation(async () => error);
      try {
        await connector.cachedRequest(request);
      } catch (e) {
        // silent
      }
      try {
        await connector.cachedRequest(request);
      } catch (e) {
        // silent
      }
      expect(fetcher.fetch).toBeCalledTimes(2);
    });
  });

  describe('regular request with oauth2 token', () => {
    const request = { path: '' };

    beforeEach(() => {
      connector = new Connector(project, protocol, fetcher, true, false, true, true, true, true, true, true, true, true, true, true, true, true);
    });

    it('uses cdf-oauth route when oauthPassThru=true', async () => {
      fetcher.fetch.mockImplementation(async () => ({ data: {} }));
      await connector.request(request);
      expect(fetcher.fetch).toHaveBeenCalledWith({
        method: HttpMethod.GET,
        url: 'protocol://cdf-oauth/',
      });
    });
  });

  describe('request with oauth2 client credentials grant flow', () => {
    const request = { path: '' };

    beforeEach(() => {
      connector = new Connector(project, protocol, fetcher, false, true, true, true, true, true, true, true, true, true, true, true, true, true);
    });

    it('uses cdf-cc-oauth route when oauthClientCreds=true', async () => {
      fetcher.fetch.mockImplementation(async () => ({ data: {} }));
      await connector.request(request);
      expect(fetcher.fetch).toHaveBeenCalledWith({
        method: HttpMethod.GET,
        url: 'protocol://cdf-cc-oauth/',
      });
    });
  });
});
