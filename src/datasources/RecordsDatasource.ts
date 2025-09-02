import { DataQueryRequest, DataQueryResponse, DataFrame, FieldType } from '@grafana/data';
import { CogniteQuery, HttpMethod, Tuple, RecordsMode } from '../types';
import { Connector } from '../connector';
import { getRange, toGranularityWithLowerBound } from '../utils';
import { 
  fetchStreamRecordsAggregate, 
  fetchStreamRecordsFilter,
  StreamRecordsAggregateRequest, 
  StreamRecordsAggregateResponse,
  StreamRecordsFilterRequest,
  StreamRecordsFilterResponse
} from '../cdf/client';
import { handleError } from '../appEventHandler';

export class RecordsDatasource {
  constructor(private connector: Connector) {}



  async query(options: DataQueryRequest<CogniteQuery>): Promise<DataQueryResponse> {

    const timeRange = getRange(options.range);
    const recordResults = await this.fetchRecordTargets(options.targets, timeRange, options);

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
  ): Promise<StreamRecordsAggregateResponse | StreamRecordsFilterResponse> {
    const { refId, recordsQuery } = target;
    

    
    if (!recordsQuery?.streamId) {
      console.warn('No streamId provided for Records query');
      throw new Error('Please select a stream to query records');
    }

    try {
      // Parse JSON query - template variables and query builder JSON should already be processed by datasource.ts
      if (!recordsQuery.jsonQuery?.trim()) {
        throw new Error('Query is required for Records execution');
      }

      let aggregateRequest: StreamRecordsAggregateRequest;
      
      try {
        // The jsonQuery should already have template variables replaced by replaceVariablesInTarget
        aggregateRequest = JSON.parse(recordsQuery.jsonQuery);

      } catch (parseError) {
        throw new Error(`Invalid JSON query: ${parseError.message}`);
      }

      const mode = recordsQuery.mode || RecordsMode.Aggregate;
      let result: StreamRecordsAggregateResponse | StreamRecordsFilterResponse;
      
      if (mode === RecordsMode.Filter) {
        console.log('Executing filter query for stream:', recordsQuery.streamId);
        console.log('Filter request body:', JSON.stringify(aggregateRequest, null, 2));
        result = await fetchStreamRecordsFilter(
          this.connector,
          recordsQuery.streamId,
          aggregateRequest as StreamRecordsFilterRequest
        );
        console.log('Filter result:', result);
      } else {
        result = await fetchStreamRecordsAggregate(
          this.connector,
          recordsQuery.streamId,
          aggregateRequest as StreamRecordsAggregateRequest
        );
      }
      
      return result;
    } catch (e) {
      console.error('Error in fetchRecordsForTarget:', e);
      throw e; // Re-throw to be caught by fetchRecordTargets
    }
  }

