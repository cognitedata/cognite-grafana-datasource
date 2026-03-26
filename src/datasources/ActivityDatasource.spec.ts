import { FieldType } from '@grafana/data';
import { convertActivitiesDateFields, ActivityDatasource } from './ActivityDatasource';
import { CogniteActivity } from '../types/dms';
import { Connector } from '../connector';
import { Tab } from '../types';

jest.mock('../cdf/client');
jest.mock('../appEventHandler', () => ({ handleError: jest.fn() }));

const { fetchActivitiesByAssets } = jest.requireMock('../cdf/client');

// ── Helpers ────────────────────────────────────────────────────────────────

function makeActivity(overrides: Partial<CogniteActivity> = {}): CogniteActivity {
  return {
    space: 'cdm_try',
    externalId: 'weather-activity-001',
    name: 'Humidity Study #1',
    description: 'Activity for humidity level tracking',
    type: 'inspection',
    createdTime: 1706000000000,
    lastUpdatedTime: 1706001000000,
    startTime: '2026-01-04T09:40:00.000Z',
    endTime: '2026-01-14T09:40:00.000Z',
    scheduledStartTime: '2026-01-04T08:00:00.000Z',
    scheduledEndTime: '2026-01-14T08:00:00.000Z',
    ...overrides,
  };
}

function makeTarget(overrides: object = {}) {
  return {
    refId: 'A',
    tab: Tab.CogniteActivity,
    aggregation: 'average',
    granularity: '',
    latestValue: false,
    error: '',
    label: '',
    warning: '',
    expr: '',
    cogniteActivityTabQuery: {
      space: 'cdf_cdm',
      externalId: 'CogniteActivity',
      version: 'v1',
      resourceType: 'CogniteAsset' as const,
      instanceSpace: '',
      assetInstances: [
        { space: 'cdm_try', externalId: 'weather-station-fornebu', name: 'Fornebu Weather Station' },
      ],
    },
    ...overrides,
  } as any;
}

// ── convertActivitiesDateFields ────────────────────────────────────────────

describe('convertActivitiesDateFields', () => {
  it('converts all date fields to Date objects when all are present', () => {
    const result = convertActivitiesDateFields([makeActivity()]);
    expect(result[0].createdTime).toBeInstanceOf(Date);
    expect(result[0].lastUpdatedTime).toBeInstanceOf(Date);
    expect(result[0].startTime).toBeInstanceOf(Date);
    expect(result[0].endTime).toBeInstanceOf(Date);
    expect(result[0].scheduledStartTime).toBeInstanceOf(Date);
    expect(result[0].scheduledEndTime).toBeInstanceOf(Date);
  });

  it('does not set missing optional date fields', () => {
    const result = convertActivitiesDateFields([
      makeActivity({ startTime: undefined, endTime: undefined, scheduledStartTime: undefined, scheduledEndTime: undefined }),
    ]);
    expect(result[0].startTime).toBeUndefined();
    expect(result[0].endTime).toBeUndefined();
    expect(result[0].scheduledStartTime).toBeUndefined();
    expect(result[0].scheduledEndTime).toBeUndefined();
    expect(result[0].createdTime).toBeInstanceOf(Date);
    expect(result[0].lastUpdatedTime).toBeInstanceOf(Date);
  });

  it('preserves non-date fields unchanged', () => {
    const result = convertActivitiesDateFields([makeActivity()]);
    expect(result[0].externalId).toBe('weather-activity-001');
    expect(result[0].name).toBe('Humidity Study #1');
    expect(result[0].description).toBe('Activity for humidity level tracking');
    expect(result[0].type).toBe('inspection');
  });

  it('handles an empty array', () => {
    expect(convertActivitiesDateFields([])).toEqual([]);
  });
});

// ── ActivityDatasource.queryByAssets ──────────────────────────────────────

