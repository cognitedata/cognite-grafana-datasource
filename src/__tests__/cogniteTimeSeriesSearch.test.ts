import { getMockedDataSource } from '../test_utils';
import { fetchDMSSpaces, fetchDMSViews, searchDMSInstances } from '../cdf/client';
import { DMSSpace, DMSView, DMSInstance } from '../types/dms';
import { Connector } from '../connector';
import {
  mockSpaces,
  mockViews,
  mockInstances,
  mockInstancesWithStringType,
  mockSingleSpace,
  mockSingleView,
  mockSingleInstance,
} from '../__mocks__/dmsTestData';

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
      const emptySpaces: DMSSpace[] = [];
      fetcher.fetch.mockResolvedValue({
        data: { items: emptySpaces },
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
      const emptyViews: DMSView[] = [];
      fetcher.fetch.mockResolvedValue({
        data: { items: emptyViews },
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
      const emptyViews: DMSView[] = [];
      fetcher.fetch.mockResolvedValue({
        data: { items: emptyViews },
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
      const emptyInstances: DMSInstance[] = [];
      fetcher.fetch.mockResolvedValue({
        data: { items: emptyInstances },
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

      fetcher.fetch.mockResolvedValue({
        data: { items: mockInstancesWithStringType },
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

      expect(result).toEqual(mockInstancesWithStringType);
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

      // Setup sequential mock responses
      integrationFetcher.fetch
        .mockResolvedValueOnce({ data: { items: mockSingleSpace }, status: 200 })
        .mockResolvedValueOnce({ data: { items: mockSingleView }, status: 200 })
        .mockResolvedValueOnce({ data: { items: mockSingleInstance }, status: 200 });

      // Test workflow
      const spaces = await fetchDMSSpaces(integrationConnector);
      expect(spaces).toEqual(mockSingleSpace);

      const views = await fetchDMSViews(integrationConnector, 'cdf_cdm');
      expect(views).toEqual(mockSingleView);

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
      expect(instances).toEqual(mockSingleInstance);

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
