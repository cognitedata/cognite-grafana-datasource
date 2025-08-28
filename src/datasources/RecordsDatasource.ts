import { DataQueryRequest, DataQueryResponse, DataFrame, FieldType } from '@grafana/data';
import { CogniteQuery, HttpMethod, Tuple } from '../types';
import { Connector } from '../connector';
import { getRange, toGranularityWithLowerBound } from '../utils';
import { fetchStreamRecordsAggregate, StreamRecordsAggregateRequest, StreamRecordsAggregateResponse } from '../cdf/client';
import { handleError } from '../appEventHandler';

export class RecordsDatasource {
  constructor(private connector: Connector) {}

  async query(options: DataQueryRequest<CogniteQuery>): Promise<DataQueryResponse> {
    console.log('RecordsDatasource.query called with targets:', options.targets.length);
    const timeRange = getRange(options.range);
    const recordResults = await this.fetchRecordTargets(options.targets, timeRange, options);
    console.log('RecordsDatasource query results:', recordResults.length);
    return { data: recordResults };
  }

  async fetchRecordTargets(targets: CogniteQuery[], timeRange: Tuple<number>, options: DataQueryRequest<CogniteQuery>): Promise<DataFrame[]> {
    return Promise.all(
      targets.map(async (target) => {
        try {
          const resultData = await this.fetchRecordsForTarget(target, timeRange, options);
          return this.convertRecordsToDataFrame(resultData, target.refId);
        } catch (error) {
          console.error('Error processing Records target:', target.refId, error);
          
          // Extract a meaningful error message from the API response
          let errorMessage = 'Unknown error occurred';
          
          if (error && typeof error === 'object') {
            if (error.data && error.data.error && error.data.error.message) {
              errorMessage = error.data.error.message;
            } else if (error.message) {
              errorMessage = error.message;
            } else if (error.statusText) {
              errorMessage = `${error.status}: ${error.statusText}`;
            }
          } else if (typeof error === 'string') {
            errorMessage = error;
          }
          
          // Use Grafana's error handling to display the error in the UI
          handleError(new Error(errorMessage), target.refId);
          
          // Return an empty DataFrame so the query doesn't completely fail
          return {
            name: `Records-${target.refId}`,
            fields: [],
            length: 0,
          };
        }
      })
    );
  }

  async fetchRecordsForTarget(
    target: CogniteQuery,
    [rangeStart, rangeEnd]: Tuple<number>,
    options: DataQueryRequest<CogniteQuery>
  ): Promise<StreamRecordsAggregateResponse> {
    const { refId, recordsQuery } = target;
    
    console.log('fetchRecordsForTarget called for target:', refId, 'recordsQuery:', recordsQuery);
    console.log('Time range:', rangeStart, 'to', rangeEnd, 'interval:', options.intervalMs);
    
    console.log('=== DEBUGGING API RESPONSE ===');
    
    if (!recordsQuery?.streamId) {
      console.warn('No streamId provided for Records query');
      throw new Error('Please select a stream to query records');
    }

    try {
      // Parse JSON query - template variables should already be replaced by now
      let aggregateRequest: StreamRecordsAggregateRequest;
      
      if (recordsQuery.jsonQuery && recordsQuery.jsonQuery.trim()) {
        try {
          // The jsonQuery should already have template variables replaced by replaceVariablesInTarget
          aggregateRequest = JSON.parse(recordsQuery.jsonQuery);
          console.log('Using JSON query (variables should be replaced):', aggregateRequest);
        } catch (parseError) {
          throw new Error(`Invalid JSON query: ${parseError.message}`);
        }
      } else {
        // This shouldn't happen since validation should prevent execution without jsonQuery
        throw new Error('JSON query is required for Records aggregation');
      }

      console.log('Making streams aggregate request to:', recordsQuery.streamId);
      const result = await fetchStreamRecordsAggregate(
        this.connector,
        recordsQuery.streamId,
        aggregateRequest
      );
      
      console.log('RAW API Response size:', JSON.stringify(result).length, 'characters');
      console.log('API Response structure check:');
      const actualData = (result as any)?.data || result;
      console.log('- Response type:', typeof result);
      console.log('- Has data property:', !!(result as any)?.data);
      console.log('- Actual data has aggregates:', !!actualData?.aggregates);
      console.log('- Aggregates keys:', actualData?.aggregates ? Object.keys(actualData.aggregates) : 'NONE');
      console.log('- Has timeHistogramBuckets:', !!actualData?.aggregates?.rate?.timeHistogramBuckets);
      console.log('- Buckets count:', actualData?.aggregates?.rate?.timeHistogramBuckets?.length);
      console.log('=== END API RESPONSE DEBUG ===');
      
      return result;
    } catch (e) {
      console.error('Error in fetchRecordsForTarget:', e);
      throw e; // Re-throw to be caught by fetchRecordTargets
    }
  }

