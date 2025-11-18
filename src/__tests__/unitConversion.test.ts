import { fetchCogniteUnits, getTimeSeriesUnit, formQueryForItems } from '../cdf/client';
import { Connector } from '../connector';
import { CogniteUnit, DMSInstance } from '../types/dms';
import { HttpMethod } from '../types';

describe('Unit Conversion', () => {
  let mockConnector: jest.Mocked<Connector>;

  beforeEach(() => {
    mockConnector = {
      fetchItems: jest.fn(),
    } as any;
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

      mockConnector.fetchItems.mockResolvedValue(mockInstances);

      const units = await fetchCogniteUnits(mockConnector);

      expect(mockConnector.fetchItems).toHaveBeenCalledWith({
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
          limit: 1000,
          filter: {
            equals: {
              property: ['node', 'space'],
              value: 'cdf_cdm_units',
            },
          },
        },
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
      mockConnector.fetchItems.mockRejectedValue(new Error('API Error'));

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

      mockConnector.fetchItems.mockResolvedValue(mockInstances);

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
    it('should fetch unit from timeseries instance (string format)', async () => {
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

      expect(unit).toBe('temperature:deg_c');
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

    it('should fallback to sourceUnit if unit is not present', async () => {
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

      expect(unit).toBe('temperature:deg_c');
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

  describe('formQueryForItems with targetUnit', () => {
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
        type: 'default' as const,
        target: {
          aggregation: 'average',
          granularity: '1h',
          cogniteTimeSeries: {
            space: 'cdf_cdm',
            version: 'v1',
            externalId: 'CogniteTimeSeries',
            targetUnit: 'temperature:deg_f',
          },
        },
      };

      const queryOptions = {
        range: {
          from: { valueOf: () => 1000 } as any,
          to: { valueOf: () => 2000 } as any,
          raw: { from: 'now-1h', to: 'now' },
        },
        intervalMs: 60000,
        timeZone: 'UTC',
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
        type: 'default' as const,
        target: {
          aggregation: 'average',
          granularity: '1h',
          cogniteTimeSeries: {
            space: 'cdf_cdm',
            version: 'v1',
            externalId: 'CogniteTimeSeries',
          },
        },
      };

      const queryOptions = {
        range: {
          from: { valueOf: () => 1000 } as any,
          to: { valueOf: () => 2000 } as any,
          raw: { from: 'now-1h', to: 'now' },
        },
        intervalMs: 60000,
        timeZone: 'UTC',
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
        type: 'default' as const,
        target: {
          aggregation: 'average',
          granularity: '1h',
          cogniteTimeSeries: {
            space: 'cdf_cdm',
            version: 'v1',
            externalId: 'CogniteTimeSeries',
            targetUnit: 'temperature:deg_f',
          },
        },
      };

      const queryOptions = {
        range: {
          from: { valueOf: () => 1000 } as any,
          to: { valueOf: () => 2000 } as any,
          raw: { from: 'now-1h', to: 'now' },
        },
        intervalMs: 60000,
        timeZone: 'UTC',
      };

      const result = formQueryForItems(queryData, queryOptions);

      expect(result.items[0]).not.toHaveProperty('targetUnit');
    });
  });
});

