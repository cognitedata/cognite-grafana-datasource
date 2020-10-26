import { isNil, omitBy, get, isArray } from 'lodash';
import { QueryOptions, QueryTarget } from './types';
import { stringify } from 'query-string';
import ms from 'ms';
import { FilterType, ParsedFilter } from './parser/types';
import { dateTime, ISO_8601 } from '@grafana/data';

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

export function flatten<T extends Record<string, any>>(
  object: T,
  path: string | null = null,
  separator = '.'
): T {
  return Object.keys(object).reduce((acc: T, key: string): T => {
    const isObject = typeof object[key] === 'object' && object[key] != null;
    const newPath = [path, key].filter(Boolean).join(separator);
    return isObject && !isArray(object[key])
      ? { ...acc, ...flatten(object[key], newPath, separator) }
      : { ...acc, [newPath]: object[key] };
  }, {} as T);
}

export function isRFC3339_ISO6801(str: any): boolean {
  const date = dateTime(str, ISO_8601);
  if (date.isValid()) {
    const iso = date.toISOString();
    if (iso === str) {
      return true;
    }
    // some RFC3339 dates don't include fractions of a second to same resolution, but still valid.
    return iso.substring(0, 19) === str.substring(0, 19);
  }
  return false;
}
