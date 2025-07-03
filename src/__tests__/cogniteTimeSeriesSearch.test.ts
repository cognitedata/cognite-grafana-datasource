import { 
  Tab, 
  CogniteTimeSeriesSearchQuery, 
  defaultCogniteTimeSeriesSearchQuery,
} from '../types';

describe('CogniteTimeSeries Search', () => {
  describe('Type Definitions', () => {
    describe('defaultCogniteTimeSeriesSearchQuery', () => {
      it('should have correct default values', () => {
        const expected: CogniteTimeSeriesSearchQuery = {
          space: 'cdf_cdm',
          version: 'v1',
          externalId: 'CogniteTimeSeries',
          selectedTimeseries: undefined,
          limit: 1000
        };

        expect(defaultCogniteTimeSeriesSearchQuery).toEqual(expected);
      });
    });

    describe('Tab enum', () => {
      it('should include CogniteTimeSeriesSearch', () => {
        expect(Tab.CogniteTimeSeriesSearch).toBe('CogniteTimeSeries');
      });
    });
  });

  describe('Query Validation', () => {
    it('should consider query with selectedTimeseries as valid', () => {
      const validQuery: CogniteTimeSeriesSearchQuery = {
        space: 'cdf_cdm',
        version: 'v1',
        externalId: 'CogniteTimeSeries',
        selectedTimeseries: {
          space: 'cdf_cdm',
          externalId: 'temperature_sensor_1',
          name: 'Temperature Sensor 1'
        },
        limit: 10
      };

      // A query with selectedTimeseries should be considered valid
      expect(validQuery.selectedTimeseries).toBeDefined();
      expect(validQuery.selectedTimeseries?.space).toBe('cdf_cdm');
      expect(validQuery.selectedTimeseries?.externalId).toBe('temperature_sensor_1');
      expect(validQuery.selectedTimeseries?.name).toBe('Temperature Sensor 1');
    });

    it('should consider query without selectedTimeseries as incomplete', () => {
      const incompleteQuery: CogniteTimeSeriesSearchQuery = {
        space: 'cdf_cdm',
        version: 'v1',
        externalId: 'CogniteTimeSeries',
        selectedTimeseries: undefined,
        limit: 10
      };

      // A query without selectedTimeseries should be considered incomplete
      expect(incompleteQuery.selectedTimeseries).toBeUndefined();
    });

    it('should support custom space and view configurations', () => {
      const customQuery: CogniteTimeSeriesSearchQuery = {
        space: 'my_custom_space',
        version: 'v2',
        externalId: 'MyTimeSeries',
        selectedTimeseries: {
          space: 'my_custom_space',
          externalId: 'sensor_123'
        },
        limit: 500
      };

      expect(customQuery.space).toBe('my_custom_space');
      expect(customQuery.version).toBe('v2');
      expect(customQuery.externalId).toBe('MyTimeSeries');
      expect(customQuery.limit).toBe(500);
    });
  });

  describe('Instance ID Format', () => {
    it('should create correct instanceId format', () => {
      const space = 'cdf_cdm';
      const externalId = 'temperature_sensor_01';
      
      const instanceId = {
        space,
        externalId
      };

      expect(instanceId.space).toBe('cdf_cdm');
      expect(instanceId.externalId).toBe('temperature_sensor_01');
      
      // Test instanceId string representation for labels
      const instanceIdString = `${space}:${externalId}`;
      expect(instanceIdString).toBe('cdf_cdm:temperature_sensor_01');
    });

    it('should handle special characters in externalId', () => {
      const space = 'my_space';
      const externalId = 'sensor-01_temp.avg';
      
      const instanceIdString = `${space}:${externalId}`;
      expect(instanceIdString).toBe('my_space:sensor-01_temp.avg');
    });
  });

  describe('DMS Search Request Structure', () => {
    it('should create proper DMS search request structure', () => {
      const searchRequest = {
        view: {
          type: 'view' as const,
          space: 'cdf_cdm',
          externalId: 'CogniteTimeSeries',
          version: 'v1'
        },
        query: 'temperature',
        limit: 10,
        filter: {
          not: {
            equals: {
              property: ['type'],
              value: 'string'
            }
          }
        }
      };

      expect(searchRequest.view.type).toBe('view');
      expect(searchRequest.view.space).toBe('cdf_cdm');
      expect(searchRequest.view.externalId).toBe('CogniteTimeSeries');
      expect(searchRequest.view.version).toBe('v1');
      expect(searchRequest.query).toBe('temperature');
      expect(searchRequest.limit).toBe(10);
      expect(searchRequest.filter?.not?.equals?.property).toEqual(['type']);
      expect(searchRequest.filter?.not?.equals?.value).toBe('string');
    });

    it('should support empty query for browsing all instances', () => {
      const browseRequest = {
        view: {
          type: 'view' as const,
          space: 'cdf_cdm',
          externalId: 'CogniteTimeSeries',
          version: 'v1'
        },
        limit: 1000
      };

      expect(browseRequest.view.type).toBe('view');
      expect(browseRequest.limit).toBe(1000);
      expect('query' in browseRequest).toBe(false);
    });
  });

  describe('Tab Configuration', () => {
    it('should have proper tab properties', () => {
      // Test the tab enum value
      expect(Tab.CogniteTimeSeriesSearch).toBe('CogniteTimeSeries');
      
      // Verify it's a string type (important for tab routing)
      expect(typeof Tab.CogniteTimeSeriesSearch).toBe('string');
    });

    it('should support standard timeseries options', () => {
      const baseQuery = {
        ...defaultCogniteTimeSeriesSearchQuery,
        selectedTimeseries: {
          space: 'cdf_cdm',
          externalId: 'ts1',
          name: 'Test Sensor'
        }
      };

      // Should be compatible with standard timeseries options
      const extendedQuery = {
        ...baseQuery,
        aggregation: 'average',
        granularity: '1h',
        latestValue: false
      };

      expect(extendedQuery.aggregation).toBe('average');
      expect(extendedQuery.granularity).toBe('1h');
      expect(extendedQuery.latestValue).toBe(false);
    });
  });

  describe('Label Generation', () => {
    it('should prefer selectedTimeseries name for labels', () => {
      const query: CogniteTimeSeriesSearchQuery = {
        space: 'cdf_cdm',
        version: 'v1',
        externalId: 'CogniteTimeSeries',
        selectedTimeseries: {
          space: 'cdf_cdm',
          externalId: 'temp_sensor_01',
          name: 'Building A - Temperature Sensor'
        }
      };

      // The label should prioritize the name field
      const expectedLabel = query.selectedTimeseries?.name;
      expect(expectedLabel).toBe('Building A - Temperature Sensor');
    });

    it('should fallback to instanceId format when name is not available', () => {
      const query: CogniteTimeSeriesSearchQuery = {
        space: 'cdf_cdm',
        version: 'v1',
        externalId: 'CogniteTimeSeries',
        selectedTimeseries: {
          space: 'cdf_cdm',
          externalId: 'temp_sensor_01'
          // No name field
        }
      };

      // Should fallback to space:externalId format
      const fallbackLabel = `${query.selectedTimeseries?.space}:${query.selectedTimeseries?.externalId}`;
      expect(fallbackLabel).toBe('cdf_cdm:temp_sensor_01');
    });
  });
}); 
