import _ from 'lodash';

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
}
