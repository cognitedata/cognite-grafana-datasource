import { isNil, omitBy, get } from 'lodash';
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

export function nodesFrame(iterer) {
  const fields: any = {
    id: {
      type: FieldType.string,
    },
    title: {
      type: FieldType.string,
    },
    mainStat: {
      type: FieldType.string,
    },
  };

  const extendedFields = iterer.reduce((previousValue, currentValue) => {
    return {
      ...previousValue,
      [['detail__', currentValue.split(' ')].join('')]: {
        type: FieldType.string,
        config: {
          displayName: currentValue,
        },
      },
    };
  }, fields);
  return new MutableDataFrame({
    name: 'nodes',
    fields: Object.keys(extendedFields).map((key) => ({
      ...extendedFields[key],
      name: key,
    })),
    meta: {
      preferredVisualisationType: 'nodeGraph',
    },
  });
}

export function edgesFrame() {
  const fields: any = {
    id: {
      type: FieldType.string,
    },
    source: {
      type: FieldType.string,
    },
    target: {
      type: FieldType.string,
    },
    mainStat: {
      type: FieldType.string,
    },
  };

  return new MutableDataFrame({
    name: 'edges',
    fields: Object.keys(fields).map((key) => ({
      ...fields[key],
      name: key,
    })),
    meta: {
      preferredVisualisationType: 'nodeGraph',
    },
  });
}
