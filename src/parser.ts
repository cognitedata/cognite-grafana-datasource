import {
  DataQueryRequestItem,
  ParseType,
  QueryOptions,
  FilterOptions,
  FilterType,
  TimeSeriesResponseItem,
  QueryTarget,
  Granularity,
} from './types';
import { getAggregationDropdownString, applyFilters, splitFilters } from './utils';
import { trim } from 'lodash';
import { TemplateSrv } from 'grafana/app/features/templating/template_srv';
import nearley from 'nearley';
import grammar from './query-parser/grammar';

export const parseExpression = (
  expr: string,
  options: QueryOptions,
  timeseries: TimeSeriesResponseItem[],
  templateSrv: TemplateSrv,
  target: QueryTarget
): DataQueryRequestItem[] => {
  // trim and replace all variables here (will also replace variables outside of timeseries{} filters)
  const trimmedExpr = templateSrv.replace(expr.trim(), options.scopedVars);
  // first check if it is just a simple `timeseries{}` or `timeseries{}[]`
  if (isSimpleTimeseriesExpression(trimmedExpr)) {
    const filterOptions = getAndApplyFilterOptions(trimmedExpr, templateSrv, options, timeseries);
    target.aggregation = getAggregationDropdownString(filterOptions.aggregation);
    target.granularity = filterOptions.granularity;

    return timeseries.filter(ts => ts.selected).map(({ id }) => ({ id }));
  }

  const exprWithSpecialFunctions = parseSpecialFunctions(
    trimmedExpr,
    options,
    timeseries,
    templateSrv
  );

  return createDataQueryRequestItems(exprWithSpecialFunctions, options, timeseries, templateSrv);
};

const parseSpecialFunctions = (
  expr: string,
  options: QueryOptions,
  timeseries: TimeSeriesResponseItem[],
  templateSrv: TemplateSrv
) => {
  let newExpr = expr;
  // look for sum(), max(), min(), or avg() with timeseries in it
  const funcRegex = /(sum|max|min|avg)\(timeseries.*?\)/gi;
  const funcRegexMatches = newExpr.match(funcRegex);
  if (funcRegexMatches) {
    for (const match of funcRegexMatches) {
      // the match might match too much, so we need to parse the string more
      const matchIndex = newExpr.indexOf(match);
      if (matchIndex < 0) continue;
      const timeseriesString = findTimeseriesString(newExpr.substr(matchIndex));
      // make sure that we have func(timeseries{}[]) and not a use of the function eg max(timeseries{}, 0)
      if (match.charAt(4 + timeseriesString.length) !== ')') continue;
      const actualMatchString = `${match.substr(0, 4)}${timeseriesString})`;
      const filterOptions = getAndApplyFilterOptions(
        timeseriesString,
        templateSrv,
        options,
        timeseries
      );
      const selectedTs = timeseries.filter(ts => ts.selected);
      let funcString = '';
      if (match.substr(0, 3).toLowerCase() === 'sum') {
        funcString = `(${selectedTs
          .map(({ id }) => getTempAliasString({ id, ...filterOptions }))
          .join(' + ')})`;
      } else {
        if (selectedTs.length <= 1) {
          funcString = selectedTs
            .map(({ id }) => getTempAliasString({ id, ...filterOptions }))
            .join('');
        } else {
          funcString = `${match.slice(0, 3).toLowerCase()}(${selectedTs
            .map(({ id }) => getTempAliasString({ id, ...filterOptions }))
            .join(', ')})`;
        }
      }
      newExpr = newExpr.replace(actualMatchString, funcString);
    }
  }

  return newExpr;
};

