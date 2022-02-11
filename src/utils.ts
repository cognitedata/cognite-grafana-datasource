import { isNil, omitBy, get, map, split } from 'lodash';
import { stringify } from 'query-string';
import ms from 'ms';
import { MutableDataFrame, FieldType } from '@grafana/data';
import { QueryOptions, QueryTarget } from './types';
import { FilterTypes, ParsedFilter } from './parser/types';

export function getQueryString(obj: any) {
  return stringify(omitBy(obj, isNil));
}

export function toGranularityWithLowerBound(milliseconds: number, lowerBound = 1000): string {
  return ms(Math.max(milliseconds, lowerBound));
}

// used for generating the options.requestId
export function getRequestId(options: QueryOptions, target: QueryTarget) {
  return `${options.dashboardId}_${options.panelId}_${target.refId}`;
}

export const applyFilters = <T>(objs: T[], filters: ParsedFilter[]): T[] => {
  if (!filters.length) {
    return objs;
  }

  return objs.filter((obj) => filters.every((filter) => checkFilter(obj, filter)));
};

export const checkFilter = <T>(obj: T, { path, filter, value }: ParsedFilter): boolean => {
  const valueToFilter = get(obj, path, null);
  const regex = new RegExp(`^${value}$`);

  switch (filter) {
    case FilterTypes.RegexEquals:
      return regex.test(valueToFilter);
    case FilterTypes.RegexNotEquals:
      return !regex.test(valueToFilter);
    case FilterTypes.NotEquals:
      return value !== valueToFilter;
    default:
      return false;
  }
};

// Template
export const getDataPathArray = (dataPathString: string): string[] => {
  const dataPathArray: string[] = [];
  map(split(dataPathString, ','), (dataPath) => {
    const trimmed = dataPath.trim();
    if (trimmed) {
      dataPathArray.push(trimmed);
    }
  });
  if (!dataPathArray) {
    throw 'data path is empty!';
  }
  return dataPathArray;
};

export const createDatapointsDataFrame = (name: string, refId: string) => {
  return new MutableDataFrame({
    name,
    refId,
    fields: [
      {
        name: 'timestamp',
        type: FieldType.time,
      },
      {
        name: 'value',
        type: FieldType.number,
        config: {
          displayName: name,
        },
      },
    ],
  });
};

export const getDocs = (resultsData: any, dataPath: string): any[] => {
  if (!resultsData) {
    throw 'resultsData was null or undefined';
  }

  const data = dataPath.split('.').reduce((d: any, p: any) => {
    if (!d) {
      return null;
    }
    return d[p];
  }, resultsData.data);
  if (!data) {
    const { errors } = resultsData;
    if (errors && errors.length !== 0) {
      throw errors[0];
    }
    throw `Your data path did not exist! dataPath: ${dataPath}`;
  }
  if (resultsData.errors) {
    // There can still be errors even if there is data
    console.log('Got GraphQL errors:');
    console.log(resultsData.errors);
  }

  return data;
};

// till here
