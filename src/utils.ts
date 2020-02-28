import { isNil, omitBy, get } from 'lodash';
import { QueryOptions, QueryTarget } from './types';
import { stringify } from 'query-string';
import ms from 'ms';
import { FilterType, ParsedFilter } from './query-parser/types';

export function getQueryString(obj: any) {
  return stringify(omitBy(obj, isNil));
}

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

export function splitFilters(filterString: string, onlyAllowEquals: boolean) {
  const filterStrings = [];
  // ignore commas that are within these characters
  const openChars = ['(', '[', '{', "'", '"'];
  const closeChars = [')', ']', '}', "'", '"'];
  let start = 0;
  for (let i = 0; i <= filterString.length; ++i) {
    if (i === filterString.length || filterString[i] === ',') {
      const filter = filterString.substring(start, i).trim();
      if (filter.length === 0) {
        start = i + 1;
        continue;
      }
      if (onlyAllowEquals && !filter.match(/[^!]=[^~]/)) {
        throw new Error(`ERROR: Unable to parse '${filter}'. Only strict equality (=) is allowed.`);
      }
      if (filter.indexOf('=') === -1 && filter.indexOf('~') === -1) {
        throw new Error(`ERROR: Could not parse: '${filter}'. Missing a comparator (=,!=,=~,!~).`);
      }
      filterStrings.push(filter);
      start = i + 1;
      continue;
    }
    const o = openChars.findIndex(x => x === filterString[i]);
    if (o >= 0) {
      const c = filterString.indexOf(closeChars[o], i + 1);
      if (c >= 0) {
        i = c;
        continue;
      } else {
        throw new Error(
          `ERROR: Could not find closing ' ${
            closeChars[o]
          } ' while parsing '${filterString.substring(start)}'.`
        );
      }
    }
    const c = closeChars.findIndex(x => x === filterString[i]);
    if (c >= 0) {
      throw new Error(
        `ERROR: Unexpected character ' ${closeChars[c]} ' while parsing '${filterString.substring(
          start
        )}'.`
      );
    }
  }
  return filterStrings;
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

export const applyFiltersV1 = <T>(objs: T[], filters: ParsedFilter[]): T[] => {
  if (!filters.length) {
    return objs;
  }

  return objs.filter(obj => filters.every(filter => checkFilter(obj, filter)));
};

export const checkFilter = <T>(obj: T, { path, filter, value }: ParsedFilter): boolean => {
  const valueToFilter = get(obj, path);
  const regex = `^${value}$`;

  if (!valueToFilter) {
    return true;
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
