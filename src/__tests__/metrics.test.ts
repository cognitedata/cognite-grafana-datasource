import { cloneDeep } from 'lodash';
import { getMockedDataSource } from '../test_utils';
import { VariableQueryData } from '../types';

jest.mock('@grafana/runtime');
type Mock = jest.Mock;
const fetcher = { fetch: jest.fn() };
const ds = getMockedDataSource(fetcher);

const assetsResponse = {
  data: {
    items: [
      { id: 123, name: 'asset 1', description: 'test asset 1', metadata: { key1: 'value1' } },
      { id: 456, name: 'asset 2', description: 'test asset 2', metadata: { key1: 'value2' } },
      { id: 789, name: 'asset 3', description: 'test asset 3', metadata: { key1: 'value3' } },
      { id: 999, name: 'foo', description: 'bar', metadata: { key1: 'value1' } },
    ],
  },
};

describe('Metrics Query', () => {
  beforeAll(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runAllTimers();
    jest.clearAllMocks();
  });
  describe('Given an empty metrics query', () => {
    const variableQuery: VariableQueryData = {
      query: '',
    };
    it('should return empty array', async () => {
      const result = await ds.metricFindQuery(variableQuery);

      expect(result).toEqual([]);
      expect(fetcher.fetch).not.toBeCalled();
    });
  });

  describe('Given a metrics query with no options', () => {
    let result;
    const variableQuery: VariableQueryData = {
      query: 'assets{}',
    };
    beforeAll(async () => {
      fetcher.fetch = jest
        .fn()
        .mockImplementation(() => Promise.resolve(assetsResponse));
      result = await ds.metricFindQuery(variableQuery);
    });

    afterAll(() => {
      jest.clearAllMocks();
    });

    it('should generate the correct request', () => {
      expect(fetcher.fetch).toBeCalledTimes(1);
      expect((fetcher.fetch as Mock).mock.calls[0][0]).toMatchSnapshot();
    });

    it('should return all assets', () => {
      expect(result.length).toEqual(assetsResponse.data.items.length);
    });
  });

  describe('Given a simple metrics query', () => {
    let result;
    const id = 123;
    const variableQuery: VariableQueryData = {
      query: `assets{id=${id}}`,
    };
    const response = cloneDeep(assetsResponse);
    response.data.items = assetsResponse.data.items.filter((item) => item.id === id);

    beforeAll(async () => {
      fetcher.fetch = jest.fn().mockImplementation(() => Promise.resolve(response));
      result = await ds.metricFindQuery(variableQuery);
    });

    it('should generate the correct request', () => {
      expect(fetcher.fetch).toBeCalledTimes(1);
      expect((fetcher.fetch as Mock).mock.calls[0][0]).toMatchSnapshot();
    });

    it('should return the correct assets', () => {
      const resultIds = result.map(({ value }) => value);

      expect(result.length).toEqual(1);
      expect(resultIds.includes(id)).toBeTruthy();
    });
  });

  describe('Given a metrics query with filters', () => {
    let result;
    const variableQuery: VariableQueryData = {
      query: "assets{description=~'test asset.*', metadata={key1!='value2', key1!~'.*3'}}",
    };

    beforeAll(async () => {
      fetcher.fetch = jest
        .fn()
        .mockImplementation(() => Promise.resolve(assetsResponse));
      result = await ds.metricFindQuery(variableQuery);
    });

    it('should generate the correct request', () => {
      expect(fetcher.fetch).toBeCalledTimes(1);
      expect((fetcher.fetch as Mock).mock.calls[0][0]).toMatchSnapshot();
    });

    it('should return the correct assets', () => {
      const resultIds = result.map(({ value }) => value);

      expect(result.length).toEqual(1);
      expect(resultIds.includes(123)).toBeTruthy();
    });
  });

  describe('Given a metrics query with unmatched filters', () => {
    let result;
    const variableQuery: VariableQueryData = {
      query: "assets{description=~'non-matched filter.*', metadata={key1!='value2'}}",
    };

    beforeAll(async () => {
      fetcher.fetch = jest
        .fn()
        .mockImplementation(() => Promise.resolve(assetsResponse));
      result = await ds.metricFindQuery(variableQuery);
    });

    it('should generate the correct request', () => {
      expect(fetcher.fetch).toBeCalledTimes(1);
      expect((fetcher.fetch as Mock).mock.calls[0][0]).toMatchSnapshot();
    });

    it('should return the correct assets', () => {
      expect(result.length).toEqual(0);
    });
  });

  describe('Given an incomplete metrics query', () => {
    const variableQuery: VariableQueryData = {
      query: 'asset',
    };
    it('should return an empty array', async () => {
      const result = await ds.metricFindQuery(variableQuery);
      expect(result).toEqual([]);
      expect(fetcher.fetch).not.toBeCalled();
    });
  });

  describe('Given an incorrect filter query', () => {
    it('should return an empty array if filter type is wrong', async () => {
      const variableQuery: VariableQueryData = {
        query: "assets{name~='foo'}",
      };
      const result = await ds.metricFindQuery(variableQuery);
      expect(result).toEqual([]);
      expect(fetcher.fetch).not.toBeCalled();
    });
    it('should throw an error if filter regexp is wrong', async () => {
      const variableQuery: VariableQueryData = {
        query: "assets{name=~'*.foo'}",
      };
      expect(ds.metricFindQuery(variableQuery)).rejects.toMatchSnapshot();
      expect(fetcher.fetch).toBeCalledTimes(1);
    });
  });

  describe('Given a nested variable query', () => {
    const variableQuery: VariableQueryData = {
      query: 'assets{parentIds=[$AssetVariable]}',
    };

    beforeAll(async () => {
      fetcher.fetch = jest
        .fn()
        .mockImplementation(() => Promise.resolve(assetsResponse));
      await ds.metricFindQuery(variableQuery);
    });

    it('should generate the correct request', () => {
      expect(fetcher.fetch).toBeCalledTimes(1);
      expect((fetcher.fetch as Mock).mock.calls[0][0]).toMatchSnapshot();
    });
  });
});
