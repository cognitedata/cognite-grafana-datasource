import _ from 'lodash';
import { Filter, FilterType, QueryOptions, QueryTarget } from './types';

// Converts an object to a query string, ignores properties with undefined/null values
// TODO: maybe clean this up a bit, might break easily
export function getQueryString(obj: any) {
  return _.reduce(
    obj,
    (result: string, val: any, key: string) => {
      return _.isNil(val)
        ? result
        : _.isArray(val)
        ? `${result + [key, val].map(encodeURIComponent).join('=[')}]&`
        : `${result + [key, val].map(encodeURIComponent).join('=')}&` + '';
    },
    ''
  ).slice(0, -1);
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

export function getAggregationDropdownString(aggregation: string): string {
  let val = getDatasourceValueString(aggregation);
  if (val === 'continousVariance') val = 'continuousVariance';
  // temp 0.5 fix
  else if (val === 'value') val = 'none';
  return val;
}

export function splitFilters(filterString: string, filtersOptions: any, onlyAllowEquals: boolean) {
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
        filtersOptions.error = `ERROR: Unable to parse '${filter}'. Only strict equality (=) is allowed.`;
        return undefined;
      }
      if (filter.indexOf('=') === -1 && filter.indexOf('~') === -1) {
        filtersOptions.error = `ERROR: Could not parse: '${filter}'. Missing a comparator (=,!=,=~,!~).`;
        return undefined;
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
        filtersOptions.error = `ERROR: Could not find closing ' ${
          closeChars[o]
        } ' while parsing '${filterString.substring(start)}'.`;
        return undefined;
      }
    }
    const c = closeChars.findIndex(x => x === filterString[i]);
    if (c >= 0) {
      filtersOptions.error = `ERROR: Unexpected character ' ${
        closeChars[c]
      } ' while parsing '${filterString.substring(start)}'.`;
      return undefined;
    }
  }
  return filterStrings;
}

export function applyFilters(filters: Filter[], objects: any): void {
  for (const obj of objects) {
    obj.selected = true;
    for (const filter of filters) {
      if (filter.type === FilterType.RegexEquals) {
        const val = _.get(obj, filter.property);
        const regex = `^${filter.value}$`;
        if (val === undefined || !val.match(regex)) {
          obj.selected = false;
          break;
        }
      } else if (filter.type === FilterType.RegexNotEquals) {
        const val = _.get(obj, filter.property);
        const regex = `^${filter.value}$`;
        if (val === undefined || val.match(regex)) {
          obj.selected = false;
          break;
        }
      } else if (filter.type === FilterType.NotEquals) {
        const val = _.get(obj, filter.property);
        if (val === undefined || String(val) === filter.value) {
          obj.selected = false;
          break;
        }
      } else if (filter.type === FilterType.Equals) {
        const val = _.get(obj, filter.property);
        if (val === undefined || String(val) !== filter.value) {
          obj.selected = false;
          break;
        }
      }
    }
  }
}

export function intervalToGranularity(intervalMs: number): string {
  const seconds = Math.round(intervalMs / 1000.0);
  if (seconds <= 60) {
    if (seconds <= 1) {
      return '1s';
    }
    return `${seconds}s`;
  }
  const minutes = Math.round(intervalMs / 1000.0 / 60.0);
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.round(intervalMs / 1000.0 / 60.0 / 60.0);
  if (hours <= 24) {
    return `${hours}h`;
  }
  const days = Math.round(intervalMs / 1000.0 / 60.0 / 60.0 / 24.0);
  return `${days}d`;
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

export function reduceToMap(array: { property: string; value: any }[]) {
  return array.reduce((obj, { property, value }) => {
    obj[property] = value;
    return obj;
  }, {});
}
