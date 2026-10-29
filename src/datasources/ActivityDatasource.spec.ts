import { FieldType } from '@grafana/data';
import { convertActivitiesDateFields, ActivityDatasource } from './ActivityDatasource';
import { CogniteActivity } from '../types/dms';
import { Connector } from '../connector';
import { Tab } from '../types';

jest.mock('../cdf/client');
jest.mock('../appEventHandler', () => ({ handleError: jest.fn() }));

const { fetchActivitiesByAssets, fetchDMSView } = jest.requireMock('../cdf/client');

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

// Wide range covering all test activity timestamps (Jan 2026)
const defaultRange = {
  from: { valueOf: () => new Date('2024-01-01').getTime() },
  to: { valueOf: () => new Date('2027-01-01').getTime() },
};

function makeOptions(targets: any[], range = defaultRange) {
  return { targets, range } as any;
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
      columns: ['externalId', 'space', 'name', 'type', 'description', 'startTime', 'endTime', 'scheduledStartTime', 'scheduledEndTime', 'createdTime', 'lastUpdatedTime'],
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
    const result = await datasource.queryByAssets(
      makeOptions([makeTarget({ cogniteActivityTabQuery: { assetInstances: [] } })])
    );
    expect(result.data).toHaveLength(0);
    expect(fetchActivitiesByAssets).not.toHaveBeenCalled();
  });

  it('builds a DataFrame with correct column order for CogniteAsset', async () => {
    fetchActivitiesByAssets.mockResolvedValue([makeActivity({ assets: [{ space: 'cdm_try', externalId: 'weather-station-fornebu' }] })]);

    const result = await datasource.queryByAssets(makeOptions([makeTarget()]));

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

    const result = await datasource.queryByAssets(makeOptions([makeTarget({
      cogniteActivityTabQuery: {
        space: 'cdf_cdm', externalId: 'CogniteActivity', version: 'v1',
        resourceType: 'CogniteEquipment',
        instanceSpace: '',
        assetInstances: [{ space: 'cdm_try', externalId: 'sensor-fornebu-anemometer', name: 'Ultrasonic Wind Sensor' }],
        columns: ['externalId', 'description'],
      },
    })]));

    const frame = result.data[0];
    const lastField = frame.fields[frame.fields.length - 1];
    expect(lastField.name).toBe('equipment');
  });

  it('resource column shows instance name from selected instances', async () => {
    fetchActivitiesByAssets.mockResolvedValue([
      makeActivity({ assets: [{ space: 'cdm_try', externalId: 'weather-station-fornebu' }] }),
    ]);

    const result = await datasource.queryByAssets(makeOptions([makeTarget()]));

    const frame = result.data[0];
    const assetField = frame.fields.find((f: any) => f.name === 'asset');
    expect(assetField.values[0]).toBe('Fornebu Weather Station');
  });

  it('resource column falls back to externalId when instance not in selection', async () => {
    fetchActivitiesByAssets.mockResolvedValue([
      // activity references a different asset not in the selected list
      makeActivity({ assets: [{ space: 'cdm_try', externalId: 'weather-station-lysaker' }] }),
    ]);

    const result = await datasource.queryByAssets(makeOptions([makeTarget()]));

    const frame = result.data[0];
    const assetField = frame.fields.find((f: any) => f.name === 'asset');
    // not in map → null (only selected instances are shown)
    expect(assetField.values[0]).toBeNull();
  });

  it('time fields have FieldType.time', async () => {
    fetchActivitiesByAssets.mockResolvedValue([makeActivity({ assets: [{ space: 'cdm_try', externalId: 'weather-station-fornebu' }] })]);

    const result = await datasource.queryByAssets(makeOptions([makeTarget()]));

    const frame = result.data[0];
    for (const col of ['startTime', 'endTime', 'scheduledStartTime', 'scheduledEndTime', 'createdTime', 'lastUpdatedTime']) {
      const field = frame.fields.find((f: any) => f.name === col);
      expect(field.type).toBe(FieldType.time);
    }
  });

  it('string fields have FieldType.string', async () => {
    fetchActivitiesByAssets.mockResolvedValue([makeActivity({ assets: [{ space: 'cdm_try', externalId: 'weather-station-fornebu' }] })]);

    const result = await datasource.queryByAssets(makeOptions([makeTarget()]));

    const frame = result.data[0];
    for (const col of ['externalId', 'space', 'name', 'type', 'description', 'asset']) {
      const field = frame.fields.find((f: any) => f.name === col);
      expect(field.type).toBe(FieldType.string);
    }
  });

  it('handles fetch errors and returns empty data', async () => {
    const { handleError } = jest.requireMock('../appEventHandler');
    fetchActivitiesByAssets.mockRejectedValue(new Error('network error'));

    const result = await datasource.queryByAssets(makeOptions([makeTarget()]));

    expect(result.data).toHaveLength(0);
    expect(handleError).toHaveBeenCalled();
  });

  it('passes filterProperty based on resourceType to fetchActivitiesByAssets', async () => {
    fetchActivitiesByAssets.mockResolvedValue([]);

    await datasource.queryByAssets(makeOptions([makeTarget({
      cogniteActivityTabQuery: {
        space: 'cdf_cdm', externalId: 'CogniteActivity', version: 'v1',
        resourceType: 'CogniteTimeSeries',
        instanceSpace: '',
        assetInstances: [{ space: 'cdm_try', externalId: 'ts-001', name: 'My TS' }],
        columns: ['externalId'],
      },
    })]));

    expect(fetchActivitiesByAssets).toHaveBeenCalledWith(
      expect.anything(),
      { space: 'cdf_cdm', externalId: 'CogniteActivity', version: 'v1' },
      [{ space: 'cdm_try', externalId: 'ts-001', name: 'My TS' }],
      'timeSeries'
    );
  });
});

