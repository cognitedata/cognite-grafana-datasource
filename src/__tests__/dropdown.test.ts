import { cloneDeep } from 'lodash';
import { getMockedDataSource } from './utils';
import { Tab } from '../types';

const { ds, backendSrvMock } = getMockedDataSource();

function getTimeseriesResponse(items) {
  return {
    data: {
      items,
    },
  };
}

const assetsResponse = {
  data: {
    items: [
      { id: 123, externalId: 'asset 1', description: 'test asset 1', metadata: { key1: 'value1' } },
      { id: 456, externalId: 'asset 2', description: 'test asset 2', metadata: { key1: 'value2' } },
      { id: 789, externalId: 'asset 3', description: 'test asset 3', metadata: { key1: 'value3' } },
      { id: 999, externalId: 'foo', description: 'bar', metadata: { key1: 'value1' } },
    ],
  },
};

describe('Dropdown Options Query', () => {
  const tsResponse = getTimeseriesResponse([
    {
      id: 1,
      externalId: 'Timeseries1',
      description: 'testA',
    },
    {
      id: 2,
      externalId: 'Timeseries2',
      description: 'testB',
    },
    {
      id: 3,
      externalId: 'Timeseries3',
      description: 'testC',
    },
    {
      id: 4,
      externalId: 'Timeseries4',
      description: 'testD',
    },
    {
      id: 5,
      externalId: 'Timeseries5',
      description: 'testE',
    },
    {
      id: 6,
      externalId: 'Test',
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
    response.data.items = assetsResponse.data.items.filter((item) =>
      item.externalId.startsWith('asset')
    );
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
      (item) => item.externalId.startsWith('asset') && item.metadata.key1 === 'value1'
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
    response.data.items = tsResponse.data.items.filter(
      (item) => item.description && item.description.startsWith('test')
    );
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