// recursively calls itself to create an array of DataQueryRequestItems
const createDataQueryRequestItems = (
  expr: string,
  options: QueryOptions,
  timeseries: TimeSeriesResponseItem[],
  templateSrv: TemplateSrv,
  name: string = ''
): DataQueryRequestItem[] => {
  let dataItems: DataQueryRequestItem[] = [];
  // match timeseries{}[] or timeseries{}
  const timeseriesString = findTimeseriesString(expr);
  if (!timeseriesString) {
    dataItems.push({
      expression: expr,
    } as DataQueryRequestItem);
  } else {
    const filterOptions = getAndApplyFilterOptions(
      timeseriesString,
      templateSrv,
      options,
      timeseries
    );
    const selectedTs = timeseries.filter(ts => ts.selected);

    for (const ts of selectedTs) {
      const replaceString = getTempAliasString({ id: ts.id, ...filterOptions });
      let newExpr = expr.replace(timeseriesString, replaceString);

      // we need to replace all similar timeseries requests
      //  this is so that expressions like `timeseries{} - timeseries{}[avg]` work
      // match all similar `timeseries{...}` and replace them
      const tsFiltersString = findTimeseriesString(timeseriesString, false);
      let index = newExpr.indexOf(tsFiltersString);
      while (index >= 0) {
        const similarTimeseriesString = findTimeseriesString(newExpr.substr(index));
        const similarFilterOptions = getAndApplyFilterOptions(
          similarTimeseriesString,
          templateSrv,
          options,
          selectedTs
        );
        newExpr = newExpr.replace(
          similarTimeseriesString,
          getTempAliasString({ id: ts.id, ...similarFilterOptions })
        );
        index = newExpr.indexOf(tsFiltersString);
      }

      dataItems = dataItems.concat(
        createDataQueryRequestItems(
          newExpr,
          options,
          timeseries,
          templateSrv,
          name || ts.externalId
        )
      );
    }
  }

  return dataItems.map(item => {
    updateSyntheticQueries(item, options);
    return item;
  });
};

const getAndApplyFilterOptions = (
  timeseriesString: string,
  templateSrv: TemplateSrv,
  options: QueryOptions,
  timeseries: TimeSeriesResponseItem[]
) => {
  const filterOptions = parse(timeseriesString, ParseType.Timeseries, templateSrv, options);
  applyFilters(filterOptions.filters, timeseries);
  return filterOptions;
};

// puts in format: 'ID' or 'ID,aggr' or 'ID,aggr,gran'
const getTempAliasString = ({
  id,
  granularity,
  aggregation,
}: {
  id: number | string;
  aggregation: string;
} & Granularity) => {
  // todo: move type somewhere
  return `TS{id=${id}${aggregation ? `,aggregate='${aggregation}'` : ''}${
    granularity ? `,granularity='${granularity}'` : ''
  }}`;
};

const isSimpleTimeseriesExpression = (expr: string) => {
  return findTimeseriesString(expr) === expr;
};

// finds and returns the first string of format 'timeseries{.*}' or 'timeseries{.*}[.*]', respecting brackets
const findTimeseriesString = (expr: string, withAggregateAndGranularity: boolean = true) => {
  const timeseriesIndex = expr.indexOf('timeseries{');
  if (timeseriesIndex < 0) return '';
  const startIndex = timeseriesIndex + 'timeseries{'.length;
  let openBracketCount = 1;
  let index = 0;

  while (openBracketCount > 0) {
    if (startIndex + index >= expr.length) {
      throw new Error(`ERROR: Unable to parse ${expr.substr(timeseriesIndex)}`);
    }
    if (expr.charAt(startIndex + index) === '{') openBracketCount += 1;
    else if (expr.charAt(startIndex + index) === '}') openBracketCount -= 1;
    else if (expr.charAt(startIndex + index) === '"' || expr.charAt(startIndex + index) === "'") {
      // skip ahead if we find a quote
      const endQuote = expr.indexOf(expr.charAt(startIndex + index), startIndex + index + 1);
      if (endQuote < 0) throw new Error(`ERROR: Unable to parse ${expr.substr(timeseriesIndex)}`);
      index = endQuote - startIndex;
    }
    index += 1;
  }
  if (
    withAggregateAndGranularity &&
    startIndex + index < expr.length &&
    expr.charAt(startIndex + index) === '['
  ) {
    const closeBracketIndex = expr.indexOf(']', startIndex + index);
    if (closeBracketIndex > 0) index = closeBracketIndex - startIndex + 1;
    else throw new Error(`ERROR: Unable to parse ${expr.substr(timeseriesIndex)}`);
  }

  return expr.substr(timeseriesIndex, index + 'timeseries{'.length);
};

