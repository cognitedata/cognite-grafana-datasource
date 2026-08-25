import {
  fetchCogniteUnits,
  getTimeSeriesUnit,
  getTimeSeriesProperties,
  formQueryForItems,
  getCogniteUnitIndex,
  clearCogniteUnitIndexCache,
  resolveEffectiveUnit,
  getLabelsForTarget,
} from '../cdf/client';
import { Connector } from '../connector';
import { CogniteUnit, DMSInstance } from '../types/dms';
import { HttpMethod, defaultQuery, CogniteQuery, QueryOptions, Tab, QueryTarget } from '../types';
import { dateTime } from '@grafana/data';
import { CacheTime } from '../constants';

const defaultCogniteQuery = defaultQuery as CogniteQuery;

describe('Unit Conversion', () => {
  let mockConnector: jest.Mocked<Connector>;

  beforeEach(() => {
    mockConnector = {
      fetchItems: jest.fn(),
      fetchData: jest.fn(),
      fetchAndPaginate: jest.fn(),
    } as any;
    clearCogniteUnitIndexCache(mockConnector);
  });

  describe('fetchCogniteUnits', () => {
    it('should fetch and map CogniteUnit instances', async () => {
      const mockInstances: DMSInstance[] = [
        {
          instanceType: 'node',
          space: 'cdf_cdm_units',
          externalId: 'temperature:deg_c',
          version: 1,
          lastUpdatedTime: 1234567890,
          createdTime: 1234567890,
          properties: {
            cdf_cdm: {
              'CogniteUnit/v1': {
                name: 'DEG_C',
                description: 'Degree Celsius',
                symbol: '°C',
                quantity: 'Temperature',
                source: 'qudt.org',
                sourceReference: 'https://qudt.org/vocab/unit/DEG_C',
              },
            },
          },
        },
        {
          instanceType: 'node',
          space: 'cdf_cdm_units',
          externalId: 'temperature:deg_f',
          version: 1,
          lastUpdatedTime: 1234567890,
          createdTime: 1234567890,
          properties: {
            cdf_cdm: {
              'CogniteUnit/v1': {
                name: 'DEG_F',
                description: 'Degree Fahrenheit',
                symbol: '°F',
                quantity: 'Temperature',
                source: 'qudt.org',
                sourceReference: 'https://qudt.org/vocab/unit/DEG_F',
              },
            },
          },
        },
      ];

      mockConnector.fetchAndPaginate.mockResolvedValue(mockInstances);

      const units = await fetchCogniteUnits(mockConnector);

      expect(mockConnector.fetchAndPaginate).toHaveBeenCalledWith({
        method: HttpMethod.POST,
        path: '/models/instances/list',
        data: {
          sources: [{
            source: {
              type: 'view',
              space: 'cdf_cdm',
              externalId: 'CogniteUnit',
              version: 'v1',
            },
          }],
          instanceType: 'node',
          limit: 5000,
          filter: {
            equals: {
              property: ['node', 'space'],
              value: 'cdf_cdm_units',
            },
          },
        },
        cacheTime: CacheTime.Units,
      });

      expect(units).toHaveLength(2);
      expect(units[0]).toEqual({
        space: 'cdf_cdm_units',
        externalId: 'temperature:deg_c',
        name: 'DEG_C',
        description: 'Degree Celsius',
        symbol: '°C',
        quantity: 'Temperature',
        source: 'qudt.org',
        sourceReference: 'https://qudt.org/vocab/unit/DEG_C',
      });
    });

    it('should return empty array on error', async () => {
      mockConnector.fetchAndPaginate.mockRejectedValue(new Error('API Error'));

      const units = await fetchCogniteUnits(mockConnector);

      expect(units).toEqual([]);
    });

    it('should handle units without properties', async () => {
      const mockInstances: DMSInstance[] = [
        {
          instanceType: 'node',
          space: 'cdf_cdm_units',
          externalId: 'temperature:deg_c',
          version: 1,
          lastUpdatedTime: 1234567890,
          createdTime: 1234567890,
          properties: {},
        },
      ];

      mockConnector.fetchAndPaginate.mockResolvedValue(mockInstances);

      const units = await fetchCogniteUnits(mockConnector);

      expect(units).toHaveLength(1);
      expect(units[0]).toEqual({
        space: 'cdf_cdm_units',
        externalId: 'temperature:deg_c',
        name: 'temperature:deg_c',
        description: undefined,
        symbol: undefined,
        quantity: undefined,
        source: undefined,
        sourceReference: undefined,
      });
    });
  });

  describe('getTimeSeriesUnit', () => {
    it('does not return a string-typed unit property as storage unit (only direct relation)', async () => {
      const mockInstances: DMSInstance[] = [
        {
          instanceType: 'node',
          space: 'cdm_try',
          externalId: 'test-ts',
          version: 1,
          lastUpdatedTime: 1234567890,
          createdTime: 1234567890,
          properties: {
            cdf_cdm: {
              'CogniteTimeSeries/v1': {
                name: 'Test TS',
                unit: 'temperature:deg_c',
              },
            },
          },
        },
      ];

      mockConnector.fetchItems.mockResolvedValue(mockInstances);

      const unit = await getTimeSeriesUnit(mockConnector, {
        space: 'cdm_try',
        externalId: 'test-ts',
      });

      expect(mockConnector.fetchItems).toHaveBeenCalledWith({
        method: HttpMethod.POST,
        path: '/models/instances/byids',
        data: {
          sources: [{
            source: {
              type: 'view',
              space: 'cdf_cdm',
              externalId: 'CogniteTimeSeries',
              version: 'v1',
            },
          }],
          items: [{
            instanceType: 'node',
            space: 'cdm_try',
            externalId: 'test-ts',
          }],
          includeTyping: false,
        },
      });

      expect(unit).toBeUndefined();
    });

    it('should fetch unit from timeseries instance (object format)', async () => {
      const mockInstances: DMSInstance[] = [
        {
          instanceType: 'node',
          space: 'cdm_try',
          externalId: 'test-ts',
          version: 1,
          lastUpdatedTime: 1234567890,
          createdTime: 1234567890,
          properties: {
            cdf_cdm: {
              'CogniteTimeSeries/v1': {
                name: 'Test TS',
                unit: {
                  space: 'cdf_cdm_units',
                  externalId: 'temperature:deg_c',
                },
              },
            },
          },
        },
      ];

      mockConnector.fetchItems.mockResolvedValue(mockInstances);

      const unit = await getTimeSeriesUnit(mockConnector, {
        space: 'cdm_try',
        externalId: 'test-ts',
      });

      expect(unit).toBe('temperature:deg_c');
    });

    it('does not treat sourceUnit as a resolvable storage unit when structured unit is absent', async () => {
      const mockInstances: DMSInstance[] = [
        {
          instanceType: 'node',
          space: 'cdm_try',
          externalId: 'test-ts',
          version: 1,
          lastUpdatedTime: 1234567890,
          createdTime: 1234567890,
          properties: {
            cdf_cdm: {
              'CogniteTimeSeries/v1': {
                name: 'Test TS',
                sourceUnit: 'temperature:deg_c',
              },
            },
          },
        },
      ];

      mockConnector.fetchItems.mockResolvedValue(mockInstances);

      const unit = await getTimeSeriesUnit(mockConnector, {
        space: 'cdm_try',
        externalId: 'test-ts',
      });

      expect(unit).toBeUndefined();
    });

    it('should return undefined if no unit is found', async () => {
      const mockInstances: DMSInstance[] = [
        {
          instanceType: 'node',
          space: 'cdm_try',
          externalId: 'test-ts',
          version: 1,
          lastUpdatedTime: 1234567890,
          createdTime: 1234567890,
          properties: {
            cdf_cdm: {
              'CogniteTimeSeries/v1': {
                name: 'Test TS',
              },
            },
          },
        },
      ];

      mockConnector.fetchItems.mockResolvedValue(mockInstances);

      const unit = await getTimeSeriesUnit(mockConnector, {
        space: 'cdm_try',
        externalId: 'test-ts',
      });

      expect(unit).toBeUndefined();
    });

    it('should return undefined on error', async () => {
      mockConnector.fetchItems.mockRejectedValue(new Error('API Error'));

      const unit = await getTimeSeriesUnit(mockConnector, {
        space: 'cdm_try',
        externalId: 'test-ts',
      });

      expect(unit).toBeUndefined();
    });
  });

  describe('getTimeSeriesProperties', () => {
    const buildInstance = (props: Record<string, unknown>): DMSInstance[] => [
      {
        instanceType: 'node',
        space: 'cdm_try',
        externalId: 'test-ts',
        version: 1,
        lastUpdatedTime: 1234567890,
        createdTime: 1234567890,
        properties: {
          cdf_cdm: {
            'CogniteTimeSeries/v1': {
              name: 'Test TS',
              ...props,
            },
          },
        },
      },
    ];

    it.each([
      ['numeric'],
      ['string'],
      ['state'],
    ])('returns the %s type from the instance', async (type) => {
      mockConnector.fetchItems.mockResolvedValue(buildInstance({ type }));

      const result = await getTimeSeriesProperties(mockConnector, {
        space: 'cdm_try',
        externalId: 'test-ts',
      });

      expect(result.type).toBe(type);
    });

    it('returns unit and type together in a single fetch', async () => {
      mockConnector.fetchItems.mockResolvedValue(
        buildInstance({
          type: 'numeric',
          unit: { space: 'cdf_cdm_units', externalId: 'temperature:deg_c' },
        })
      );

      const result = await getTimeSeriesProperties(mockConnector, {
        space: 'cdm_try',
        externalId: 'test-ts',
      });

      expect(result).toEqual({ type: 'numeric', unit: 'temperature:deg_c' });
      expect(mockConnector.fetchItems).toHaveBeenCalledTimes(1);
    });

    it('returns empty object on error', async () => {
      mockConnector.fetchItems.mockRejectedValue(new Error('API Error'));

      const result = await getTimeSeriesProperties(mockConnector, {
        space: 'cdm_try',
        externalId: 'test-ts',
      });

      expect(result).toEqual({});
    });
  });

  describe('formQueryForItems with targetUnit', () => {
    const queryOptions: QueryOptions & { timeZone: string } = {
      range: { from: dateTime(1000), to: dateTime(2000) },
      intervalMs: 60000,
      timeZone: 'UTC',
    } as QueryOptions & { timeZone: string };

    it('should add targetUnit to items when specified', () => {
      const queryData = {
        items: [
          {
            instanceId: {
              space: 'cdm_try',
              externalId: 'test-ts',
            },
          },
        ],
        type: 'data' as const,
        target: {
          ...defaultCogniteQuery,
          cogniteTimeSeries: {
            space: 'cdf_cdm',
            version: 'v1',
            externalId: 'CogniteTimeSeries',
            targetUnit: 'temperature:deg_f',
          },
        },
      };

      const result = formQueryForItems(queryData, queryOptions);

      expect(result.items[0]).toHaveProperty('targetUnit', 'temperature:deg_f');
    });

    it('should not add targetUnit when not specified', () => {
      const queryData = {
        items: [
          {
            instanceId: {
              space: 'cdm_try',
              externalId: 'test-ts',
            },
          },
        ],
        type: 'data' as const,
        target: {
          ...defaultCogniteQuery,
          cogniteTimeSeries: {
            space: 'cdf_cdm',
            version: 'v1',
            externalId: 'CogniteTimeSeries',
          },
        },
      };

      const result = formQueryForItems(queryData, queryOptions);

      expect(result.items[0]).not.toHaveProperty('targetUnit');
    });

    it('should not add targetUnit when item has no instanceId', () => {
      const queryData = {
        items: [
          {
            externalId: 'test-ts',
          },
        ],
        type: 'data' as const,
        target: {
          ...defaultCogniteQuery,
          cogniteTimeSeries: {
            space: 'cdf_cdm',
            version: 'v1',
            externalId: 'CogniteTimeSeries',
            targetUnit: 'temperature:deg_f',
          },
        },
      };

      const result = formQueryForItems(queryData, queryOptions);

      expect(result.items[0]).not.toHaveProperty('targetUnit');
    });
  });

  describe('unit index cache', () => {
    const unitInstance = (externalId: string, props: Record<string, any>): DMSInstance => ({
      instanceType: 'node',
      space: 'cdf_cdm_units',
      externalId,
      version: 1,
      lastUpdatedTime: 1,
      createdTime: 1,
      properties: { cdf_cdm: { 'CogniteUnit/v1': props } },
    });

    const catalog = [
      unitInstance('volume_flow_rate:m3-per-hr', {
        name: 'M3_PER_HR',
        description: 'Cubic Meter per Hour',
        symbol: 'm³/h',
        quantity: 'Volume Flow Rate',
      }),
      unitInstance('volume_flow_rate:ft3-per-hr', {
        name: 'FT3_PER_HR',
        description: 'Cubic Foot Per Hour',
        symbol: 'ft³/h',
        quantity: 'Volume Flow Rate',
      }),
    ];

    it('fetches the catalog once per connector and indexes it by externalId', async () => {
      mockConnector.fetchAndPaginate.mockResolvedValue(catalog);

      const [first, second] = await Promise.all([
        getCogniteUnitIndex(mockConnector),
        getCogniteUnitIndex(mockConnector),
      ]);
      const third = await getCogniteUnitIndex(mockConnector);

      expect(mockConnector.fetchAndPaginate).toHaveBeenCalledTimes(1);
      expect(first).toBe(second);
      expect(first).toBe(third);
      expect(first.get('volume_flow_rate:ft3-per-hr')?.symbol).toBe('ft³/h');
    });

    it('does not cache an empty catalog, so a failed fetch is retried', async () => {
      mockConnector.fetchAndPaginate.mockRejectedValueOnce(new Error('API Error'));
      expect((await getCogniteUnitIndex(mockConnector)).size).toBe(0);

      mockConnector.fetchAndPaginate.mockResolvedValue(catalog);
      expect((await getCogniteUnitIndex(mockConnector)).size).toBe(2);
      expect(mockConnector.fetchAndPaginate).toHaveBeenCalledTimes(2);
    });
  });

  describe('resolveEffectiveUnit', () => {
    const catalogUnits: CogniteUnit[] = [
      {
        space: 'cdf_cdm_units',
        externalId: 'volume_flow_rate:m3-per-hr',
        name: 'M3_PER_HR',
        description: 'Cubic Meter per Hour',
        symbol: 'm³/h',
        quantity: 'Volume Flow Rate',
      },
      {
        space: 'cdf_cdm_units',
        externalId: 'volume_flow_rate:ft3-per-hr',
        name: 'FT3_PER_HR',
        description: 'Cubic Foot Per Hour',
        symbol: 'ft³/h',
        quantity: 'Volume Flow Rate',
      },
    ];

    beforeEach(() => {
      mockConnector.fetchAndPaginate.mockResolvedValue(
        catalogUnits.map(({ space, externalId, ...props }) => ({
          instanceType: 'node',
          space,
          externalId,
          version: 1,
          lastUpdatedTime: 1,
          createdTime: 1,
          properties: { cdf_cdm: { 'CogniteUnit/v1': props } },
        })) as DMSInstance[]
      );
    });

    const storageUnit = { space: 'cdf_cdm_units', externalId: 'volume_flow_rate:m3-per-hr' };

    it('prefers the target unit over the storage unit', async () => {
      const unit = await resolveEffectiveUnit(
        mockConnector,
        storageUnit,
        'volume_flow_rate:ft3-per-hr'
      );
      expect(unit?.symbol).toBe('ft³/h');
    });

    it('falls back to the storage unit when no target unit is set', async () => {
      const unit = await resolveEffectiveUnit(mockConnector, storageUnit, undefined);
      expect(unit?.symbol).toBe('m³/h');
    });

    it('returns undefined when there is neither a storage nor a target unit', async () => {
      expect(await resolveEffectiveUnit(mockConnector, undefined, undefined)).toBeUndefined();
      expect(await resolveEffectiveUnit(mockConnector, 'deg_c', undefined)).toBeUndefined();
      expect(mockConnector.fetchAndPaginate).not.toHaveBeenCalled();
    });

    it('falls back to the identifier when the unit is not in the catalog', async () => {
      const unit = await resolveEffectiveUnit(mockConnector, storageUnit, 'custom:unknown');
      expect(unit).toEqual({
        space: 'cdf_cdm_units',
        externalId: 'custom:unknown',
        name: 'custom:unknown',
      });
    });
  });

  describe('getLabelsForTarget with unit tokens', () => {
    const target = (label: string, targetUnit?: string): QueryTarget =>
      ({
        ...defaultCogniteQuery,
        tab: Tab.CogniteTimeSeriesSearch,
        label,
        cogniteTimeSeries: {
          space: 'cdf_cdm',
          version: 'v1',
          externalId: 'CogniteTimeSeries',
          instanceId: { space: 'my_space', externalId: 'TS_40_FT_201_PV' },
          targetUnit,
        },
      }) as QueryTarget;

    beforeEach(() => {
      mockConnector.fetchItems.mockResolvedValue([
        {
          instanceType: 'node',
          space: 'my_space',
          externalId: 'TS_40_FT_201_PV',
          properties: {
            cdf_cdm: {
              'CogniteTimeSeries/v1': {
                name: '40-FT-201-PV',
                unit: { space: 'cdf_cdm_units', externalId: 'volume_flow_rate:m3-per-hr' },
              },
            },
          },
        },
      ]);
      mockConnector.fetchAndPaginate.mockResolvedValue([
        {
          instanceType: 'node',
          space: 'cdf_cdm_units',
          externalId: 'volume_flow_rate:ft3-per-hr',
          properties: {
            cdf_cdm: {
              'CogniteUnit/v1': {
                name: 'FT3_PER_HR',
                description: 'Cubic Foot Per Hour',
                symbol: 'ft³/h',
                quantity: 'Volume Flow Rate',
              },
            },
          },
        },
        {
          instanceType: 'node',
          space: 'cdf_cdm_units',
          externalId: 'volume_flow_rate:m3-per-hr',
          properties: {
            cdf_cdm: {
              'CogniteUnit/v1': {
                name: 'M3_PER_HR',
                description: 'Cubic Meter per Hour',
                symbol: 'm³/h',
                quantity: 'Volume Flow Rate',
              },
            },
          },
        },
      ]);
      mockConnector.fetchData.mockResolvedValue({
        data: { items: [{ properties: { name: {}, unit: {}, description: {} } }] },
      } as any);
    });

    it('resolves {{unit.symbol}} to the target unit', async () => {
      const labels = await getLabelsForTarget(
        target('{{name}} - {{unit.symbol}}', 'volume_flow_rate:ft3-per-hr'),
        [],
        mockConnector
      );
      expect(labels).toEqual(['40-FT-201-PV - ft³/h']);
    });

    it('resolves {{unit.symbol}} to the storage unit when no target unit is set', async () => {
      const labels = await getLabelsForTarget(
        target('{{name}} - {{unit.symbol}}'),
        [],
        mockConnector
      );
      expect(labels).toEqual(['40-FT-201-PV - m³/h']);
    });

    it('serializes a bare {{unit}} as the resolved target unit, not the storage relation', async () => {
      const labels = await getLabelsForTarget(
        target('{{unit}}', 'volume_flow_rate:ft3-per-hr'),
        [],
        mockConnector
      );
      expect(labels).toEqual([
        JSON.stringify({
          space: 'cdf_cdm_units',
          externalId: 'volume_flow_rate:ft3-per-hr',
          name: 'FT3_PER_HR',
          description: 'Cubic Foot Per Hour',
          symbol: 'ft³/h',
          quantity: 'Volume Flow Rate',
        }),
      ]);
    });

    it('serializes a bare {{unit}} as the storage unit when no conversion is set', async () => {
      const labels = await getLabelsForTarget(target('{{unit}}'), [], mockConnector);
      expect(labels).toEqual([
        JSON.stringify({
          space: 'cdf_cdm_units',
          externalId: 'volume_flow_rate:m3-per-hr',
          name: 'M3_PER_HR',
          description: 'Cubic Meter per Hour',
          symbol: 'm³/h',
          quantity: 'Volume Flow Rate',
        }),
      ]);
    });

    it('skips the unit lookup when the label has no unit token', async () => {
      const labels = await getLabelsForTarget(target('{{name}}'), [], mockConnector);

      expect(labels).toEqual(['40-FT-201-PV']);
      expect(mockConnector.fetchAndPaginate).not.toHaveBeenCalled();
    });
  });
});
