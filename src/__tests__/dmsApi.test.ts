import { Connector } from '../connector';
import { HttpMethod } from '../types';
import { CacheTime } from '../constants';
import {
  fetchDMSSpaces,
  fetchDMSViews,
  searchDMSInstances,
  createInstanceDataQueryRequest,
} from '../cdf/client';
import {
  DMSSpace,
  DMSView,
  DMSInstance,
  DMSSearchRequest,
  DMSInstanceId,
} from '../cdf/types';

// Mock the connector
const mockConnector = {
  fetchItems: jest.fn(),
} as unknown as Connector;

describe('DMS API Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchDMSSpaces', () => {
    it('should fetch DMS spaces with default limit', async () => {
      const mockSpaces: DMSSpace[] = [
        {
          space: 'cdf_cdm',
          name: 'CDF Common Data Model',
          description: 'Common Data Model space',
          createdTime: 1234567890,
          lastUpdatedTime: 1234567890,
        },
      ];

      (mockConnector.fetchItems as jest.Mock).mockResolvedValue(mockSpaces);

      const result = await fetchDMSSpaces(mockConnector);

      expect(mockConnector.fetchItems).toHaveBeenCalledWith({
        method: HttpMethod.GET,
        path: '/models/spaces',
        data: undefined,
        params: { limit: 1000, includeGlobal: true },
        cacheTime: CacheTime.ResourceByIds,
      });
      expect(result).toEqual(mockSpaces);
    });

    it('should fetch DMS spaces with custom limit', async () => {
      const mockSpaces: DMSSpace[] = [];
      (mockConnector.fetchItems as jest.Mock).mockResolvedValue(mockSpaces);

      await fetchDMSSpaces(mockConnector, 500);

      expect(mockConnector.fetchItems).toHaveBeenCalledWith({
        method: HttpMethod.GET,
        path: '/models/spaces',
        data: undefined,
        params: { limit: 500, includeGlobal: true },
        cacheTime: CacheTime.ResourceByIds,
      });
    });
  });

  describe('fetchDMSViews', () => {
    it('should fetch DMS views without space filter', async () => {
      const mockViews: DMSView[] = [
        {
          space: 'cdf_cdm',
          externalId: 'CogniteTimeSeries',
          version: 'v1',
          name: 'Cognite Time Series',
          description: 'Time series view',
          createdTime: 1234567890,
          lastUpdatedTime: 1234567890,
        },
      ];

      (mockConnector.fetchItems as jest.Mock).mockResolvedValue(mockViews);

      const result = await fetchDMSViews(mockConnector);

      expect(mockConnector.fetchItems).toHaveBeenCalledWith({
        method: HttpMethod.GET,
        path: '/models/views',
        data: undefined,
        params: { limit: 1000, includeGlobal: true },
        cacheTime: CacheTime.ResourceByIds,
      });
      expect(result).toEqual(mockViews);
    });

    it('should fetch DMS views with space filter', async () => {
      const mockViews: DMSView[] = [];
      (mockConnector.fetchItems as jest.Mock).mockResolvedValue(mockViews);

      await fetchDMSViews(mockConnector, 'cdf_cdm', 500);

      expect(mockConnector.fetchItems).toHaveBeenCalledWith({
        method: HttpMethod.GET,
        path: '/models/views',
        data: undefined,
        params: { space: 'cdf_cdm', limit: 500, includeGlobal: true },
        cacheTime: CacheTime.ResourceByIds,
      });
    });
  });

  describe('searchDMSInstances', () => {
    it('should search DMS instances', async () => {
      const mockInstances: DMSInstance[] = [
        {
          instanceType: 'node',
          space: 'cdf_cdm',
          externalId: 'ts_1',
          version: 1,
          lastUpdatedTime: 1234567890,
          createdTime: 1234567890,
          properties: {
            cdf_cdm: {
              CogniteTimeSeries: {
                name: 'Temperature Sensor 1',
              },
            },
          },
        },
      ];

      const searchRequest: DMSSearchRequest = {
        view: {
          type: 'view',
          space: 'cdf_cdm',
          externalId: 'CogniteTimeSeries',
          version: 'v1',
        },
        query: 'temperature',
        limit: 100,
      };

      (mockConnector.fetchItems as jest.Mock).mockResolvedValue(mockInstances);

      const result = await searchDMSInstances(mockConnector, searchRequest);

      expect(mockConnector.fetchItems).toHaveBeenCalledWith({
        method: HttpMethod.POST,
        path: '/models/instances/search',
        data: searchRequest,
      });
      expect(result).toEqual(mockInstances);
    });
  });

  describe('createInstanceDataQueryRequest', () => {
    it('should create data query request items from instance IDs', () => {
      const instances: DMSInstanceId[] = [
        { space: 'cdf_cdm', externalId: 'ts_1' },
        { space: 'cdf_cdm', externalId: 'ts_2' },
      ];

      const options = {
        timeZone: 'UTC',
      } as any;

      const result = createInstanceDataQueryRequest(instances, options);

      expect(result).toEqual([
        {
          instanceId: {
            space: 'cdf_cdm',
            externalId: 'ts_1',
          },
        },
        {
          instanceId: {
            space: 'cdf_cdm',
            externalId: 'ts_2',
          },
        },
      ]);
    });
  });
}); 