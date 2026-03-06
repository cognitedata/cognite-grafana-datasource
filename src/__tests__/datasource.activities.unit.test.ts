import { Connector } from '../connector';
import { defaultQuery, CogniteQuery, Tab } from '../types';
import { ActivityDatasource } from '../datasources/ActivityDatasource';
import { DataTopic, FieldType } from '@grafana/data';
import { mockActivities } from '../__mocks__/dmsTestData';
import * as cdfClient from '../cdf/client';

jest.mock('@grafana/runtime');
jest.mock('../cdf/client');

const defaultCogniteQuery = defaultQuery as CogniteQuery;

describe('ActivityDatasource unit tests', () => {
  let connector: Connector;
  let activityDatasource: ActivityDatasource;
  const startTime = new Date('2026-01-01T00:00:00Z').getTime();
  const endTime = new Date('2026-01-31T23:59:59Z').getTime();
  const fetchActivitiesFromDMSMock = jest.spyOn(cdfClient, 'fetchActivitiesFromDMS');

  beforeEach(() => {
    jest.resetAllMocks();
    connector = {
      fetchData: jest.fn(),
      fetchItems: jest.fn(),
      fetchAndPaginate: jest.fn(),
      isTemplatesEnabled: () => true,
      isEventsAdvancedFilteringEnabled: () => true,
      isFlexibleDataModellingEnabled: () => true,
      isExtractionPipelinesEnabled: () => true,
    } as unknown as Connector;
    activityDatasource = new ActivityDatasource(connector);
  });

  const baseQuery: CogniteQuery = {
    ...defaultCogniteQuery,
    refId: 'A',
    tab: Tab.CogniteTimeSeriesSearch,
    cogniteTimeSeries: {
      space: 'cdf_cdm',
      version: 'v1',
      externalId: 'CogniteTimeSeries',
      instanceId: {
        space: 'cdm_try',
        externalId: '59.9139-10.7522-current.temp',
      },
    },
    cogniteActivityQuery: {
      enabled: true,
      space: 'cdf_cdm',
      version: 'v1',
      externalId: 'CogniteActivity',
      useScheduledTime: false,
    },
  };

  describe('fetchActivitiesForTarget', () => {
    it('should return empty array when cogniteActivityQuery is not enabled', async () => {
      const query: CogniteQuery = {
        ...baseQuery,
        cogniteActivityQuery: {
          ...baseQuery.cogniteActivityQuery!,
          enabled: false,
        },
      };

      const result = await activityDatasource.fetchActivitiesForTarget(query, [startTime, endTime]);

      expect(result).toEqual([]);
      expect(fetchActivitiesFromDMSMock).not.toHaveBeenCalled();
    });

    it('should return empty array when cogniteActivityQuery is undefined', async () => {
      const query: CogniteQuery = {
        ...baseQuery,
        cogniteActivityQuery: undefined,
      };

      const result = await activityDatasource.fetchActivitiesForTarget(query, [startTime, endTime]);

      expect(result).toEqual([]);
      expect(fetchActivitiesFromDMSMock).not.toHaveBeenCalled();
    });

    it('should return empty array when no time series instance is selected', async () => {
      const query: CogniteQuery = {
        ...baseQuery,
        cogniteTimeSeries: {
          ...baseQuery.cogniteTimeSeries!,
          instanceId: undefined,
        },
      };

      const result = await activityDatasource.fetchActivitiesForTarget(query, [startTime, endTime]);

      expect(result).toEqual([]);
      expect(fetchActivitiesFromDMSMock).not.toHaveBeenCalled();
    });

    it('should return empty array when space is missing', async () => {
      const query: CogniteQuery = {
        ...baseQuery,
        cogniteActivityQuery: {
          ...baseQuery.cogniteActivityQuery!,
          space: '',
        },
      };

      const result = await activityDatasource.fetchActivitiesForTarget(query, [startTime, endTime]);

      expect(result).toEqual([]);
      expect(fetchActivitiesFromDMSMock).not.toHaveBeenCalled();
    });

    it('should return empty array when externalId is missing', async () => {
      const query: CogniteQuery = {
        ...baseQuery,
        cogniteActivityQuery: {
          ...baseQuery.cogniteActivityQuery!,
          externalId: '',
        },
      };

      const result = await activityDatasource.fetchActivitiesForTarget(query, [startTime, endTime]);

      expect(result).toEqual([]);
      expect(fetchActivitiesFromDMSMock).not.toHaveBeenCalled();
    });

    it('should return empty array when version is missing', async () => {
      const query: CogniteQuery = {
        ...baseQuery,
        cogniteActivityQuery: {
          ...baseQuery.cogniteActivityQuery!,
          version: '',
        },
      };

      const result = await activityDatasource.fetchActivitiesForTarget(query, [startTime, endTime]);

      expect(result).toEqual([]);
      expect(fetchActivitiesFromDMSMock).not.toHaveBeenCalled();
    });

    it('should successfully fetch activities with valid configuration', async () => {
      fetchActivitiesFromDMSMock.mockResolvedValue(mockActivities);

      const result = await activityDatasource.fetchActivitiesForTarget(baseQuery, [startTime, endTime]);

      expect(fetchActivitiesFromDMSMock).toHaveBeenCalledWith(
        connector,
        {
          space: 'cdf_cdm',
          externalId: 'CogniteActivity',
          version: 'v1',
        },
        [startTime, endTime],
        false,
        {
          space: 'cdm_try',
          externalId: '59.9139-10.7522-current.temp',
        }
      );
      expect(result).toEqual(mockActivities);
    });

    it('should pass useScheduledTime correctly', async () => {
      fetchActivitiesFromDMSMock.mockResolvedValue(mockActivities);

      const query: CogniteQuery = {
        ...baseQuery,
        cogniteActivityQuery: {
          ...baseQuery.cogniteActivityQuery!,
          useScheduledTime: true,
        },
      };

      await activityDatasource.fetchActivitiesForTarget(query, [startTime, endTime]);

      expect(fetchActivitiesFromDMSMock).toHaveBeenCalledWith(
        connector,
        expect.anything(),
        expect.anything(),
        true, // useScheduledTime
        expect.anything()
      );
    });

    it('should return empty array on error', async () => {
      fetchActivitiesFromDMSMock.mockRejectedValue(new Error('API Error'));

      const result = await activityDatasource.fetchActivitiesForTarget(baseQuery, [startTime, endTime]);

      expect(result).toEqual([]);
    });
  });

  describe('fetchActivityTargets', () => {
    it('should convert activities to annotation DataFrame', async () => {
      fetchActivitiesFromDMSMock.mockResolvedValue(mockActivities);

      const result = await activityDatasource.fetchActivityTargets([baseQuery], [startTime, endTime]);

      expect(result).toHaveLength(1);
      const dataFrame = result[0];

      // Check DataFrame metadata
      expect(dataFrame.refId).toBe(baseQuery.refId);
      expect(dataFrame.name).toBe('Activities');
      expect(dataFrame.meta?.dataTopic).toBe(DataTopic.Annotations);
      expect(dataFrame.length).toBe(3); // mockActivities has 3 items

      // Check field structure
      const fieldNames = dataFrame.fields.map((f) => f.name);
      expect(fieldNames).toEqual(['time', 'timeEnd', 'isRegion', 'text', 'title', 'tags']);

      // Check field types
      expect(dataFrame.fields[0].type).toBe(FieldType.time); // time
      expect(dataFrame.fields[1].type).toBe(FieldType.time); // timeEnd
      expect(dataFrame.fields[2].type).toBe(FieldType.boolean); // isRegion
      expect(dataFrame.fields[3].type).toBe(FieldType.string); // text
      expect(dataFrame.fields[4].type).toBe(FieldType.string); // title
      expect(dataFrame.fields[5].type).toBe(FieldType.other); // tags

      // Check isRegion values
      expect(dataFrame.fields[2].values).toEqual([true, true, true]);
    });

    it('should convert activity timestamps to milliseconds', async () => {
      fetchActivitiesFromDMSMock.mockResolvedValue([mockActivities[0]]);

      const result = await activityDatasource.fetchActivityTargets([baseQuery], [startTime, endTime]);

      const dataFrame = result[0];
      const timeField = dataFrame.fields.find((f) => f.name === 'time');
      const timeEndField = dataFrame.fields.find((f) => f.name === 'timeEnd');

      expect(timeField?.values[0]).toBe(new Date('2026-01-15T10:00:00Z').getTime());
      expect(timeEndField?.values[0]).toBe(new Date('2026-01-15T12:00:00Z').getTime());
    });

    it('should use scheduled time when configured', async () => {
      fetchActivitiesFromDMSMock.mockResolvedValue([mockActivities[0]]);

      const query: CogniteQuery = {
        ...baseQuery,
        cogniteActivityQuery: {
          ...baseQuery.cogniteActivityQuery!,
          useScheduledTime: true,
        },
      };

      const result = await activityDatasource.fetchActivityTargets([query], [startTime, endTime]);

      // Scheduled times are 1 hour earlier in mock data
      const dataFrame = result[0];
      const timeField = dataFrame.fields.find((f) => f.name === 'time');
      const timeEndField = dataFrame.fields.find((f) => f.name === 'timeEnd');

      expect(timeField?.values[0]).toBe(new Date('2026-01-15T09:00:00Z').getTime());
      expect(timeEndField?.values[0]).toBe(new Date('2026-01-15T11:00:00Z').getTime());
    });

    it('should use activity description as annotation text', async () => {
      fetchActivitiesFromDMSMock.mockResolvedValue([mockActivities[0]]);

      const result = await activityDatasource.fetchActivityTargets([baseQuery], [startTime, endTime]);

      const dataFrame = result[0];
      const textField = dataFrame.fields.find((f) => f.name === 'text');

      expect(textField?.values[0]).toBe('Monitoring temperature levels in Building A');
    });

    it('should use activity name as annotation title', async () => {
      fetchActivitiesFromDMSMock.mockResolvedValue([mockActivities[0]]);

      const result = await activityDatasource.fetchActivityTargets([baseQuery], [startTime, endTime]);

      const dataFrame = result[0];
      const titleField = dataFrame.fields.find((f) => f.name === 'title');

      expect(titleField?.values[0]).toBe('Temperature Monitoring');
    });

    it('should use activity type as tags', async () => {
      fetchActivitiesFromDMSMock.mockResolvedValue([mockActivities[0]]);

      const result = await activityDatasource.fetchActivityTargets([baseQuery], [startTime, endTime]);

      const dataFrame = result[0];
      const tagsField = dataFrame.fields.find((f) => f.name === 'tags');

      expect(tagsField?.values[0]).toEqual(['monitoring']);
    });

    it('should handle activities with missing optional fields', async () => {
      const minimalActivity = {
        space: 'cdm_try',
        externalId: 'activity-minimal',
        startTime: '2026-01-15T10:00:00Z',
        endTime: '2026-01-15T12:00:00Z',
      };

      fetchActivitiesFromDMSMock.mockResolvedValue([minimalActivity]);

      const result = await activityDatasource.fetchActivityTargets([baseQuery], [startTime, endTime]);

      const dataFrame = result[0];
      const textField = dataFrame.fields.find((f) => f.name === 'text');
      const titleField = dataFrame.fields.find((f) => f.name === 'title');
      const tagsField = dataFrame.fields.find((f) => f.name === 'tags');

      // Should fall back to externalId for text
      expect(textField?.values[0]).toBe('activity-minimal');
      // Should fall back to 'Activity' for title
      expect(titleField?.values[0]).toBe('Activity');
      // Should be empty array for tags
      expect(tagsField?.values[0]).toEqual([]);
    });

    it('should filter out activities without startTime', async () => {
      const activityWithoutStartTime = {
        space: 'cdm_try',
        externalId: 'activity-no-start',
        name: 'Missing Start Activity',
        endTime: '2026-01-15T12:00:00Z',
        // startTime missing
      };

      fetchActivitiesFromDMSMock.mockResolvedValue([activityWithoutStartTime]);

      const result = await activityDatasource.fetchActivityTargets([baseQuery], [startTime, endTime]);

      const dataFrame = result[0];
      expect(dataFrame.length).toBe(0);
      expect(dataFrame.fields[0].values).toEqual([]);
    });

    it('should use timeRangeEnd for missing endTime', async () => {
      const activityWithoutEndTime = {
        space: 'cdm_try',
        externalId: 'activity-no-end',
        name: 'Ongoing Activity',
        startTime: '2026-01-15T10:00:00Z',
        // endTime missing (ongoing activity)
      };

      fetchActivitiesFromDMSMock.mockResolvedValue([activityWithoutEndTime]);

      const result = await activityDatasource.fetchActivityTargets([baseQuery], [startTime, endTime]);

      const dataFrame = result[0];
      const timeField = dataFrame.fields.find((f) => f.name === 'time');
      const timeEndField = dataFrame.fields.find((f) => f.name === 'timeEnd');

      // Should use actual startTime and fall back to timeRangeEnd for endTime
      expect(timeField?.values[0]).toBe(new Date('2026-01-15T10:00:00Z').getTime());
      expect(timeEndField?.values[0]).toBe(endTime);
    });

    it('should handle multiple queries', async () => {
      fetchActivitiesFromDMSMock.mockResolvedValue([mockActivities[0]]);

      const query2: CogniteQuery = {
        ...baseQuery,
        refId: 'B',
      };

      const result = await activityDatasource.fetchActivityTargets([baseQuery, query2], [startTime, endTime]);

      expect(result).toHaveLength(2);
      expect(result[0].refId).toBe('A');
      expect(result[1].refId).toBe('B');
      expect(fetchActivitiesFromDMSMock).toHaveBeenCalledTimes(2);
    });

    it('should return empty DataFrame when no activities found', async () => {
      fetchActivitiesFromDMSMock.mockResolvedValue([]);

      const result = await activityDatasource.fetchActivityTargets([baseQuery], [startTime, endTime]);

      expect(result).toHaveLength(1);
      const dataFrame = result[0];
      expect(dataFrame.length).toBe(0);
      expect(dataFrame.meta?.dataTopic).toBe(DataTopic.Annotations);
    });
  });
});
