import { DataQueryRequest, DataQueryResponse, DataFrame, FieldType, DataTopic } from '@grafana/data';
import { CogniteQuery, CogniteActivityQuery, HttpMethod, Tuple } from '../types';
import { Connector } from '../connector';
import { getRange } from '../utils';
import { CogniteActivity } from '../types/dms';
import { fetchActivitiesFromDMS, fetchActivitiesByAssets } from '../cdf/client';
import { handleError } from '../appEventHandler';

// Convert activities to annotation format for overlay on charts
const convertActivitiesToAnnotations = (
  activities: CogniteActivity[],
  useScheduledTime: boolean,
  timeRangeEnd: number
) => {
  return activities
    .filter((activity) => {
      const startTime = useScheduledTime ? activity.scheduledStartTime : activity.startTime;
      // Filter out activities without startTime
      return !!startTime;
    })
    .map((activity) => {
      const startTime = useScheduledTime ? activity.scheduledStartTime : activity.startTime;
      const endTime = useScheduledTime ? activity.scheduledEndTime : activity.endTime;
      
      return {
        id: activity.externalId,
        isRegion: true,
        text: activity.description || activity.name || activity.externalId,
        time: new Date(startTime!).getTime(),
        timeEnd: endTime ? new Date(endTime).getTime() : timeRangeEnd,
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

    const { space, externalId, version, useScheduledTime } = cogniteActivityQuery;

    if (!space || !externalId || !version) {
      return [];
    }

    try {
      const activities = await fetchActivitiesFromDMS(
        this.connector,
        { space, externalId, version },
        [rangeStart, rangeEnd],
        useScheduledTime,
        cogniteTimeSeries.instanceId
      );
      return activities;
    } catch (e) {
      handleError(e, refId);
      return [];
    }
  }

  async queryByAssets(options: DataQueryRequest<CogniteQuery>): Promise<DataQueryResponse> {
    const results = await Promise.all(
      options.targets.map(async (target) => {
        const { refId, cogniteActivityTabQuery } = target;
        if (!cogniteActivityTabQuery?.assetInstances?.length) {
          return null;
        }
        const { space, externalId, version, resourceType, assetInstances } = cogniteActivityTabQuery;
        const filterPropertyMap: Record<string, string> = {
          CogniteAsset: 'assets',
          CogniteEquipment: 'equipment',
          CogniteTimeSeries: 'timeSeries',
        };
        const filterProperty = filterPropertyMap[resourceType] ?? 'assets';
        try {
          const activities = await fetchActivitiesByAssets(
            this.connector,
            { space, externalId, version },
            assetInstances,
            filterProperty
          );
          const converted = convertActivitiesDateFields(activities);

          // Build lookup: "space:externalId" -> display name (name only, fallback to externalId)
          const instanceNameMap = new Map(
            assetInstances.map((a) => [
              `${a.space}:${a.externalId}`,
              a.name ?? a.externalId,
            ])
          );

          // Column name reflects the resource type
          const resourceColumnNames: Record<string, string> = {
            CogniteAsset: 'asset',
            CogniteEquipment: 'equipment',
            CogniteTimeSeries: 'timeSeries',
          };
          const resourceColName = resourceColumnNames[resourceType] ?? 'Instance';

          const resourceColValues = converted.map((item) => {
            const refs: Array<{ space: string; externalId: string }> =
              (item as any)[filterProperty] ?? [];
            const names = (Array.isArray(refs) ? refs : [refs])
              .map((r) => instanceNameMap.get(`${r.space}:${r.externalId}`))
              .filter((name): name is string => name !== undefined)
              .join(', ');
            return names || null;
          });

          const columns = [
            'externalId', 'space', 'name', 'type', 'description',
            'startTime', 'endTime',
            'scheduledStartTime', 'scheduledEndTime',
            'createdTime', 'lastUpdatedTime',
          ];
          const dataFrame: DataFrame = {
            refId,
            name: 'CogniteActivities',
            fields: [
              ...columns.slice(0, 5).map((col) => ({
                name: col,
                type: FieldType.string,
                config: {},
                values: converted.map((item) => (item as any)[col] ?? null),
              })),
              ...columns.slice(5).map((col) => ({
                name: col,
                type: FieldType.time,
                config: {},
                values: converted.map((item) => (item as any)[col] ?? null),
              })),
              // Dynamic resource column last
              {
                name: resourceColName,
                type: FieldType.string,
                config: {},
                values: resourceColValues,
              },
            ],
            length: converted.length,
          };
          return dataFrame;
        } catch (e) {
          handleError(e, refId);
          return null;
        }
      })
    );
    return { data: results.filter(Boolean) };
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