  private convertRecordsToDataFrame(data: StreamRecordsAggregateResponse, refId: string): DataFrame {
    console.log('convertRecordsToDataFrame called with data:', data, 'refId:', refId);
    const fields = [];
    const values = [];

    // Handle different types of aggregate results
    // API response might be wrapped in an HTTP response object with data property
    const actualData = (data as any)?.data || data;
    
    if (actualData && actualData.aggregates) {
      console.log('Processing aggregates:', Object.keys(actualData.aggregates));
      this.processAggregateResults(actualData.aggregates, '', fields, values);
      console.log('After processing aggregates, fields created:', fields.length);
    } else {
      console.warn('No aggregates found in data. Full structure:', data);
      console.warn('Actual data extracted:', actualData);
    }

    // If no data was processed, create empty fields
    if (fields.length === 0) {
      console.warn('No fields were created from the response data');
      fields.push({
        name: 'message',
        type: FieldType.string,
        values: ['No data found or unsupported aggregate format'],
        config: {},
      });
    }

    const dataFrame: DataFrame = {
      name: `Records-${refId}`,
      fields,
      length: Math.max(...fields.map(f => f.values.length), 1),
    };
    
    console.log('Created DataFrame:', dataFrame);
    return dataFrame;
  }

  private processAggregateResults(
    aggregates: any,
    prefix: string,
    fields: any[],
    values: any[]
  ): void {
    console.log('processAggregateResults called with aggregates keys:', Object.keys(aggregates), 'prefix:', prefix);
    
    for (const [key, value] of Object.entries(aggregates)) {
      const fieldName = prefix ? `${prefix}.${key}` : key;
      console.log(`Processing aggregate key: ${key}, fieldName: ${fieldName}, value type:`, typeof value);
      
      if (value && typeof value === 'object') {
        // Handle timeHistogramBuckets (time series data)
        if (Array.isArray((value as any).timeHistogramBuckets)) {
          console.log(`Found timeHistogramBuckets for ${key}, buckets count:`, (value as any).timeHistogramBuckets.length);
          this.processTimeHistogramBuckets((value as any).timeHistogramBuckets, fieldName, fields);
        }
        // Handle uniqueValueBuckets
        else if (Array.isArray((value as any).uniqueValueBuckets)) {
          console.log(`Found uniqueValueBuckets for ${key}, buckets count:`, (value as any).uniqueValueBuckets.length);
          this.processUniqueValueBuckets((value as any).uniqueValueBuckets, fieldName, fields);
        }
        // Handle nested aggregates
        else if ((value as any).aggregates) {
          console.log(`Found nested aggregates for ${key}`);
          this.processAggregateResults((value as any).aggregates, fieldName, fields, values);
        }
        // Handle simple aggregate values (avg, min, max, etc.)
        else {
          console.log(`Processing simple aggregate values for ${key}:`, Object.keys(value));
          for (const [subKey, subValue] of Object.entries(value)) {
            if (typeof subValue === 'number') {
              fields.push({
                name: `${fieldName}.${subKey}`,
                type: FieldType.number,
                values: [subValue],
                config: {},
              });
            } else if (typeof subValue === 'string') {
              fields.push({
                name: `${fieldName}.${subKey}`,
                type: FieldType.string,
                values: [subValue],
                config: {},
              });
            }
          }
        }
      } else if (typeof value === 'number') {
        console.log(`Adding direct numeric field: ${fieldName} = ${value}`);
        fields.push({
          name: fieldName,
          type: FieldType.number,
          values: [value],
          config: {},
        });
      } else if (typeof value === 'string') {
        console.log(`Adding direct string field: ${fieldName} = ${value}`);
        fields.push({
          name: fieldName,
          type: FieldType.string,
          values: [value],
          config: {},
        });
      }
    }
  }