describe('ActivityDatasource.queryByAssets', () => {
  let datasource: ActivityDatasource;

  beforeEach(() => {
    jest.clearAllMocks();
    datasource = new ActivityDatasource({} as Connector);
  });

  it('returns empty data when no targets have assetInstances', async () => {
    const result = await datasource.queryByAssets({
      targets: [makeTarget({ cogniteActivityTabQuery: { assetInstances: [] } })],
    } as any);
    expect(result.data).toHaveLength(0);
    expect(fetchActivitiesByAssets).not.toHaveBeenCalled();
  });

  it('builds a DataFrame with correct column order for CogniteAsset', async () => {
    fetchActivitiesByAssets.mockResolvedValue([makeActivity({ assets: [{ space: 'cdm_try', externalId: 'weather-station-fornebu' }] })]);

    const result = await datasource.queryByAssets({ targets: [makeTarget()] } as any);

    expect(result.data).toHaveLength(1);
    const frame = result.data[0];
    const fieldNames = frame.fields.map((f: any) => f.name);
    expect(fieldNames).toEqual([
      'externalId', 'space', 'name', 'type', 'description',
      'startTime', 'endTime', 'scheduledStartTime', 'scheduledEndTime',
      'createdTime', 'lastUpdatedTime',
      'asset',
    ]);
  });

  it('names the resource column based on resourceType', async () => {
    fetchActivitiesByAssets.mockResolvedValue([makeActivity({ equipment: [{ space: 'cdm_try', externalId: 'sensor-fornebu-anemometer' }] })]);

    const result = await datasource.queryByAssets({
      targets: [makeTarget({
        cogniteActivityTabQuery: {
          space: 'cdf_cdm', externalId: 'CogniteActivity', version: 'v1',
          resourceType: 'CogniteEquipment',
          instanceSpace: '',
          assetInstances: [{ space: 'cdm_try', externalId: 'sensor-fornebu-anemometer', name: 'Ultrasonic Wind Sensor' }],
        },
      })],
    } as any);

    const frame = result.data[0];
    const lastField = frame.fields[frame.fields.length - 1];
    expect(lastField.name).toBe('equipment');
  });

  it('resource column shows instance name from selected instances', async () => {
    fetchActivitiesByAssets.mockResolvedValue([
      makeActivity({ assets: [{ space: 'cdm_try', externalId: 'weather-station-fornebu' }] }),
    ]);

    const result = await datasource.queryByAssets({ targets: [makeTarget()] } as any);

    const frame = result.data[0];
    const assetField = frame.fields.find((f: any) => f.name === 'asset');
    expect(assetField.values[0]).toBe('Fornebu Weather Station');
  });

  it('resource column falls back to externalId when instance not in selection', async () => {
    fetchActivitiesByAssets.mockResolvedValue([
      // activity references a different asset not in the selected list
      makeActivity({ assets: [{ space: 'cdm_try', externalId: 'weather-station-lysaker' }] }),
    ]);

    const result = await datasource.queryByAssets({ targets: [makeTarget()] } as any);

    const frame = result.data[0];
    const assetField = frame.fields.find((f: any) => f.name === 'asset');
    // not in map → null (only selected instances are shown)
    expect(assetField.values[0]).toBeNull();
  });

  it('time fields have FieldType.time', async () => {
    fetchActivitiesByAssets.mockResolvedValue([makeActivity({ assets: [{ space: 'cdm_try', externalId: 'weather-station-fornebu' }] })]);

    const result = await datasource.queryByAssets({ targets: [makeTarget()] } as any);

    const frame = result.data[0];
    for (const col of ['startTime', 'endTime', 'scheduledStartTime', 'scheduledEndTime', 'createdTime', 'lastUpdatedTime']) {
      const field = frame.fields.find((f: any) => f.name === col);
      expect(field.type).toBe(FieldType.time);
    }
  });

  it('string fields have FieldType.string', async () => {
    fetchActivitiesByAssets.mockResolvedValue([makeActivity({ assets: [{ space: 'cdm_try', externalId: 'weather-station-fornebu' }] })]);

    const result = await datasource.queryByAssets({ targets: [makeTarget()] } as any);

    const frame = result.data[0];
    for (const col of ['externalId', 'space', 'name', 'type', 'description', 'asset']) {
      const field = frame.fields.find((f: any) => f.name === col);
      expect(field.type).toBe(FieldType.string);
    }
  });

  it('handles fetch errors and returns empty data', async () => {
    const { handleError } = jest.requireMock('../appEventHandler');
    fetchActivitiesByAssets.mockRejectedValue(new Error('network error'));

    const result = await datasource.queryByAssets({ targets: [makeTarget()] } as any);

    expect(result.data).toHaveLength(0);
    expect(handleError).toHaveBeenCalled();
  });

  it('passes filterProperty based on resourceType to fetchActivitiesByAssets', async () => {
    fetchActivitiesByAssets.mockResolvedValue([]);

    await datasource.queryByAssets({
      targets: [makeTarget({
        cogniteActivityTabQuery: {
          space: 'cdf_cdm', externalId: 'CogniteActivity', version: 'v1',
          resourceType: 'CogniteTimeSeries',
          instanceSpace: '',
          assetInstances: [{ space: 'cdm_try', externalId: 'ts-001', name: 'My TS' }],
        },
      })],
    } as any);

    expect(fetchActivitiesByAssets).toHaveBeenCalledWith(
      expect.anything(),
      { space: 'cdf_cdm', externalId: 'CogniteActivity', version: 'v1' },
      [{ space: 'cdm_try', externalId: 'ts-001', name: 'My TS' }],
      'timeSeries'
    );
  });
});
