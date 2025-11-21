import { RecordsDatasource } from './RecordsDatasource';
import { Connector } from '../connector';
import { FieldType } from '@grafana/data';

// Mock connector
const mockConnector = {} as Connector;

describe('RecordsDatasource', () => {
  let datasource: RecordsDatasource;

  beforeEach(() => {
    datasource = new RecordsDatasource(mockConnector);
  });

  describe('convertRecordsToDataFrame', () => {
    it('should parse timeHistogramBuckets with direct numeric values correctly', () => {
      const mockApiResponse = {
        aggregates: {
          rate: {
            timeHistogramBuckets: [
              {
                intervalStart: '2025-08-26T12:00:00Z',
                count: 1,
                aggregates: {
                  avgPower: { avg: 0.40799999237060546875 },
                  maxPower: { max: 0.40799999237060547 }
                }
              },
              {
                intervalStart: '2025-08-27T09:00:00Z',
                count: 745,
                aggregates: {
                  avgPower: { avg: 0.70031812014995808990391878978698514401912689208984375 },
                  maxPower: { max: 3.7300000190734863 }
                }
              },
              {
                intervalStart: '2025-08-27T12:00:00Z',
                count: 965,
                aggregates: {
                  avgPower: { avg: 0.76817409297345218277541789575479924678802490234375 },
                  maxPower: { max: 2.940000057220459 }
                }
              }
            ]
          }
        }
      };

      // Call the private method using type assertion
      const result = (datasource as any).convertRecordsToDataFrame(mockApiResponse, 'A');

      // Log basic results for debugging


      // Assertions
      expect(result.name).toBe('Records-A');
      expect(result.fields.length).toBeGreaterThan(1); // Should have more than just the error message
      
      // Check that we have the expected time series fields
      const fieldNames = result.fields.map((f: any) => f.name);
      expect(fieldNames).toContain('rate.time');
      expect(fieldNames).toContain('rate.count');
      expect(fieldNames).toContain('rate.avgPower');
      expect(fieldNames).toContain('rate.maxPower');
      
      // Check time field
      const timeField = result.fields.find((f: any) => f.name === 'rate.time');
      expect(timeField?.type).toBe(FieldType.time);
      expect(timeField?.values.length).toBe(3);
      
      // Check avgPower field
      const avgPowerField = result.fields.find((f: any) => f.name === 'rate.avgPower');
      expect(avgPowerField?.type).toBe(FieldType.number);
      expect(avgPowerField?.values.length).toBe(3);
      expect(avgPowerField?.values[0]).toBeCloseTo(0.408);
      expect(avgPowerField?.values[1]).toBeCloseTo(0.700);
      expect(avgPowerField?.values[2]).toBeCloseTo(0.768);
      
      // Check maxPower field
      const maxPowerField = result.fields.find((f: any) => f.name === 'rate.maxPower');
      expect(maxPowerField?.type).toBe(FieldType.number);
      expect(maxPowerField?.values.length).toBe(3);
      expect(maxPowerField?.values[0]).toBeCloseTo(0.408);
      expect(maxPowerField?.values[1]).toBeCloseTo(3.730);
      expect(maxPowerField?.values[2]).toBeCloseTo(2.940);
    });

    it('should handle full payload from user', () => {
      const fullPayload = {
        aggregates: {
          rate: {
            timeHistogramBuckets: [
              {
                intervalStart: '2025-08-26T12:00:00Z',
                count: 1,
                aggregates: {
                  avgPower: { avg: 0.40799999237060546875 },
                  maxPower: { max: 0.40799999237060547 }
                }
              },
              {
                intervalStart: '2025-08-27T09:00:00Z',
                count: 745,
                aggregates: {
                  avgPower: { avg: 0.70031812014995808990391878978698514401912689208984375 },
                  maxPower: { max: 3.7300000190734863 }
                }
              },
              {
                intervalStart: '2025-08-27T12:00:00Z',
                count: 965,
                aggregates: {
                  avgPower: { avg: 0.76817409297345218277541789575479924678802490234375 },
                  maxPower: { max: 2.940000057220459 }
                }
              },
              {
                intervalStart: '2025-08-27T15:00:00Z',
                count: 962,
                aggregates: {
                  avgPower: { avg: 1.6661424127537098893725442394497804343700408935546875 },
                  maxPower: { max: 6.165999889373779 }
                }
              },
              {
                intervalStart: '2025-08-27T18:00:00Z',
                count: 985,
                aggregates: {
                  avgPower: { avg: 1.555829441849955419030493430909700691699981689453125 },
                  maxPower: { max: 4.914000034332275 }
                }
              },
              {
                intervalStart: '2025-08-27T21:00:00Z',
                count: 1045,
                aggregates: {
                  avgPower: { avg: 7.608140670682825401627269457094371318817138671875 },
                  maxPower: { max: 12.918999671936035 }
                }
              },
              {
                intervalStart: '2025-08-28T00:00:00Z',
                count: 1068,
                aggregates: {
                  avgPower: { avg: 3.574746252110835076365447093849070370197296142578125 },
                  maxPower: { max: 9.699999809265137 }
                }
              },
              {
                intervalStart: '2025-08-28T03:00:00Z',
                count: 982,
                aggregates: {
                  avgPower: { avg: 2.408769855947213045510579831898212432861328125 },
                  maxPower: { max: 10.187000274658203 }
                }
              },
              {
                intervalStart: '2025-08-28T06:00:00Z',
                count: 958,
                aggregates: {
                  avgPower: { avg: 1.0023068910103003492650941552710719406604766845703125 },
                  maxPower: { max: 3.7909998893737793 }
                }
              },
              {
                intervalStart: '2025-08-28T09:00:00Z',
                count: 780,
                aggregates: {
                  avgPower: { avg: 0.97237179619379532358180995288421399891376495361328125 },
                  maxPower: { max: 5.218999862670898 }
                }
              }
            ]
          }
        }
      };

      const result = (datasource as any).convertRecordsToDataFrame(fullPayload, 'A');



      // The test should not result in the "No data found" error
      const errorField = result.fields.find((f: any) => f.name === 'message');
      if (errorField) {
        console.error('ERROR: Still getting fallback message field:', errorField);
      }
      
      expect(result.fields.length).toBeGreaterThan(1);
      expect(result.fields.find((f: any) => f.name === 'message')).toBeUndefined();
    });

    it('should handle HTTP response wrapped payload', () => {
      // Simulate the real API response structure with HTTP wrapper
      const wrappedPayload = {
        status: 200,
        statusText: 'OK',
        ok: true,
        data: {
          aggregates: {
            rate: {
              timeHistogramBuckets: [
                {
                  intervalStart: '2025-08-26T12:00:00Z',
                  count: 1,
                  aggregates: {
                    avgPower: { avg: 0.40799999237060546875 },
                    maxPower: { max: 0.40799999237060547 }
                  }
                }
              ]
            }
          }
        },
        headers: {},
        url: 'http://localhost:2999/api/...',
        type: 'basic',
        redirected: false
      };

      const result = (datasource as any).convertRecordsToDataFrame(wrappedPayload, 'A');



      // Should extract data from the wrapper correctly
      expect(result.fields.length).toBe(4); // time, count, avgPower, maxPower
      expect(result.fields.find((f: any) => f.name === 'rate.avgPower')).toBeDefined();
      expect(result.fields.find((f: any) => f.name === 'rate.maxPower')).toBeDefined();
      expect(result.fields.find((f: any) => f.name === 'message')).toBeUndefined(); // No error message
    });

    it('should handle filter results with timestamp fields correctly', () => {
      const mockFilterResponse = {
        items: [
          {
            createdTime: 1640995200, // 2022-01-01 00:00:00 UTC (in seconds)
            lastUpdatedTime: 1640995200000, // 2022-01-01 00:00:00 UTC (in milliseconds)
            meterModel: 'Model123',
            powerValue: 42.5
          },
          {
            createdTime: 1641081600, // 2022-01-02 00:00:00 UTC (in seconds)
            lastUpdatedTime: 1641081600000, // 2022-01-02 00:00:00 UTC (in milliseconds)
            meterModel: 'Model456',
            powerValue: 55.3
          }
        ]
      };

      const result = (datasource as any).convertRecordsToDataFrame(mockFilterResponse, 'A');

      expect(result.name).toBe('Records-A');
      expect(result.fields).toHaveLength(4);
      expect(result.length).toBe(2);

      // Check field types
      const createdTimeField = result.fields.find((f: any) => f.name === 'createdTime');
      const lastUpdatedTimeField = result.fields.find((f: any) => f.name === 'lastUpdatedTime');
      const meterModelField = result.fields.find((f: any) => f.name === 'meterModel');
      const powerValueField = result.fields.find((f: any) => f.name === 'powerValue');

      expect(createdTimeField?.type).toBe('time');
      expect(lastUpdatedTimeField?.type).toBe('time');
      expect(meterModelField?.type).toBe('string');
      expect(powerValueField?.type).toBe('number');

      // Check timestamp conversion (seconds to milliseconds)
      expect(createdTimeField?.values).toEqual([1640995200000, 1641081600000]);
      // lastUpdatedTime should stay in milliseconds
      expect(lastUpdatedTimeField?.values).toEqual([1640995200000, 1641081600000]);
      
      // Check other values
      expect(meterModelField?.values).toEqual(['Model123', 'Model456']);
      expect(powerValueField?.values).toEqual([42.5, 55.3]);


    });
  });
});
