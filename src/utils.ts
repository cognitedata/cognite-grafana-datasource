import _ from 'lodash';
import { QueryOptions, QueryTarget } from './types';

export default class Utils {
  // Converts an object to a query string, ignores properties with undefined/null values
  // TODO: maybe clean this up a bit, might break easily
  static getQueryString(obj: any) {
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

  static getDatasourceValueString(aggregation: string): string {
    const mapping = {
      undefined: 'value',
      none: 'value',
      avg: 'average',
      int: 'interpolation',
      stepinterpolation: 'stepInterpolation',
      step: 'stepInterpolation',
      continuousvariance: 'continousVariance', // spelling mistake is intended - will have to change in 0.6
      continuousVariance: 'continousVariance',
      cv: 'continousVariance',
      discretevariance: 'discreteVariance',
      dv: 'discreteVariance',
      totalvariation: 'totalVariation',
      tv: 'totalVariation',
    };
    return mapping[aggregation] || aggregation;
  }

  static splitFilters(filterString: string, filtersOptions: any, onlyAllowEquals: boolean) {
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

  static timeseriesHash(options: QueryOptions, target: QueryTarget) {
    return `${options.dashboardId}_${options.panelId}_${target.refId}_${
      target.assetQuery.templatedTarget
    }_${target.assetQuery.includeSubtrees}`;
  }
}
