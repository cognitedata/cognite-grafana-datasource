import { get } from 'lodash';
import filterDeep from 'deepdash-es/filterDeep';
import paths from 'deepdash-es/paths';
import omitDeep from 'deepdash-es/omitDeep';
import nearley from 'nearley';
import grammar from './grammar';
import { ParserResponse, QueryParserResponse } from './types';

const parseQuery = (query: string): QueryParserResponse => {
  const parser = new nearley.Parser(nearley.Grammar.fromCompiled(grammar));

  parser.feed(query);

  const [result] = parser.finish();

  return result;
};

const formatResult = ({ type, query }: QueryParserResponse): ParserResponse => {
  const extractedFilters = filterDeep(query, (reg, key, { value, filter }) => value && filter);
  const filtered = extractedFilters
    ? extractedFilters.reduce((acc, c) => ({ ...acc, ...c }), {})
    : {};

  const emptyFilters = omitDeep(filtered, ['filter', 'value']);
  const filters = paths(emptyFilters).map(path => ({ path, ...get(filtered, path) }));

  const extractedParams = filterDeep(query, (reg, key, { value, filter }) => !(value && filter));
  const params = extractedParams ? extractedParams.reduce((acc, c) => ({ ...acc, ...c }), {}) : {};

  return { type, params, filters };
};

const parseV1 = (query: string): ParserResponse => {
  const result = parseQuery(query);

  return formatResult(result);
};

export { parseV1, formatResult, parseQuery };
