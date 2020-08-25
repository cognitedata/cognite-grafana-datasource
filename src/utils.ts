import { isNil, omitBy, get } from 'lodash';
import { QueryOptions, QueryTarget } from './types';
import { stringify } from 'query-string';
import ms from 'ms';
import { FilterType, ParsedFilter } from './parser/types';

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

  return objs.filter(obj => filters.every(filter => checkFilter(obj, filter)));
};

export const checkFilter = <T>(obj: T, { path, filter, value }: ParsedFilter): boolean => {
  const valueToFilter = get(obj, path, null);
  const regex = new RegExp(`^${value}$`);

  switch (filter) {
    case FilterType.RegexEquals:
      return regex.test(valueToFilter);
    case FilterType.RegexNotEquals:
      return !regex.test(valueToFilter);
    case FilterType.NotEquals:
      return value !== valueToFilter;
  }
};
