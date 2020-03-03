import { cloneDeep } from 'lodash';
import { getMockedDataSource } from './utils';
import { VariableQueryData } from '../types';

jest.mock('../cache');

const { ds, backendSrvMock } = getMockedDataSource();
const assets = [
  { id: 123, name: 'asset 1', description: 'test asset 1', metadata: { key1: 'value1' } },
  { id: 456, name: 'asset 2', description: 'test asset 2', metadata: { key1: 'value2' } },
  { id: 789, name: 'asset 3', description: 'test asset 3', metadata: { key1: 'value3' } },
  { id: 999, name: 'foo', description: 'bar', metadata: { key1: 'value1' } },
];
const assetsResponse = {
  data: {
    items: assets,
  },
};

describe('Metrics Query', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });
  describe('Given an empty metrics query', () => {
    const variableQuery: VariableQueryData = {
      query: '',
    };
    it('should return empty array', async () => {
      const result = await ds.metricFindQuery(variableQuery);

      expect(result).toEqual([]);
      expect(backendSrvMock.datasourceRequest).not.toBeCalled();
    });
  });

  describe('Given a metrics query with no options', () => {
    let result;
    const variableQuery: VariableQueryData = {
      query: 'assets{}',
    };
    beforeAll(async () => {
      backendSrvMock.datasourceRequest = jest
        .fn()
        .mockImplementation(() => Promise.resolve(assetsResponse));
      result = await ds.metricFindQuery(variableQuery);
    });

    afterAll(() => {
      jest.clearAllMocks();
    });

    it('should generate the correct request', () => {
      expect(backendSrvMock.datasourceRequest).toBeCalledTimes(1);
      expect(backendSrvMock.datasourceRequest.mock.calls[0][0]).toMatchSnapshot();
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
    response.data.items = assetsResponse.data.items.filter(item => item.id === id);

    beforeAll(async () => {
      backendSrvMock.datasourceRequest = jest
        .fn()
        .mockImplementation(() => Promise.resolve(response));
      result = await ds.metricFindQuery(variableQuery);
    });

    it('should generate the correct request', () => {
      expect(backendSrvMock.datasourceRequest).toBeCalledTimes(1);
      expect(backendSrvMock.datasourceRequest.mock.calls[0][0]).toMatchSnapshot();
    });

    it('should return the correct assets', () => {
      expect(result.length).toEqual(1);
    });
  });

  describe('Given a metrics query with filters', () => {
    let result;
    const variableQuery: VariableQueryData = {
      query: "assets{description=~'test asset.*', metadata={key1!='value2'}}",
    };

    beforeAll(async () => {
      backendSrvMock.datasourceRequest = jest
        .fn()
        .mockImplementation(() => Promise.resolve(assetsResponse));
      result = await ds.metricFindQuery(variableQuery);
    });

    it('should generate the correct request', () => {
      expect(backendSrvMock.datasourceRequest).toBeCalledTimes(1);
      expect(backendSrvMock.datasourceRequest.mock.calls[0][0]).toMatchSnapshot();
    });

    it('should return the correct assets', () => {
      expect(result.length).toEqual(2);
    });
  });

  describe('Given a metrics query with unmatched filters', () => {
    let result;
    const variableQuery: VariableQueryData = {
      query: "assets{description=~'non-matched filter.*', metadata={key1!='value2'}}",
    };

    beforeAll(async () => {
      backendSrvMock.datasourceRequest = jest
        .fn()
        .mockImplementation(() => Promise.resolve(assetsResponse));
      result = await ds.metricFindQuery(variableQuery);
    });

    it('should generate the correct request', () => {
      expect(backendSrvMock.datasourceRequest).toBeCalledTimes(1);
      expect(backendSrvMock.datasourceRequest.mock.calls[0][0]).toMatchSnapshot();
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
      expect(backendSrvMock.datasourceRequest).not.toBeCalled();
    });
  });

  describe('Given an incorrect filter query', () => {
    const variableQuery: VariableQueryData = {
      query: "assets{name~='foo'}",
    };
    it('should return an empty array', async () => {
      const result = await ds.metricFindQuery(variableQuery);
      expect(result).toEqual([]);
      expect(backendSrvMock.datasourceRequest).not.toBeCalled();
    });
  });
});