  private convertRecordsToDataFrame(data: StreamRecordsAggregateResponse | StreamRecordsFilterResponse, refId: string): DataFrame {
    const fields = [];
    const values = [];

    // Handle different types of responses
    // API response might be wrapped in an HTTP response object with data property
    const actualData = (data as any)?.data || data;
    
    if (actualData && actualData.aggregates) {
      // Handle aggregate response
      this.processAggregateResults(actualData.aggregates, '', fields, values);
    } else if (actualData && actualData.items) {
      // Handle filter response
      this.processFilterResults(actualData.items, fields);
    }

    // If no data was processed, create empty fields
    if (fields.length === 0) {
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
    
    return dataFrame;
  }

  private processAggregateResults(
    aggregates: any,
    prefix: string,
    fields: any[],
    values: any[]
  ): void {
    
    for (const [key, value] of Object.entries(aggregates)) {
      const fieldName = prefix ? `${prefix}.${key}` : key;

      
      if (value && typeof value === 'object') {
        // Handle timeHistogramBuckets (time series data)
        if (Array.isArray((value as any).timeHistogramBuckets)) {

          this.processTimeHistogramBuckets((value as any).timeHistogramBuckets, fieldName, fields);
        }
        // Handle uniqueValueBuckets
        else if (Array.isArray((value as any).uniqueValueBuckets)) {

          this.processUniqueValueBuckets((value as any).uniqueValueBuckets, fieldName, fields);
        }
        // Handle nested aggregates
        else if ((value as any).aggregates) {

          this.processAggregateResults((value as any).aggregates, fieldName, fields, values);
        }
        // Handle simple aggregate values (avg, min, max, etc.)
        else {

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

        fields.push({
          name: fieldName,
          type: FieldType.number,
          values: [value],
          config: {},
        });
      } else if (typeof value === 'string') {

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

            }
            // Handle nested structure like { avg: { parsedValue: 1.23, source: "1.23" } }
            else if (firstValue && typeof firstValue === 'object' && (firstValue as any).parsedValue !== undefined) {
              numericValue = (firstValue as any).parsedValue;

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

  private processFilterResults(items: any[], fields: any[]): void {

    
    if (items.length === 0) {
      return;
    }
    
    // Create fields based on the structure of the first item
    const sampleItem = items[0];
    const propertyNames = new Set<string>();
    
    // Collect all property names from all items to handle varying structures
    items.forEach(item => {
      this.collectPropertyNames(item, '', propertyNames);
    });
    

    
    // Create fields for each property
    const fieldMap: { [key: string]: any } = {};
    
    propertyNames.forEach(propName => {
      // Determine field type based on first non-null value
      let fieldType = FieldType.string;
      let sampleValue = null;
      
      for (const item of items) {
        const value = this.getNestedProperty(item, propName);
        if (value != null) {
          sampleValue = value;
          if (typeof value === 'number') {
            // Check if this is likely an epoch timestamp based on field name or value
            if (this.isTimestampField(propName) || this.isEpochTimestamp(value)) {
              fieldType = FieldType.time;
            } else {
              fieldType = FieldType.number;
            }
          } else if (typeof value === 'boolean') {
            fieldType = FieldType.boolean;
          } else if (value instanceof Date) {
            fieldType = FieldType.time;
          } else if (typeof value === 'string' && this.isTimestampString(value)) {
            fieldType = FieldType.time;
          }
          // Default to string for everything else
          break;
        }
      }
      
      fieldMap[propName] = {
        name: propName,
        type: fieldType,
        values: [],
        config: {},
      };
      

    });
    
    // Populate field values
    items.forEach(item => {
      propertyNames.forEach(propName => {
        const value = this.getNestedProperty(item, propName);
        const field = fieldMap[propName];
        
        if (field.type === FieldType.time && value) {
          // Convert to timestamp if it's a time field
          if (typeof value === 'string') {
            const timestamp = new Date(value).getTime();
            field.values.push(isNaN(timestamp) ? value : timestamp);
          } else if (typeof value === 'number') {
            // Handle epoch timestamps - convert to milliseconds if needed
            const timestamp = this.convertEpochToMilliseconds(value);
            field.values.push(timestamp);
          } else {
            field.values.push(value);
          }
        } else {
          field.values.push(value != null ? value : null);
        }
      });
    });
    
    // Add fields to the main fields array
    Object.values(fieldMap).forEach(field => {
      fields.push(field);
    });
    

  }
  
  private collectPropertyNames(obj: any, prefix: string, propertyNames: Set<string>): void {
    if (obj == null || typeof obj !== 'object') {
      return;
    }
    
    Object.keys(obj).forEach(key => {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      const value = obj[key];
      
      if (value != null && typeof value === 'object' && !Array.isArray(value)) {
        // Recursively collect nested properties
        this.collectPropertyNames(value, fullKey, propertyNames);
      } else {
        // This is a leaf property
        propertyNames.add(fullKey);
      }
    });
  }
  
  private getNestedProperty(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : null;
    }, obj);
  }

  private isTimestampString(value: string): boolean {
    // Only treat as timestamp if it matches common timestamp patterns
    // ISO 8601 format (with or without timezone)
    const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
    // Unix timestamp (10 or 13 digits)
    const unixTimestampRegex = /^\d{10}$|^\d{13}$/;
    // Date-like strings with full date format
    const fullDateRegex = /^\d{4}-\d{2}-\d{2}$/;
    
    return iso8601Regex.test(value) || 
           unixTimestampRegex.test(value) || 
           fullDateRegex.test(value) ||
           // Additional check: if it contains specific time/date keywords and is parseable
           (value.includes('Time') || value.includes('Date')) && !isNaN(Date.parse(value));
  }

  private isTimestampField(fieldName: string): boolean {
    // Check if field name indicates it's a timestamp
    const timestampFieldPatterns = [
      /time$/i,           // ends with 'time' (case insensitive)
      /Time$/,           // ends with 'Time' (case sensitive)
      /date$/i,          // ends with 'date' 
      /Date$/,           // ends with 'Date'
      /timestamp$/i,     // ends with 'timestamp'
      /created/i,        // contains 'created'
      /updated/i,        // contains 'updated'
      /modified/i,       // contains 'modified'
      /expired/i,        // contains 'expired'
      /deleted/i,        // contains 'deleted'
    ];
    
    return timestampFieldPatterns.some(pattern => pattern.test(fieldName));
  }

  private isEpochTimestamp(value: number): boolean {
    // Check if numeric value looks like an epoch timestamp
    // Unix timestamp in seconds (10 digits, roughly 1970-2050)
    const isUnixSeconds = value >= 946684800 && value <= 2524608000;
    // Unix timestamp in milliseconds (13 digits, roughly 1970-2050)  
    const isUnixMillis = value >= 946684800000 && value <= 2524608000000;
    
    return isUnixSeconds || isUnixMillis;
  }

  private convertEpochToMilliseconds(value: number): number {
    // Convert epoch timestamp to milliseconds for Grafana
    if (value >= 946684800 && value <= 2524608000) {
      // Looks like seconds since epoch, convert to milliseconds
      return value * 1000;
    } else if (value >= 946684800000 && value <= 2524608000000) {
      // Already in milliseconds
      return value;
    } else {
      // Not a recognizable timestamp, return as-is
      return value;
    }
  }

}
