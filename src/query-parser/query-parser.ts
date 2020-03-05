import _, { get, isUndefined } from 'lodash';
import getFilterDeep from 'deepdash/getFilterDeep';
import getPaths from 'deepdash/getPaths';
import getOmitDeep from 'deepdash/getOmitDeep';
import nearley from 'nearley';
import grammar from './grammar';
import { ParserError, ParserResponse, QueryParserResponse } from './types';

const filterDeep = getFilterDeep(_);
const paths = getPaths(_);
const omitDeep = getOmitDeep(_);

const parseQuery = (query: string): QueryParserResponse => {
  const parser = new nearley.Parser(nearley.Grammar.fromCompiled(grammar));
  const trimmedQuery = query.trim();
  let result;

  try {
    parser.feed(trimmedQuery);

    [result] = parser.finish();
  } catch (e) {
    throw handleParserError(e, trimmedQuery);
  }

  if (!result) {
    throw handleParserError(
      { offset: trimmedQuery.length },
      trimmedQuery,
      'Unexpected end of input'
    );
  }

  return result;
};

const handleParserError = ({ offset }, query, title = 'Syntax error'): ParserError => {
  const pointer = Number.isInteger(offset) ? offset + 1 : query.length;
  const message = `${query}\n${Array(pointer).join(' ')}^`;

  return { title, message };
};

const formatQueryParse = ({ type, query }: QueryParserResponse): ParserResponse => {
  const extractedFilters = filterDeep(
    query,
    (objValue, objKey, { value, filter }) => !isUndefined(value) && filter
  );
  const filtered = extractedFilters
    ? extractedFilters.reduce((acc, c) => ({ ...acc, ...c }), {})
    : {};

  const emptyFilters = omitDeep(filtered, ['filter', 'value', 'key']);
  const filters = paths(emptyFilters, { pathFormat: 'array' }).map(path => {
    const currentPath = path.join('.');
    const parentPath = path.slice(0, -1);
    const { filter, key, value } = get(filtered, currentPath);

    parentPath.push(key);

    return { filter, value, path: parentPath.join('.') };
  });

  const extractedParams = filterDeep(
    query,
    (reg, key, { value, filter }) => !(!isUndefined(value) && filter)
  );
  const params = extractedParams ? extractedParams.reduce((acc, c) => ({ ...acc, ...c }), {}) : {};

  return { type, params, filters };
};

const parse = (query: string): ParserResponse => {
  const result = parseQuery(query);

  return formatQueryParse(result);
};

export { parse, formatQueryParse, parseQuery };
