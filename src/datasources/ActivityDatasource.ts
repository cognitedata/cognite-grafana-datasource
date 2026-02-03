import { DataQueryRequest, DataQueryResponse, DataFrame, FieldType, DataTopic } from '@grafana/data';
import { CogniteQuery, CogniteActivityQuery, HttpMethod, Tuple } from '../types';
import { Connector } from '../connector';
import { getRange } from '../utils';
import { CogniteActivity } from '../types/dms';
import { fetchActivitiesFromDMS } from '../cdf/client';
import { handleError } from '../appEventHandler';

// Convert activities to annotation format for overlay on charts
const convertActivitiesToAnnotations = (
  activities: CogniteActivity[],
  useScheduledTime: boolean,
  timeRangeEnd: number
) => {
  return activities.map((activity) => {
    const startTime = useScheduledTime ? activity.scheduledStartTime : activity.startTime;
    const endTime = useScheduledTime ? activity.scheduledEndTime : activity.endTime;
    
    // Convert ISO strings to timestamps (milliseconds)
    const startTimeMs = startTime ? new Date(startTime).getTime() : timeRangeEnd;
    const endTimeMs = endTime ? new Date(endTime).getTime() : timeRangeEnd;
    
    return {
      id: activity.externalId,
      isRegion: true,
      text: activity.description || activity.name || activity.externalId,
      time: startTimeMs,
      timeEnd: endTimeMs,
      title: activity.name || activity.type || 'Activity',
      tags: activity.type ? [activity.type] : [],
    };
  });
};

// Convert activities date fields for table display
export const convertActivitiesDateFields = (activities: CogniteActivity[]) => {
  return activities.map(({ createdTime, lastUpdatedTime, startTime, endTime, scheduledStartTime, scheduledEndTime, ...rest }) => {
    return {
      ...rest,
      ...(createdTime && { createdTime: new Date(createdTime) }),
      ...(lastUpdatedTime && { lastUpdatedTime: new Date(lastUpdatedTime) }),
      ...(startTime && { startTime: new Date(startTime) }),
      ...(endTime && { endTime: new Date(endTime) }),
      ...(scheduledStartTime && { scheduledStartTime: new Date(scheduledStartTime) }),
      ...(scheduledEndTime && { scheduledEndTime: new Date(scheduledEndTime) }),
    };
  });
};

export class ActivityDatasource {
  constructor(private connector: Connector) {}

  async query(options: DataQueryRequest<CogniteQuery>): Promise<DataQueryResponse> {
    const timeRange = getRange(options.range);
    const activityResults = await this.fetchActivityTargets(options.targets, timeRange);
    return { data: activityResults };
  }

  async fetchActivitiesForTarget(
    target: CogniteQuery,
    [rangeStart, rangeEnd]: Tuple<number>
  ): Promise<CogniteActivity[]> {
    const { refId, cogniteActivityQuery, cogniteTimeSeries } = target;

    if (!cogniteActivityQuery || !cogniteActivityQuery.enabled) {
      return [];
    }

    // Must have a selected time series instance to filter activities
    if (!cogniteTimeSeries?.instanceId) {
      return [];
    }

    const { space, externalId, version, useScheduledTime, searchQuery } = cogniteActivityQuery;

    if (!space || !externalId || !version) {
      return [];
    }

    try {
      const activities = await fetchActivitiesFromDMS(
        this.connector,
        { space, externalId, version },
        [rangeStart, rangeEnd],
        useScheduledTime,
        cogniteTimeSeries.instanceId,
        searchQuery
      );
      return activities;
    } catch (e) {
      handleError(e, refId);
      return [];
    }
  }

  async fetchActivityTargets(targets: CogniteQuery[], timeRange: Tuple<number>) {
    return Promise.all(
      targets.map(async (target) => {
        const activities = await this.fetchActivitiesForTarget(target, timeRange);
        
        // Convert to annotations for overlay display
        const items = convertActivitiesToAnnotations(
          activities,
          target.cogniteActivityQuery?.useScheduledTime || false,
          timeRange[1]
        );
        
        // Create DataFrame with explicit field types for annotations
        const dataFrame: DataFrame = {
          refId: target.refId,
          name: 'Activities',
          meta: {
            dataTopic: DataTopic.Annotations,
          },
          fields: [
            {
              name: 'time',
              type: FieldType.time,
              config: {},
              values: items.map(item => item.time),
            },
            {
              name: 'timeEnd',
              type: FieldType.time,
              config: {},
              values: items.map(item => item.timeEnd),
            },
            {
              name: 'isRegion',
              type: FieldType.boolean,
              config: {},
              values: items.map(() => true),
            },
            {
              name: 'text',
              type: FieldType.string,
              config: {},
              values: items.map(item => item.text),
            },
            {
              name: 'title',
              type: FieldType.string,
              config: {},
              values: items.map(item => item.title),
            },
            {
              name: 'tags',
              type: FieldType.other,
              config: {},
              values: items.map(item => item.tags),
            },
          ],
          length: items.length,
        };
        
        return dataFrame;
      })
    );
  }
}
