import { cloneDeep } from 'lodash';
import { getMockedDataSource } from './utils';
import { VariableQueryData } from '../types';

jest.mock('../cache');

const { ds, backendSrvMock } = getMockedDataSource();

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
  describe('Given an empty metrics query', () => {
    let result;
    const variableQuery: VariableQueryData = {
      query: '',
      filter: '',
    };
    beforeAll(async () => {
      result = await ds.metricFindQuery(variableQuery);
    });
    it('should return a parse error', () => {
      expect(backendSrvMock.datasourceRequest).not.toBeCalled();
      expect(result).toMatchSnapshot();
    });
  });

  describe('Given a metrics query with no options', () => {
    let result;
    const variableQuery: VariableQueryData = {
      query: 'asset{}',
      filter: '',
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

    it('should return all assets', () => {
      expect(result).toMatchSnapshot();
    });
  });

  describe('Given a simple metrics query', () => {
    let result;
    const variableQuery: VariableQueryData = {
      query: 'asset{name=asset}',
      filter: '',
    };
    const response = cloneDeep(assetsResponse);
    response.data.items = assetsResponse.data.items.filter(item => item.name.startsWith('asset'));

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
      expect(result).toMatchSnapshot();
    });
  });

  describe('Given a metrics query with filters', () => {
    let result;
    const variableQuery: VariableQueryData = {
      query: 'asset{}',
      filter: 'filter{description=~ "test asset.*", metadata.key1 != value2}',
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
      expect(result).toMatchSnapshot();
    });
  });

  describe('Given an incomplete metrics query', () => {
    let result;
    const variableQuery: VariableQueryData = {
      query: 'asset{',
      filter: '',
    };
    beforeAll(async () => {
      backendSrvMock.datasourceRequest.mockReset();
      result = await ds.metricFindQuery(variableQuery);
    });
    it('should not generate a request', () => {
      expect(backendSrvMock.datasourceRequest).not.toBeCalled();
    });
    it('should return an error', () => {
      expect(result).toMatchSnapshot();
    });
  });

  describe('Given an incorrect metrics query', () => {
    let result;
    const variableQuery: VariableQueryData = {
      query: 'asset{name=~asset.*}',
      filter: '',
    };
    beforeAll(async () => {
      result = await ds.metricFindQuery(variableQuery);
    });
    it('should not generate a request', () => {
      expect(backendSrvMock.datasourceRequest).not.toBeCalled();
    });
    it('should return an error', () => {
      expect(result).toMatchSnapshot();
    });
  });

  describe('Given an incorrect metrics query', () => {
    let result;
    const variableQuery: VariableQueryData = {
      query: 'asset{name="asset}',
      filter: '',
    };
    beforeAll(async () => {
      result = await ds.metricFindQuery(variableQuery);
    });
    it('should not generate a request', () => {
      expect(backendSrvMock.datasourceRequest).not.toBeCalled();
    });
    it('should return an error', () => {
      expect(result).toMatchSnapshot();
    });
  });

  describe('Given an incorrect filter query', () => {
    let result;
    const variableQuery: VariableQueryData = {
      query: 'asset{name=foo}',
      filter: 'filter{',
    };
    beforeAll(async () => {
      result = await ds.metricFindQuery(variableQuery);
    });
    it('should not generate a request', () => {
      expect(backendSrvMock.datasourceRequest).not.toBeCalled();
    });
    it('should return an error', () => {
      expect(result).toMatchSnapshot();
    });
  });

  describe('Given an incorrect filter query', () => {
    let result;
    const variableQuery: VariableQueryData = {
      query: 'asset{name=foo}',
      filter: 'filter{foo}',
    };
    beforeAll(async () => {
      result = await ds.metricFindQuery(variableQuery);
    });
    it('should not generate a request', () => {
      expect(backendSrvMock.datasourceRequest).not.toBeCalled();
    });
    it('should return an error', () => {
      expect(result).toMatchSnapshot();
    });
  });
});