describe('queryByAssets: every property', () => {
  const emptyColumnsTarget = (columns?: string[]) =>
    makeTarget({
      cogniteActivityTabQuery: {
        space: 'cdf_cdm', externalId: 'CogniteActivity', version: 'v1',
        resourceType: 'CogniteAsset', instanceSpace: '',
        assetInstances: [{ space: 'cdm_try', externalId: 'weather-station-fornebu', name: 'Fornebu' }],
        ...(columns ? { columns } : {}),
      },
    });

  const prop = (type: string, list = false) => ({ type: { type, list } });

  it('shows every view property in the view order, then the instance properties', async () => {
    fetchActivitiesByAssets.mockResolvedValue([makeActivity({ assets: [{ space: 'cdm_try', externalId: 'weather-station-fornebu' }] })]);
    fetchDMSView.mockResolvedValue({
      properties: { name: prop('text'), description: prop('text'), startTime: prop('timestamp'), endTime: prop('timestamp'), tags: prop('text', true) },
    });
    const datasource = new ActivityDatasource({} as Connector);
    const result = await datasource.queryByAssets(makeOptions([emptyColumnsTarget(['*'])]));
    expect(result.data[0].fields.map((field: any) => field.name)).toEqual([
      'name', 'description', 'startTime', 'endTime', 'tags',
      'space', 'externalId', 'createdTime', 'lastUpdatedTime',
      'asset',
    ]);
  });

  it('leaves the relations out, so the related instances column is the only one by its name', async () => {
    fetchActivitiesByAssets.mockResolvedValue([makeActivity({ equipment: [{ space: 'cdm_try', externalId: 'sensor-1' }] })]);
    fetchDMSView.mockResolvedValue({
      properties: { name: prop('text'), equipment: prop('direct', true), source: prop('direct') },
    });
    const datasource = new ActivityDatasource({} as Connector);
    const target = emptyColumnsTarget(['*']);
    target.cogniteActivityTabQuery.resourceType = 'CogniteEquipment';
    const result = await datasource.queryByAssets(makeOptions([target]));
    const names = result.data[0].fields.map((field: any) => field.name);
    expect(names.filter((name: string) => name === 'equipment')).toHaveLength(1);
    expect(names).not.toContain('source');
  });

  it('leaves out edges and reverse relations, which never come back with the activities', async () => {
    fetchActivitiesByAssets.mockResolvedValue([makeActivity()]);
    fetchDMSView.mockResolvedValue({
      properties: {
        name: prop('text'),
        steps: { type: { space: 'my_space', externalId: 'Activity.steps' }, connectionType: 'edge' },
        orders: { connectionType: 'multi_reverse_direct_relation', through: { identifier: 'activity' } },
      },
    });
    const datasource = new ActivityDatasource({} as Connector);
    const result = await datasource.queryByAssets(makeOptions([emptyColumnsTarget(['*'])]));
    const names = result.data[0].fields.map((field: any) => field.name);
    expect(names).toContain('name');
    expect(names).not.toContain('steps');
    expect(names).not.toContain('orders');
  });

  it('writes list and object values as JSON text', async () => {
    fetchActivitiesByAssets.mockResolvedValue([makeActivity({ tags: ['a', 'b'] })]);
    const datasource = new ActivityDatasource({} as Connector);
    const result = await datasource.queryByAssets(makeOptions([emptyColumnsTarget(['tags'])]));
    expect(result.data[0].fields[0].values).toEqual(['["a","b"]']);
  });

  it('keeps an empty list meaning the related instances only, as it always did', async () => {
    fetchActivitiesByAssets.mockResolvedValue([makeActivity()]);
    const datasource = new ActivityDatasource({} as Connector);
    const result = await datasource.queryByAssets(makeOptions([emptyColumnsTarget([])]));
    expect(result.data[0].fields.map((field: any) => field.name)).toEqual(['asset']);
  });

  it('falls back to the properties the activities carry when the view cannot be read', async () => {
    fetchActivitiesByAssets.mockResolvedValue([
      makeActivity({
        version: 3,
        scheduledStartTime: undefined,
        tags: ['a'],
        assets: [{ space: 'cdm_try', externalId: 'weather-station-fornebu' }],
      }),
    ]);
    fetchDMSView.mockResolvedValue(null);
    const datasource = new ActivityDatasource({} as Connector);
    const result = await datasource.queryByAssets(makeOptions([emptyColumnsTarget(['*'])]));
    const names = result.data[0].fields.map((field: any) => field.name);
    expect(names.slice(0, 2)).toEqual(['name', 'description']);
    // Neither the instance version nor a property no activity has.
    expect(names).not.toContain('version');
    expect(names).not.toContain('scheduledStartTime');
    // Lists and objects are kept, as with the view; relations are not.
    expect(names).toContain('tags');
    expect(names.filter((name: string) => name === 'asset' || name === 'assets')).toEqual(['asset']);
    expect(names.slice(-5)).toEqual(['space', 'externalId', 'createdTime', 'lastUpdatedTime', 'asset']);
  });

  it('keeps the columns a query saved before they could be chosen always showed', async () => {
    fetchActivitiesByAssets.mockResolvedValue([makeActivity()]);
    const datasource = new ActivityDatasource({} as Connector);
    const result = await datasource.queryByAssets(makeOptions([emptyColumnsTarget()]));
    expect(result.data[0].fields.map((field: any) => field.name)).toEqual([
      'externalId', 'description', 'startTime', 'endTime', 'asset',
    ]);
  });
});
