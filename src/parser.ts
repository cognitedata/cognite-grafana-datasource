import {
  DataQueryRequestItem,
  ParseType,
  QueryOptions,
  FilterOptions,
  FilterType,
  TimeSeriesResponseItem,
  DataQueryAlias,
  QueryTarget,
} from './types';
import Utils from './utils';
import _ from 'lodash';
import { TemplateSrv } from 'grafana/app/features/templating/template_srv';

export const parseExpression = (
  expr: string,
  options: QueryOptions,
  timeseries: TimeSeriesResponseItem[],
  templateSrv: TemplateSrv,
  target: QueryTarget
): DataQueryRequestItem[] => {
  const trimmedExpr = expr.trim();
  // first check if it is just a simple `timeseries{}` or `timeseries{}[]`
  if (isSimpleTimeseriesExpression(trimmedExpr)) {
    const filterOptions = getAndApplyFilterOptions(trimmedExpr, templateSrv, options, timeseries);
    target.aggregation = filterOptions.aggregation;
    target.granularity = filterOptions.granularity;
    return timeseries.filter(ts => ts.selected).map(ts => ({ name: ts.name }));
  }

  // add special function name if only sum,avg,etc?
  const exprWithSpecialFunctions = parseSpecialFunctions(
    trimmedExpr,
    options,
    timeseries,
    templateSrv
  );

  return createDataQueryRequestItems(
    exprWithSpecialFunctions,
    options,
    timeseries,
    templateSrv,
    ''
  );
};

