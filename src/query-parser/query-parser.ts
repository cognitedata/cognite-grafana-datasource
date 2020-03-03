import _, { get, isUndefined } from 'lodash';
import getFilterDeep from 'deepdash/getFilterDeep';
import getPaths from 'deepdash/getPaths';
import getOmitDeep from 'deepdash/getOmitDeep';
import nearley from 'nearley';
import grammar from './grammar';
import { ParserResponse, QueryParserResponse } from './types';

const filterDeep = getFilterDeep(_);
const paths = getPaths(_);
const omitDeep = getOmitDeep(_);

const parseQuery = (query: string): QueryParserResponse => {
  const parser = new nearley.Parser(nearley.Grammar.fromCompiled(grammar));
  let result;

  try {
    parser.feed(query);

    [result] = parser.finish();
  } catch (e) {
    throw handleParserError(e, query);
  }

  if (!result) {
    throw handleParserError({ offset: query.length }, query, 'Unexpected end of input');
  }

  return result;
};

const handleParserError = ({ offset }, query, title = 'Syntax error') => {
  const pointer = Number.isInteger(offset) ? offset + 1 : query.length;
  const message = `${query}\n${Array(pointer).join(' ')}^`;

  return { title, message };
};

const formatResult = ({ type, query }: QueryParserResponse): ParserResponse => {
  const extractedFilters = filterDeep(
    query,
    (reg, key, { value, filter }) => !isUndefined(value) && filter
  );
  const filtered = extractedFilters
    ? extractedFilters.reduce((acc, c) => ({ ...acc, ...c }), {})
    : {};

  const emptyFilters = omitDeep(filtered, ['filter', 'value']);
  const filters = paths(emptyFilters).map(path => ({ path, ...get(filtered, path) }));

  const extractedParams = filterDeep(
    query,
    (reg, key, { value, filter }) => !(!isUndefined(value) && filter)
  );
  const params = extractedParams ? extractedParams.reduce((acc, c) => ({ ...acc, ...c }), {}) : {};

  return { type, params, filters };
};

const parse = (query: string): ParserResponse => {
  const result = parseQuery(query);

  return formatResult(result);
};

export { parse, formatResult, parseQuery };
