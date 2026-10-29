import { DataQueryRequest, DataQueryResponse, DataFrame, FieldType, DataTopic } from '@grafana/data';
import {
  CogniteQuery,
  CogniteActivityQuery,
  HttpMethod,
  Tuple,
  ActivitySortProp,
  ALL_ACTIVITY_COLUMNS,
  LEGACY_ACTIVITY_COLUMNS,
} from '../types';
import { Connector } from '../connector';
import { getRange } from '../utils';
import { CogniteActivity, DMSViewWithProperties } from '../types/dms';
import { fetchActivitiesFromDMS, fetchActivitiesByAssets, fetchDMSView } from '../cdf/client';
import { INSTANCE_PROPERTIES } from '../cdf/instanceProperties';
import { handleError } from '../appEventHandler';

function inferFieldType(values: any[]): FieldType {
  const first = values.find((v) => v !== null && v !== undefined);
  if (first instanceof Date) {
    return FieldType.time;
  }
  if (typeof first === 'number') {
    return FieldType.number;
  }
  if (typeof first === 'boolean') {
    return FieldType.boolean;
  }
  return FieldType.string;
}

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

/** Mapped by the activity fetch but not a property: the instance's version. */
const NOT_A_COLUMN = new Set(['version']);

/** A direct relation's value: a reference, or a list of them. */
const isReference = (value: unknown): boolean =>
  Array.isArray(value)
    ? value.length > 0 && value.every(isReference)
    : typeof value === 'object' && value !== null && 'space' in value && 'externalId' in value;

/**
 * The columns "every property" shows: the view's properties in the view's order, then
 * the instance properties. Relations are left out: the column of related instances
 * names them, and their values are references, not text. Edges and reverse relations,
 * which carry no stored type, are never returned with the activities. Without the
 * view, the properties the activities actually carry.
 */
export function allActivityColumns(view: DMSViewWithProperties | null, activities: CogniteActivity[]): string[] {
  const instanceProps = INSTANCE_PROPERTIES.map(({ name }) => name);
  const viewProps = view?.properties
    ? Object.entries(view.properties)
        .filter(([, def]) => typeof def.type?.type === 'string' && def.type.type !== 'direct')
        .map(([name]) => name)
    : [
        ...new Set(
          activities.flatMap((activity) =>
            Object.entries(activity)
              .filter(([, value]) => value !== undefined && value !== null && !isReference(value))
              .map(([name]) => name)
          )
        ),
      ].filter((name) => !instanceProps.includes(name) && !NOT_A_COLUMN.has(name));
  return [...viewProps, ...instanceProps.filter((name) => !viewProps.includes(name))];
}

/** A cell value: lists and objects (a json property, say) as JSON, so they read as text. */
const cellValue = (value: unknown) =>
  value !== null && typeof value === 'object' && !(value instanceof Date) ? JSON.stringify(value) : value ?? null;

const sortActivities = (activities: CogniteActivity[], sort: ActivitySortProp[]): CogniteActivity[] => {
  return [...activities].sort((a, b) => {
    for (const { property, order } of sort) {
      const aVal = (a as any)[property];
      const bVal = (b as any)[property];
      if (aVal === bVal) {
        continue;
      }
      if (aVal === null || aVal === undefined) {
        return 1;
      }
      if (bVal === null || bVal === undefined) {
        return -1;
      }
      const cmp = aVal < bVal ? -1 : 1;
      return order === 'desc' ? -cmp : cmp;
    }
    return 0;
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
    const [rangeStart, rangeEnd] = getRange(options.range);
    const results = await Promise.all(
      options.targets.map(async (target) => {
        const { refId, cogniteActivityTabQuery } = target;
        if (!cogniteActivityTabQuery?.assetInstances?.length) {
          return null;
        }
        const {
          space, externalId, version, resourceType, assetInstances,
          activeOnly = true,
          // A query saved before columns could be chosen keeps the ones it always showed.
          columns = LEGACY_ACTIVITY_COLUMNS,
          sort = [],
        } = cogniteActivityTabQuery;
        const filterPropertyMap: Record<string, string> = {
          CogniteAsset: 'assets',
          CogniteEquipment: 'equipment',
          CogniteTimeSeries: 'timeSeries',
        };
        const filterProperty = filterPropertyMap[resourceType] ?? 'assets';
        const allColumns = columns.includes(ALL_ACTIVITY_COLUMNS);
        try {
          // The view, for "every property", is read alongside the activities.
          const [fetched, view] = await Promise.all([
            fetchActivitiesByAssets(this.connector, { space, externalId, version }, assetInstances, filterProperty),
            allColumns ? fetchDMSView(this.connector, { space, externalId, version }) : Promise.resolve(null),
          ]);
          let activities = fetched;

          // Active only: keep activities that overlap [rangeStart, rangeEnd]
          if (activeOnly) {
            activities = activities.filter((a) => {
              const start = a.startTime ? new Date(a.startTime).getTime() : null;
              const end = a.endTime ? new Date(a.endTime).getTime() : null;
              if (start === null) {
                return false;
              }
              // Activity starts before range ends, and either has no end or ends after range starts
              return start <= rangeEnd && (end === null || end >= rangeStart);
            });
          }

          // Client-side sort
          if (sort.length > 0) {
            activities = sortActivities(activities, sort);
          }

          const converted = convertActivitiesDateFields(activities);
          const selectedColumns = allColumns ? allActivityColumns(view, activities) : columns;

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

          const dataFrame: DataFrame = {
            refId,
            name: 'CogniteActivities',
            fields: [
              ...selectedColumns.map((col) => {
                const values = converted.map((item) => cellValue((item as any)[col]));
                return {
                  name: col,
                  type: inferFieldType(values),
                  config: {},
                  values,
                };
              }),
              // Dynamic resource column always last
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