// take in a dataqueryrequestitem and replace all [ID,agg] or [ID,agg,gran] with TS{id=ID, aggregate=agg, granularity=granularity}
const updateSyntheticQueries = (queryItem: DataQueryRequestItem, options: QueryOptions) => {
  const regexSearch = /\[.*?\]/g;
  const queryStr = queryItem.expression;
  const regexMatches = queryStr.match(regexSearch);

  if (regexMatches) {
    for (const match of regexMatches) {
      // format is id, aggregation, granularity
      if (!match.match(/\[[^0-9]*\]/g)) {
        // todo: remove this (filters out [[Variable]] kind of stuff)
        const [id, aggregation = '', granularity = ''] = match
          .substr(1, match.length - 2)
          .split(',')
          .filter(string => string.length)
          .map(x => trim(x, ' \'"'));
        queryItem.expression = queryStr.replace(
          match,
          getTempAliasString({ id, aggregation, granularity })
        );
      }
    }
  }
};

export const parse = (
  customQuery: string,
  type: ParseType,
  templateSrv: TemplateSrv,
  options?: QueryOptions
): FilterOptions => {
  let query = customQuery;
  if (type === ParseType.Timeseries || type === ParseType.Event) {
    // replace variables with their values
    if (options) {
      query = templateSrv.replace(query, options.scopedVars);
    } else {
      for (const { name, current } of templateSrv.variables) {
        query = query.replace(`[[${name}]]`, current.value);
        query = query.replace(`$${name}`, current.value);
      }
    }
  }

  // todo: to use parser you requires to:
  const parser = new nearley.Parser(nearley.Grammar.fromCompiled(grammar));
  parser.feed(query);

  console.log(parser.finish());
  //

  // Format: timeseries{ options }
  //     or  timeseries{ options }[aggregation, granularity]
  // regex pulls out the options string, as well as the aggre/gran string (if it exists)
  const timeseriesRegex = /^timeseries\{(.*)\}(?:\[(.*)\])?$/;
  const timeseriesMatch = query.match(timeseriesRegex);
  const assetRegex = /^(?:asset|event)\{(.*)\}$/;
  const assetMatch = query.match(assetRegex);
  const filterRegex = /^filter\{(.*)\}$/;
  const filterMatch = query.match(filterRegex);

  let splitfilters: string[];
  if (timeseriesMatch) {
    // regex finds commas that are not followed by a closed bracket
    splitfilters = splitFilters(timeseriesMatch[1], false);
  } else if (assetMatch) {
    splitfilters = splitFilters(assetMatch[1], true);
  } else if (filterMatch) {
    splitfilters = splitFilters(filterMatch[1], false);
  } else {
    throw new Error(`ERROR: Unable to parse expression ${query}`);
  }

  const filters = [];
  for (let f of splitfilters) {
    f = f.trim();
    if (f !== '') {
      let filter;
      for (const type of Object.values(FilterType)) {
        const index = f.indexOf(type);
        if (index > -1) {
          const property = trim(f.substr(0, index), ' \'"');
          const value = trim(f.substr(index + type.length), ' \'"');
          filter = { property, value, type };
          break;
        }
      }
      if (filter) {
        filters.push(filter);
      } else {
        console.error(`Error parsing ${filter}`);
      }
    }
  }

  let granularity = '';
  let aggregation = '';
  if (timeseriesMatch) {
    const optionsStr = timeseriesMatch[2];
    if (optionsStr) {
      const splitAggregation = optionsStr.split(',');
      aggregation = trim(splitAggregation[0], ' \'"').toLowerCase();
      granularity = splitAggregation.length > 1 ? trim(splitAggregation[1], ' \'"') : '';
    }
  }

  return {
    filters,
    granularity,
    aggregation,
  };
};
