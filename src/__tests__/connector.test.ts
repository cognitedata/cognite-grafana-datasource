import { Connector } from '../connector';
import { BackendSrv } from 'grafana/app/core/services/backend_srv';
import { HttpMethod } from '../types';

jest.mock('../cache');

describe('connector', () => {
  let connector: Connector;
  const datasourceRequest = jest.fn();
  const project = 'test';
  const protocol = 'protocol:/';

  beforeAll(() => {
    const backendSrv: BackendSrv = { datasourceRequest } as any;
    connector = new Connector(project, protocol, backendSrv);
  });

  beforeEach(() => {
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
});
