import { getMockedDataSource } from '../test_utils';
import { fetchDMSSpaces, fetchDMSViews, searchDMSInstances } from '../cdf/client';
import { DMSSpace, DMSView, DMSInstance } from '../types/dms';
import { Connector } from '../connector';

jest.mock('@grafana/runtime');

describe('CogniteTimeSeriesSearch DMS Functions', () => {
  let fetcher: { fetch: jest.Mock };
  let ds: any;
  let connector: Connector;

  beforeEach(() => {
    fetcher = { fetch: jest.fn() };
    ds = getMockedDataSource(fetcher);
    connector = ds.connector as Connector;
  });

  describe('fetchDMSSpaces', () => {
    it('should fetch spaces successfully', async () => {
      const mockSpaces: DMSSpace[] = [
        {
          space: 'cdf_cdm',
          name: 'CDF CDM',
          description: 'Common Data Model',
          createdTime: 1640995200000,
          lastUpdatedTime: 1640995200000,
        },
        {
          space: 'my_space',
          name: 'My Space',
          description: 'Custom space',
          createdTime: 1640995200000,
          lastUpdatedTime: 1640995200000,
        },
      ];

      fetcher.fetch.mockResolvedValue({
        data: { items: mockSpaces },
        status: 200,
      });

      const result = await fetchDMSSpaces(connector);

      expect(fetcher.fetch).toHaveBeenCalledWith({
        url: '/api/datasources/proxy/6/cdf-oauth/api/v1/projects/TestProject/models/spaces?includeGlobal=true&limit=1000',
        method: 'GET',
        data: undefined,
        headers: undefined,
      });
      expect(result).toEqual(mockSpaces);
    });

    it('should support custom limit', async () => {
      const mockSpaces: DMSSpace[] = [];
      fetcher.fetch.mockResolvedValue({
        data: { items: mockSpaces },
        status: 200,
      });

      await fetchDMSSpaces(connector, 500);

      expect(fetcher.fetch).toHaveBeenCalledWith({
        url: '/api/datasources/proxy/6/cdf-oauth/api/v1/projects/TestProject/models/spaces?includeGlobal=true&limit=500',
        method: 'GET',
        data: undefined,
        headers: undefined,
      });
    });
  });

  describe('fetchDMSViews', () => {
    it('should fetch views for a space successfully', async () => {
      const mockViews: DMSView[] = [
        {
          space: 'cdf_cdm',
          externalId: 'CogniteTimeSeries',
          version: 'v1',
          name: 'Cognite Time Series',
          description: 'Time series view',
          createdTime: 1640995200000,
          lastUpdatedTime: 1640995200000,
        },
        {
          space: 'cdf_cdm',
          externalId: 'CogniteAsset',
          version: 'v1',
          name: 'Cognite Asset',
          description: 'Asset view',
          createdTime: 1640995200000,
          lastUpdatedTime: 1640995200000,
        },
      ];

      fetcher.fetch.mockResolvedValue({
        data: { items: mockViews },
        status: 200,
      });

      const result = await fetchDMSViews(connector, 'cdf_cdm');

      expect(fetcher.fetch).toHaveBeenCalledWith({
        url: '/api/datasources/proxy/6/cdf-oauth/api/v1/projects/TestProject/models/views?includeGlobal=true&limit=1000&space=cdf_cdm',
        method: 'GET',
        data: undefined,
        headers: undefined,
      });
      expect(result).toEqual(mockViews);
    });

    it('should fetch all views when no space is specified', async () => {
      const mockViews: DMSView[] = [];
      fetcher.fetch.mockResolvedValue({
        data: { items: mockViews },
        status: 200,
      });

      await fetchDMSViews(connector);

      expect(fetcher.fetch).toHaveBeenCalledWith({
        url: '/api/datasources/proxy/6/cdf-oauth/api/v1/projects/TestProject/models/views?includeGlobal=true&limit=1000',
        method: 'GET',
        data: undefined,
        headers: undefined,
      });
    });

    it('should support custom limit', async () => {
      const mockViews: DMSView[] = [];
      fetcher.fetch.mockResolvedValue({
        data: { items: mockViews },
        status: 200,
      });

      await fetchDMSViews(connector, 'cdf_cdm', 250);

      expect(fetcher.fetch).toHaveBeenCalledWith({
        url: '/api/datasources/proxy/6/cdf-oauth/api/v1/projects/TestProject/models/views?includeGlobal=true&limit=250&space=cdf_cdm',
        method: 'GET',
        data: undefined,
        headers: undefined,
      });
    });
  });

  describe('searchDMSInstances', () => {
    it('should search instances successfully', async () => {
      const mockInstances: DMSInstance[] = [
        {
          instanceType: 'node',
          space: 'cdf_cdm',
          externalId: 'temperature_sensor_1',
          version: 1,
          lastUpdatedTime: 1640995200000,
          createdTime: 1640995200000,
          properties: {
            cdf_cdm: {
              'CogniteTimeSeries/v1': {
                name: 'Temperature Sensor 1',
                description: 'Building A temperature sensor',
                type: 'numeric',
              },
            },
          },
        },
        {
          instanceType: 'node',
          space: 'cdf_cdm',
          externalId: 'pressure_sensor_1',
          version: 1,
          lastUpdatedTime: 1640995200000,
          createdTime: 1640995200000,
          properties: {
            cdf_cdm: {
              'CogniteTimeSeries/v1': {
                name: 'Pressure Sensor 1',
                description: 'Building A pressure sensor',
                type: 'numeric',
              },
            },
          },
        },
      ];

      fetcher.fetch.mockResolvedValue({
        data: { items: mockInstances },
        status: 200,
      });

      const searchRequest = {
        view: {
          type: 'view' as const,
          space: 'cdf_cdm',
          externalId: 'CogniteTimeSeries',
          version: 'v1',
        },
        query: 'temperature',
        filter: {
          not: {
            equals: {
              property: ['type'],
              value: 'string',
            },
          },
        },
        limit: 10,
      };

      const result = await searchDMSInstances(connector, searchRequest);

      expect(fetcher.fetch).toHaveBeenCalledWith({
        url: '/api/datasources/proxy/6/cdf-oauth/api/v1/projects/TestProject/models/instances/search',
        method: 'POST',
        data: searchRequest,
        headers: undefined,
      });
      expect(result).toEqual(mockInstances);
    });

    it('should support search without query (browse all)', async () => {
      const mockInstances: DMSInstance[] = [];
      fetcher.fetch.mockResolvedValue({
        data: { items: mockInstances },
        status: 200,
      });

      const searchRequest = {
        view: {
          type: 'view' as const,
          space: 'cdf_cdm',
          externalId: 'CogniteTimeSeries',
          version: 'v1',
        },
        limit: 1000,
      };

      await searchDMSInstances(connector, searchRequest);

      expect(fetcher.fetch).toHaveBeenCalledWith({
        url: '/api/datasources/proxy/6/cdf-oauth/api/v1/projects/TestProject/models/instances/search',
        method: 'POST',
        data: searchRequest,
        headers: undefined,
      });
    });

    it('should filter out string-type timeseries', async () => {
      const mockInstances: DMSInstance[] = [
        {
          instanceType: 'node',
          space: 'cdf_cdm',
          externalId: 'numeric_sensor',
          version: 1,
          lastUpdatedTime: 1640995200000,
          createdTime: 1640995200000,
          properties: {
            cdf_cdm: {
              'CogniteTimeSeries/v1': {
                name: 'Numeric Sensor',
                type: 'numeric',
              },
            },
          },
        },
        {
          instanceType: 'node',
          space: 'cdf_cdm',
          externalId: 'string_sensor',
          version: 1,
          lastUpdatedTime: 1640995200000,
          createdTime: 1640995200000,
          properties: {
            cdf_cdm: {
              'CogniteTimeSeries/v1': {
                name: 'String Sensor',
                type: 'string',
              },
            },
          },
        },
      ];

      fetcher.fetch.mockResolvedValue({
        data: { items: mockInstances },
        status: 200,
      });

      const searchRequest = {
        view: {
          type: 'view' as const,
          space: 'cdf_cdm',
          externalId: 'CogniteTimeSeries',
          version: 'v1',
        },
        query: 'sensor',
        filter: {
          not: {
            equals: {
              property: ['type'],
              value: 'string',
            },
          },
        },
        limit: 10,
      };

      const result = await searchDMSInstances(connector, searchRequest);

      expect(result).toEqual(mockInstances);
      expect(fetcher.fetch).toHaveBeenCalledWith({
        url: '/api/datasources/proxy/6/cdf-oauth/api/v1/projects/TestProject/models/instances/search',
        method: 'POST',
        data: searchRequest,
        headers: undefined,
      });
    });

    it('should handle search instances error', async () => {
      const errorMessage = 'Search failed';
      fetcher.fetch.mockRejectedValue(new Error(errorMessage));

      const searchRequest = {
        view: {
          type: 'view' as const,
          space: 'cdf_cdm',
          externalId: 'CogniteTimeSeries',
          version: 'v1',
        },
        query: 'temperature',
        limit: 10,
      };

      await expect(searchDMSInstances(connector, searchRequest)).rejects.toThrow(errorMessage);
    });
  });

  describe('API Workflow Integration', () => {
    it('should complete spaces -> views -> search workflow', async () => {
      // Create fresh fetcher and connector for this test
      const integrationFetcher = { fetch: jest.fn() };
      const integrationDs = getMockedDataSource(integrationFetcher);
      const integrationConnector = integrationDs.connector as Connector;

      // Mock data
      const mockSpaces: DMSSpace[] = [
        {
          space: 'cdf_cdm',
          name: 'CDF CDM',
          description: 'Common Data Model',
          createdTime: 1640995200000,
          lastUpdatedTime: 1640995200000,
        },
      ];

      const mockViews: DMSView[] = [
        {
          space: 'cdf_cdm',
          externalId: 'CogniteTimeSeries',
          version: 'v1',
          name: 'Cognite Time Series',
          description: 'Time series view',
          createdTime: 1640995200000,
          lastUpdatedTime: 1640995200000,
        },
      ];

      const mockInstances: DMSInstance[] = [
        {
          instanceType: 'node',
          space: 'cdf_cdm',
          externalId: 'temperature_sensor_1',
          version: 1,
          lastUpdatedTime: 1640995200000,
          createdTime: 1640995200000,
          properties: {
            cdf_cdm: {
              'CogniteTimeSeries/v1': {
                name: 'Temperature Sensor 1',
                type: 'numeric',
              },
            },
          },
        },
      ];

      // Setup sequential mock responses
      integrationFetcher.fetch
        .mockResolvedValueOnce({ data: { items: mockSpaces }, status: 200 })
        .mockResolvedValueOnce({ data: { items: mockViews }, status: 200 })
        .mockResolvedValueOnce({ data: { items: mockInstances }, status: 200 });

      // Test workflow
      const spaces = await fetchDMSSpaces(integrationConnector);
      expect(spaces).toEqual(mockSpaces);

      const views = await fetchDMSViews(integrationConnector, 'cdf_cdm');
      expect(views).toEqual(mockViews);

      const instances = await searchDMSInstances(integrationConnector, {
        view: {
          type: 'view',
          space: 'cdf_cdm',
          externalId: 'CogniteTimeSeries',
          version: 'v1',
        },
        query: 'temperature',
        limit: 10,
      });
      expect(instances).toEqual(mockInstances);

      expect(integrationFetcher.fetch).toHaveBeenCalledTimes(3);
    });

    it('should handle empty API responses', async () => {
      // Create fresh fetcher and connector for this test
      const emptyFetcher = { fetch: jest.fn() };
      const emptyDs = getMockedDataSource(emptyFetcher);
      const emptyConnector = emptyDs.connector as Connector;

      // Setup empty responses
      emptyFetcher.fetch.mockResolvedValue({
        data: { items: [] },
        status: 200,
      });

      const spaces = await fetchDMSSpaces(emptyConnector);
      expect(spaces).toEqual([]);

      const views = await fetchDMSViews(emptyConnector, 'nonexistent_space');
      expect(views).toEqual([]);

      const instances = await searchDMSInstances(emptyConnector, {
        view: {
          type: 'view',
          space: 'cdf_cdm',
          externalId: 'CogniteTimeSeries',
          version: 'v1',
        },
        query: 'nonexistent_query',
        limit: 10,
      });
      expect(instances).toEqual([]);
    });
  });
}); 