  private processTimeHistogramBuckets(buckets: any[], fieldName: string, fields: any[]): void {
    console.log('Processing timeHistogramBuckets:', buckets.length, 'buckets for field:', fieldName);
    
    const timeField = {
      name: `${fieldName}.time`,
      type: FieldType.time,
      values: [],
      config: {},
    };

    const countField = {
      name: `${fieldName}.count`,
      type: FieldType.number,
      values: [],
      config: {},
    };

    // Process each bucket
    const aggregateFields: { [key: string]: any } = {};

    buckets.forEach(bucket => {
      timeField.values.push(new Date((bucket as any).intervalStart).getTime());
      countField.values.push((bucket as any).count || 0);

      // Process nested aggregates in each bucket
      if ((bucket as any).aggregates) {
        for (const [aggKey, aggValue] of Object.entries((bucket as any).aggregates)) {
          if (!aggregateFields[aggKey]) {
            aggregateFields[aggKey] = {
              name: `${fieldName}.${aggKey}`,
              type: FieldType.number,
              values: [],
              config: {},
            };
          }
          
          // Extract the numeric value from aggregate result
          let numericValue = 0;
          if (aggValue && typeof aggValue === 'object') {
            const firstValue = Object.values(aggValue)[0];
            
            // Handle direct numeric value like { avg: 1.23 } or { max: 3.73 }
            if (typeof firstValue === 'number') {
              numericValue = firstValue;
              console.log(`Extracted direct numeric value for ${aggKey}:`, numericValue);
            }
            // Handle nested structure like { avg: { parsedValue: 1.23, source: "1.23" } }
            else if (firstValue && typeof firstValue === 'object' && (firstValue as any).parsedValue !== undefined) {
              numericValue = (firstValue as any).parsedValue;
              console.log(`Extracted parsedValue for ${aggKey}:`, numericValue);
            } else {
              console.warn(`Could not extract numeric value for ${aggKey}, firstValue:`, firstValue, 'type:', typeof firstValue, 'aggValue:', aggValue);
            }
          } else {
            console.warn(`AggValue is not an object for ${aggKey}:`, aggValue);
          }
          aggregateFields[aggKey].values.push(numericValue);
        }
      }
    });

    fields.push(timeField);
    fields.push(countField);
    Object.values(aggregateFields).forEach(field => fields.push(field));
    
    console.log('Created fields from timeHistogramBuckets:', fields.map(f => ({
      name: f.name,
      type: f.type,
      valueCount: f.values.length,
      sampleValues: f.values.slice(0, 3)
    })));
  }

  private processUniqueValueBuckets(buckets: any[], fieldName: string, fields: any[]): void {
    const valueField = {
      name: `${fieldName}.value`,
      type: FieldType.string,
      values: [],
      config: {},
    };

    const countField = {
      name: `${fieldName}.count`,
      type: FieldType.number,
      values: [],
      config: {},
    };

    buckets.forEach(bucket => {
      valueField.values.push((bucket as any).value || '');
      countField.values.push((bucket as any).count || 0);
    });

    fields.push(valueField);
    fields.push(countField);
  }


}
