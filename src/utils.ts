import { isNil, omitBy, get } from 'lodash';
import { QueryOptions, QueryTarget } from './types';
import { stringify } from 'query-string';
import ms from 'ms';
import { FilterType, ParsedFilter } from './parser/types';

export function getQueryString(obj: any) {
  return stringify(omitBy(obj, isNil));
}

// todo: need to remove this one
export function getDatasourceValueString(aggregation: string): string {
  const mapping = {
    '': 'value',
    undefined: 'value',
    none: 'value',
    avg: 'average',
    int: 'interpolation',
    stepinterpolation: 'stepInterpolation',
    step: 'stepInterpolation',
    continuousvariance: 'continuousVariance',
    continuousVariance: 'continuousVariance',
    cv: 'continuousVariance',
    discretevariance: 'discreteVariance',
    dv: 'discreteVariance',
    totalvariation: 'totalVariation',
    tv: 'totalVariation',
  };
  return mapping[aggregation] || aggregation;
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
