import { getMockedDataSource } from '../test_utils';
import { fetchCogniteActivityViews, fetchActivitiesFromDMS } from '../cdf/client';
import { Connector } from '../connector';
import {
  mockActivityViews,
  mockSingleActivityView,
  mockActivityDMSInstances,
  mockSingleActivity,
} from '../__mocks__/dmsTestData';

jest.mock('@grafana/runtime');

describe('CogniteActivity DMS Functions', () => {
  let fetcher: { fetch: jest.Mock };
  let ds: any;
  let connector: Connector;

  beforeEach(() => {
    fetcher = { fetch: jest.fn() };
    ds = getMockedDataSource(fetcher);
    connector = ds.connector as Connector;
  });

  describe('fetchCogniteActivityViews', () => {
    it('should fetch activity views successfully', async () => {
      fetcher.fetch.mockResolvedValue({
        data: {
          items: [
            {
              space: 'cdf_cdm',
              externalId: 'CogniteActivity',
              inspectionResults: {
                involvedViews: mockActivityViews,
                totalInvolvedViewCount: {
                  allVersions: 2,
                },
              },
            },
          ],
        },
        status: 200,
      });

      const result = await fetchCogniteActivityViews(connector);

      expect(fetcher.fetch).toHaveBeenCalledWith({
        url: '/api/datasources/proxy/6/cdf-oauth/api/v1/projects/TestProject/models/containers/inspect',
        method: 'POST',
        data: {
          items: [
            {
              space: 'cdf_cdm',
              externalId: 'CogniteActivity',
            },
          ],
          inspectionOperations: {
            involvedViews: {
              allVersions: true,
            },
            totalInvolvedViewCount: {
              allVersions: true,
              includeUnavailableViews: true,
            },
          },
        },
        headers: undefined,
      });
      expect(result).toEqual(mockActivityViews);
    });

    it('should return empty array on error', async () => {
      fetcher.fetch.mockRejectedValue(new Error('API Error'));

      const result = await fetchCogniteActivityViews(connector);

      expect(result).toEqual([]);
    });

    it('should return empty array when no activity views found', async () => {
      fetcher.fetch.mockResolvedValue({
        data: {
          items: [
            {
              space: 'cdf_cdm',
              externalId: 'CogniteActivity',
              inspectionResults: {
                involvedViews: [],
                totalInvolvedViewCount: {
                  allVersions: 0,
                },
              },
            },
          ],
        },
        status: 200,
      });

      const result = await fetchCogniteActivityViews(connector);

      expect(result).toEqual([]);
    });
  });

  describe('fetchActivitiesFromDMS', () => {
    const viewSpec = {
      space: 'cdf_cdm',
      externalId: 'CogniteActivity',
      version: 'v1',
    };
    const timeRange: [number, number] = [
      new Date('2026-01-01T00:00:00Z').getTime(),
      new Date('2026-01-31T23:59:59Z').getTime(),
    ];
    const timeSeriesInstanceId = {
      space: 'cdm_try',
      externalId: '59.9139-10.7522-current.temp',
    };

    it('should fetch activities with time range and time series filter', async () => {
      fetcher.fetch.mockResolvedValue({
        data: { items: mockActivityDMSInstances },
        status: 200,
      });

      const result = await fetchActivitiesFromDMS(
        connector,
        viewSpec,
        timeRange,
        false, // useScheduledTime
        timeSeriesInstanceId
      );

      expect(fetcher.fetch).toHaveBeenCalledWith({
        url: '/api/datasources/proxy/6/cdf-oauth/api/v1/projects/TestProject/models/instances/list',
        method: 'POST',
        data: {
          sources: [
            {
              source: {
                type: 'view',
                space: 'cdf_cdm',
                externalId: 'CogniteActivity',
                version: 'v1',
              },
            },
          ],
          instanceType: 'node',
          limit: 1000,
          filter: {
            and: [
              {
                range: {
                  property: ['cdf_cdm', 'CogniteActivity/v1', 'startTime'],
                  lte: new Date(timeRange[1]).toISOString(),
                },
              },
              {
                or: [
                  {
                    range: {
                      property: ['cdf_cdm', 'CogniteActivity/v1', 'endTime'],
                      gte: new Date(timeRange[0]).toISOString(),
                    },
                  },
                  {
                    isNull: {
                      property: ['cdf_cdm', 'CogniteActivity/v1', 'endTime'],
                    },
                  },
                ],
              },
              {
                in: {
                  property: ['cdf_cdm', 'CogniteActivity/v1', 'timeSeries'],
                  values: [
                    {
                      space: 'cdm_try',
                      externalId: '59.9139-10.7522-current.temp',
                    },
                  ],
                },
              },
            ],
          },
        },
        headers: undefined,
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        space: 'cdm_try',
        externalId: 'activity-temp-monitoring-1',
        name: 'Temperature Monitoring',
        startTime: '2026-01-15T10:00:00Z',
        endTime: '2026-01-15T12:00:00Z',
      });
    });

    it('should use scheduled time fields when useScheduledTime is true', async () => {
      fetcher.fetch.mockResolvedValue({
        data: { items: mockActivityDMSInstances },
        status: 200,
      });

      await fetchActivitiesFromDMS(
        connector,
        viewSpec,
        timeRange,
        true, // useScheduledTime
        timeSeriesInstanceId
      );

      const callData = fetcher.fetch.mock.calls[0][0].data;
      expect(callData.filter.and[0].range.property).toEqual([
        'cdf_cdm',
        'CogniteActivity/v1',
        'scheduledStartTime',
      ]);
      expect(callData.filter.and[1].or[0].range.property).toEqual([
        'cdf_cdm',
        'CogniteActivity/v1',
        'scheduledEndTime',
      ]);
      expect(callData.filter.and[1].or[1].isNull.property).toEqual([
        'cdf_cdm',
        'CogniteActivity/v1',
        'scheduledEndTime',
      ]);
    });

    it('should include filter for ongoing activities with null endTime', async () => {
      fetcher.fetch.mockResolvedValue({
        data: { items: mockActivityDMSInstances },
        status: 200,
      });

      await fetchActivitiesFromDMS(
        connector,
        viewSpec,
        timeRange,
        false,
        timeSeriesInstanceId
      );

      const callData = fetcher.fetch.mock.calls[0][0].data;
      
      // Verify the filter includes the or condition for null endTime
      expect(callData.filter.and[1].or).toBeDefined();
      expect(callData.filter.and[1].or).toHaveLength(2);
      
      // First condition: endTime >= rangeStart
      expect(callData.filter.and[1].or[0].range).toBeDefined();
      expect(callData.filter.and[1].or[0].range.property).toEqual([
        'cdf_cdm',
        'CogniteActivity/v1',
        'endTime',
      ]);
      expect(callData.filter.and[1].or[0].range.gte).toBe(new Date(timeRange[0]).toISOString());
      
      // Second condition: endTime is null (ongoing activities)
      expect(callData.filter.and[1].or[1].isNull).toBeDefined();
      expect(callData.filter.and[1].or[1].isNull.property).toEqual([
        'cdf_cdm',
        'CogniteActivity/v1',
        'endTime',
      ]);
    });

    it('should return empty array on error', async () => {
      fetcher.fetch.mockRejectedValue(new Error('Failed to fetch'));

      const result = await fetchActivitiesFromDMS(
        connector,
        viewSpec,
        timeRange,
        false,
        timeSeriesInstanceId
      );

      expect(result).toEqual([]);
    });

    it('should return empty array when no activities match', async () => {
      fetcher.fetch.mockResolvedValue({
        data: { items: [] },
        status: 200,
      });

      const result = await fetchActivitiesFromDMS(
        connector,
        viewSpec,
        timeRange,
        false,
        timeSeriesInstanceId
      );

      expect(result).toEqual([]);
    });

    it('should handle activities with missing optional fields', async () => {
      const minimalActivity = {
        instanceType: 'node' as const,
        space: 'cdm_try',
        externalId: 'activity-minimal',
        version: 1,
        lastUpdatedTime: 1640995200000,
        createdTime: 1640995200000,
        properties: {
          cdf_cdm: {
            'CogniteActivity/v1': {
              startTime: '2026-01-15T10:00:00Z',
              endTime: '2026-01-15T12:00:00Z',
            },
          },
        },
      };

      fetcher.fetch.mockResolvedValue({
        data: { items: [minimalActivity] },
        status: 200,
      });

      const result = await fetchActivitiesFromDMS(
        connector,
        viewSpec,
        timeRange,
        false,
        timeSeriesInstanceId
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        space: 'cdm_try',
        externalId: 'activity-minimal',
        startTime: '2026-01-15T10:00:00Z',
        endTime: '2026-01-15T12:00:00Z',
      });
      expect(result[0].name).toBeUndefined();
      expect(result[0].description).toBeUndefined();
    });
  });

  describe('API Workflow Integration', () => {
    it('should complete views -> activities workflow', async () => {
      const integrationFetcher = { fetch: jest.fn() };
      const integrationDs = getMockedDataSource(integrationFetcher);
      const integrationConnector = integrationDs.connector as Connector;

      // Setup sequential mock responses
      integrationFetcher.fetch
        .mockResolvedValueOnce({
          data: {
            items: [
              {
                space: 'cdf_cdm',
                externalId: 'CogniteActivity',
                inspectionResults: {
                  involvedViews: mockSingleActivityView,
                  totalInvolvedViewCount: {
                    allVersions: 1,
                  },
                },
              },
            ],
          },
          status: 200,
        })
        .mockResolvedValueOnce({
          data: { items: [mockActivityDMSInstances[0]] },
          status: 200,
        });

      // Test workflow
      const views = await fetchCogniteActivityViews(integrationConnector);
      expect(views).toEqual(mockSingleActivityView);

      const activities = await fetchActivitiesFromDMS(
        integrationConnector,
        {
          space: 'cdf_cdm',
          externalId: 'CogniteActivity',
          version: 'v1',
        },
        [
          new Date('2026-01-01T00:00:00Z').getTime(),
          new Date('2026-01-31T23:59:59Z').getTime(),
        ],
        false,
        {
          space: 'cdm_try',
          externalId: '59.9139-10.7522-current.temp',
        }
      );

      expect(activities).toHaveLength(1);
      expect(activities[0].name).toBe('Temperature Monitoring');
      expect(integrationFetcher.fetch).toHaveBeenCalledTimes(2);
    });
  });
});
