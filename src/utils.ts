import { isNil, omitBy, get } from 'lodash';
import { AppEvent, QueryOptions, QueryTarget } from './types';
import { stringify } from 'query-string';
import ms from 'ms';
import { FilterType, ParsedFilter } from './parser/types';

export function getQueryString(obj: any) {
  return stringify(omitBy(obj, isNil));
}

export function ms2String(milliseconds: number): string {
  return ms(milliseconds < 1000 ? 1000 : milliseconds);
}

export function timeseriesHash(options: QueryOptions, target: QueryTarget) {
  return `${options.dashboardId}_${options.panelId}_${target.refId}_${
    target.assetQuery.templatedTarget
  }_${target.assetQuery.includeSubtrees}`;
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

  if (valueToFilter === null) {
    return false;
  }

  switch (filter) {
    case FilterType.RegexEquals:
      return valueToFilter.match(regex);
    case FilterType.RegexNotEquals:
      return !valueToFilter.match(regex);
    case FilterType.NotEquals:
      return value !== valueToFilter;
  }
};

/**
 * Comes from grafana, could be imported in future releases hopefully
 * @param name – event name
 */
export const eventFactory = <T = undefined>(name: string): AppEvent<T> => {
  return { name };
};
