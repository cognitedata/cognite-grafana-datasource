import _ from 'lodash';

export default class Utils {
  //Converts an object to a query string, ignores properties with undefined/null values
  // TODO: maybe clean this up a bit, might break easily
  static getQueryString(obj: any) {
    return _.reduce(
      obj,
      function(result: string, val: any, key: string) {
        return _.isNil(val)
          ? result
          : _.isArray(val)
          ? result + [key, val].map(encodeURIComponent).join('=[') + ']&'
          : result + [key, val].map(encodeURIComponent).join('=') + '&';
      },
      ''
    ).slice(0, -1);
  }
}
