import { cloneDeep } from 'lodash';
import { getMockedDataSource } from './utils';
import { Tab } from '../types';

jest.mock('../cache');

const { ds, backendSrvMock } = getMockedDataSource();

function getTimeseriesResponse(items) {
  const response = {
    data: {
      items,
    },
  };
  return response;
}

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

describe('Dropdown Options Query', () => {
  const tsResponse = getTimeseriesResponse([
    {
      name: 'Timeseries1',
      description: 'testA',
    },
    {
      name: 'Timeseries2',
      description: 'testB',
    },
    {
      name: 'Timeseries3',
      description: 'testC',
    },
    {
      name: 'Timeseries4',
      description: 'testD',
    },
    {
      name: 'Timeseries5',
      description: 'testE',
    },
    {
      name: 'Test',
    },
  ]);

  describe('Given an empty request for asset options', () => {
    let result;
    beforeAll(async () => {
      backendSrvMock.datasourceRequest = jest
        .fn()
        .mockImplementation(() => Promise.resolve(assetsResponse));
      result = await ds.getOptionsForDropdown('', Tab.Asset);
    });

    it('should generate the correct request', () => {
      expect(backendSrvMock.datasourceRequest).toBeCalledTimes(1);
      expect(backendSrvMock.datasourceRequest.mock.calls[0][0]).toMatchSnapshot();
    });

    it('should return all assets', () => {
      expect(result).toMatchSnapshot();
    });
  });

  describe('Given a request for asset options', () => {
    let result;
    const response = cloneDeep(assetsResponse);
    response.data.items = assetsResponse.data.items.filter(item => item.name.startsWith('asset'));
    beforeAll(async () => {
      backendSrvMock.datasourceRequest = jest
        .fn()
        .mockImplementation(() => Promise.resolve(response));
      result = await ds.getOptionsForDropdown('asset', Tab.Asset);
    });

    it('should generate the correct request', () => {
      expect(backendSrvMock.datasourceRequest).toBeCalledTimes(1);
      expect(backendSrvMock.datasourceRequest.mock.calls[0][0]).toMatchSnapshot();
    });

    it('should return the assets with asset in their name', () => {
      expect(result).toMatchSnapshot();
    });
  });

  describe('Given a request for asset options with additional options', () => {
    let result;
    const response = cloneDeep(assetsResponse);
    response.data.items = assetsResponse.data.items.filter(
      item => item.name.startsWith('asset') && item.metadata.key1 === 'value1'
    );
    const optionsObj = {
      metadata: '{"key1":"value1"}',
    };
    beforeAll(async () => {
      backendSrvMock.datasourceRequest = jest
        .fn()
        .mockImplementation(() => Promise.resolve(response));
      result = await ds.getOptionsForDropdown('asset', Tab.Asset, optionsObj);
    });

    it('should generate the correct request', () => {
      expect(backendSrvMock.datasourceRequest).toBeCalledTimes(1);
      expect(backendSrvMock.datasourceRequest.mock.calls[0][0]).toMatchSnapshot();
    });

    it('should return the assets with asset in their name and metadata.key1 = value1', () => {
      expect(result).toMatchSnapshot();
    });
  });

  describe('Given an empty request for timeseries options', () => {
    let result;
    beforeAll(async () => {
      backendSrvMock.datasourceRequest = jest
        .fn()
        .mockImplementation(() => Promise.resolve(tsResponse));
      result = await ds.getOptionsForDropdown('', Tab.Timeseries);
    });

    it('should generate the correct request', () => {
      expect(backendSrvMock.datasourceRequest).toBeCalledTimes(1);
      expect(backendSrvMock.datasourceRequest.mock.calls[0][0]).toMatchSnapshot();
    });

    it('should return all timeseries', () => {
      expect(result).toMatchSnapshot();
    });
  });

  describe('Given a request for timeseries options', () => {
    let result;
    const response = cloneDeep(tsResponse);
    response.data.items = tsResponse.data.items.filter(item => item.name.startsWith('Timeseries'));
    beforeAll(async () => {
      backendSrvMock.datasourceRequest = jest
        .fn()
        .mockImplementation(() => Promise.resolve(response));
      result = await ds.getOptionsForDropdown('Timeseries', Tab.Timeseries);
    });

    it('should generate the correct request', () => {
      expect(backendSrvMock.datasourceRequest).toBeCalledTimes(1);
      expect(backendSrvMock.datasourceRequest.mock.calls[0][0]).toMatchSnapshot();
    });

    it('should return timeseries with Timeseries in their name', () => {
      expect(result).toMatchSnapshot();
    });
  });
});