const parseSpecialFunctions = (
  expr: string,
  options: QueryOptions,
  timeseries: TimeSeriesResponseItem[],
  templateSrv: TemplateSrv
) => {
  let newExpr = expr;
  // look for sum() - case-insensitive
  const sumRegex = /sum\(.*?\)/gi;
  let sumRegexMatches = newExpr.match(sumRegex);
  if (sumRegexMatches) {
    // remove duplicates
    sumRegexMatches = sumRegexMatches.filter((match, i, a) => i === a.indexOf(match));
    for (const match of sumRegexMatches) {
      const timeseriesString = match.slice(4, -1);
      const filterOptions = getAndApplyFilterOptions(
        timeseriesString,
        templateSrv,
        options,
        timeseries
      );
      const selectedTs = timeseries.filter(ts => ts.selected);
      const sumString = `([${selectedTs
        .map(ts => getTempAliasString(ts, filterOptions))
        .join('] + [')}])`;
      newExpr = newExpr.replace(match, sumString);
    }
  }

  // look for max(), min(), or avg()
  const funcRegex = /(max|min|avg)\(.*?\)/gi;
  let funcRegexMatches = newExpr.match(funcRegex);
  if (funcRegexMatches) {
    // remove duplicates
    funcRegexMatches = funcRegexMatches.filter((match, i, a) => i === a.indexOf(match));
    for (const match of funcRegexMatches) {
      const timeseriesString = match.slice(4, -1);
      const filterOptions = getAndApplyFilterOptions(
        timeseriesString,
        templateSrv,
        options,
        timeseries
      );
      const selectedTs = timeseries.filter(ts => ts.selected);
      let funcString = '';
      if (selectedTs.length <= 1) {
        funcString = selectedTs.map(ts => `[${getTempAliasString(ts, filterOptions)}]`).join('');
      } else {
        funcString = `${match.slice(0, 3)}([${selectedTs
          .map(ts => getTempAliasString(ts, filterOptions))
          .join('], [')}])`;
      }
      newExpr = newExpr.replace(match, funcString);
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
  name: string
): DataQueryRequestItem[] => {
  let dataItems: DataQueryRequestItem[] = [];
  // match timeseries{}[] or timeseries{}
  const timeseriesRegex = /timeseries\{.*?\}(?:\[.*?\])?/;
  const timeseriesMatch = expr.match(timeseriesRegex);
  if (!timeseriesMatch) {
    dataItems.push({
      name,
      function: expr,
    });
  } else {
    const filterOptions = getAndApplyFilterOptions(
      timeseriesMatch[0],
      templateSrv,
      options,
      timeseries
    );
    const selectedTs = timeseries.filter(ts => ts.selected);

    for (const ts of selectedTs) {
      const replaceString = `[${getTempAliasString(ts, filterOptions)}]`;
      dataItems = dataItems.concat(
        createDataQueryRequestItems(
          expr.replace(timeseriesMatch[0], replaceString),
          options,
          timeseries,
          templateSrv,
          name || ts.name
        )
      );
    }
  }

  return dataItems.map(item => {
    updateAliases(item, options);
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
  if (filterOptions.error) throw filterOptions.error;
  Utils.applyFilters(filterOptions.filters, timeseries);
  return filterOptions;
};

// puts in format: 'ID' or 'ID,aggr' or 'ID,aggr,gran'
const getTempAliasString = (timeseries: TimeSeriesResponseItem, filterOptions: FilterOptions) => {
  return `${timeseries.id}${filterOptions.aggregation ? `,${filterOptions.aggregation}` : ''}${
    filterOptions.granularity ? `,${filterOptions.granularity}` : ''
  }`;
};

const isSimpleTimeseriesExpression = (expr: string) => {
  const timeseriesRegex = /^timeseries\{.*?\}(?:\[.*?\])?/;
  const timeseriesMatch = expr.match(timeseriesRegex);
  if (timeseriesMatch && timeseriesMatch[0] === expr) return true;
  return false;
};

// take in a dataqueryrequestitem and replace all [ID,agg] or [ID,agg,gran] with aliases
const updateAliases = (queryItem: DataQueryRequestItem, options: QueryOptions) => {
  const regexSearch = /\[.*?\]/g;
  const regexMatches = queryItem.function.match(regexSearch);
  if (!queryItem.aliases) queryItem.aliases = [];
  if (regexMatches) {
    for (const match of regexMatches) {
      // format is id, aggregation, granularity
      const aliasParts = match
        .substr(1, match.length - 2)
        .split(',')
        .filter(string => string.length)
        .map(x => _.trim(x, ' \'"'));
      // if we only get [ID] or [ALIAS], then there is no need to make an alias
      if (aliasParts.length === 1) continue;
      const alias: DataQueryAlias = {
        alias: `alias${aliasParts.join('_')}`,
        id: Number(aliasParts[0]),
      };
      alias.aggregate = aliasParts[1];
      alias.granularity = aliasParts[2] || Utils.intervalToGranularity(options.intervalMs);
      queryItem.function = queryItem.function.replace(match, `[${alias.alias}]`);
      if (queryItem.aliases.find(x => x.alias === alias.alias)) continue;
      queryItem.aliases.push(alias);
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
      for (const templateVariable of templateSrv.variables) {
        query = query.replace(`[[${templateVariable.name}]]`, templateVariable.current.value);
        query = query.replace(`$${templateVariable.name}`, templateVariable.current.value);
      }
    }
  }

  const filtersOptions = {
    filters: [],
    granularity: '',
    aggregation: '',
    error: '',
  };

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
    splitfilters = Utils.splitFilters(timeseriesMatch[1], filtersOptions, false);
  } else if (assetMatch) {
    splitfilters = Utils.splitFilters(assetMatch[1], filtersOptions, true);
  } else if (filterMatch) {
    splitfilters = Utils.splitFilters(filterMatch[1], filtersOptions, false);
  } else {
    filtersOptions.error = `ERROR: Unable to parse expression ${query}`;
  }

  if (filtersOptions.error) {
    return filtersOptions;
  }

  for (let f of splitfilters) {
    f = _.trim(f, ' ');
    if (f === '') continue;
    const filter: any = {};
    let i: number;
    if ((i = f.indexOf(FilterType.RegexEquals)) > -1) {
      filter.property = _.trim(f.substr(0, i), ' \'"');
      filter.value = _.trim(f.substr(i + 2), ' \'"');
      filter.type = FilterType.RegexEquals;
    } else if ((i = f.indexOf(FilterType.RegexNotEquals)) > -1) {
      filter.property = _.trim(f.substr(0, i), ' \'"');
      filter.value = _.trim(f.substr(i + 2), ' \'"');
      filter.type = FilterType.RegexNotEquals;
    } else if ((i = f.indexOf(FilterType.NotEquals)) > -1) {
      filter.property = _.trim(f.substr(0, i), ' \'"');
      filter.value = _.trim(f.substr(i + 2), ' \'"');
      filter.type = FilterType.NotEquals;
    } else if ((i = f.indexOf(FilterType.Equals)) > -1) {
      filter.property = _.trim(f.substr(0, i), ' \'"');
      filter.value = _.trim(f.substr(i + 1), ' \'"');
      filter.type = FilterType.Equals;
    } else {
      console.error(`Error parsing ${f}`);
    }
    filtersOptions.filters.push(filter);
  }

  if (timeseriesMatch) {
    const aggregation = timeseriesMatch[2];
    if (aggregation) {
      const splitAggregation = aggregation.split(',');
      filtersOptions.aggregation = _.trim(splitAggregation[0], ' \'"').toLowerCase();
      filtersOptions.granularity =
        splitAggregation.length > 1 ? _.trim(splitAggregation[1], ' \'"') : '';
    }
  }

  return filtersOptions;
};
