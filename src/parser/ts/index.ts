import { DataQueryRequestItem, TimeSeriesResponseItem, QueryTarget, IdEither } from '../../types';
import _, { isArray, isObjectLike, uniqBy, findIndex, cloneDeep } from 'lodash';
import { Parser, Grammar } from 'nearley';
import grammar from './grammar';
import { getTimeseries, getLabelWithInjectedProps } from '../../cdfDatasource';
import { Connector } from '../../connector';
import { FilterType } from '../types';
import { applyFilters } from '../../utils';
import { parseWith } from '../events-assets/index';
import getFilterDeep from 'deepdash/getFilterDeep';

const filterDeep = getFilterDeep(_);
const compiledGrammar = Grammar.fromCompiled(grammar);

export const formQueriesForExpression = async (
  expression: string,
  target: QueryTarget,
  connector: Connector,
  defaultInterval: string
): Promise<DataQueryRequestItem[]> => {
  const rawParsed = parse(expression);
  const { aggregation, granularity } = target;
  const parsed = enrichWithDefaultAggregates(
    rawParsed,
    { granularity, aggregate: aggregation },
    defaultInterval
  );
  const serverFilters = getServerFilters(parsed);
  if (!serverFilters.length) {
    return [{ expression }];
  }
  const timeseries = await Promise.all(
    serverFilters.map(async filter => {
      const tsResult = await getTimeseries({ filter }, target, connector, false);
      if (!tsResult.length) {
        throw NoTimeseriesFound(filter, expression);
      }
      return tsResult;
    })
  );
  const clientFilters = getClientFilters(parsed);
  const clientFilteredTimeseries = timeseries.map((arr, i) => applyFilters(arr, clientFilters[i]));
  const multiaryFuncTsIndices = getIndicesOfMultiaryFunctionArgs(parsed);
  const permutations = generateAllPossiblePermutations(
    clientFilteredTimeseries,
    multiaryFuncTsIndices
  );
  const queryExpressions = permutations.map(series => injectTSIdsInExpression(parsed, series));
  return queryExpressions.map(expression => ({ expression }));
};

const NoTimeseriesFound = (filter: StringMap, expr: string) => {
  return new Error(
    `No timeseries found for filter ${JSON.stringify(filter)} in expression ${expr}`
  );
};

/**
 * Injects default values of aggregate and granularity (if it is not provided).
 * Mutates <query> properties array with default aggregate or granularity values.
 * @param parsedData: synthetic timeseries parsed data
 * @param target: {aggregation, granularity}
 * @param defaultInterval – interval that comes from grafana options
 * @return result – parsed data with default values of aggregation and granularity
 */
export const enrichWithDefaultAggregates = (
  parsedData: STSQuery,
  { aggregate, granularity }: { aggregate: string; granularity: string },
  defaultInterval: string
) => {
  if (aggregate === 'none') {
    return parsedData;
  }

  const result = cloneDeep(parsedData);
  const defaultValues = {
    aggregate,
    granularity: granularity || defaultInterval,
  };
  walk(result, obj => {
    if (isSTSReference(obj)) {
      Object.keys(defaultValues).forEach(key => {
        if (findIndex(obj.query, ['path', key]) === -1) {
          obj.query.push(STSFilter(key, defaultValues[key]));
        }
      });
    }
  });

  return result;
};

export const injectTSIdsInExpression = (
  parsedData: STSQuery,
  timeseries: TimeSeriesResponseItem[][]
) => {
  let i = 0;
  const exprWithSum = composeSTSQuery(parsedData, item => {
    if (isSTSReference(item) && !hasIdsFilter(item)) {
      const syntheticFilters = item.query.filter(isSTSAggregateFilter);
      const paramTSIds = timeseries[i++].map(({ id }) => id);
      const pseudoParsedSTS = paramTSIds.map(id =>
        STSReference([STSFilter('id', id), ...syntheticFilters])
      );
      return pseudoParsedSTS.map(ts => composeSTSQuery(ts)).join(', ');
    }
  });
  return flattenSumFunctions(exprWithSum);
};

export const parse = (s: string): STSQuery => {
  return parseWith(new Parser(compiledGrammar), s);
};

export const generateAllPossiblePermutations = <T>(
  arrayOfArrays: T[][],
  lockIndices: number[] = []
): T[][][] => {
  let res: T[][][] = [];
  for (let i = 0; i < arrayOfArrays.length; i++) {
    const locked = lockIndices.includes(i);
    const array = [...arrayOfArrays[i]];
    if (res.length) {
      const temp = [...res];
      const temptemp = [];
      for (const t of temp) {
        if (locked) {
          temptemp.push([...t, array]);
        } else {
          for (const item of array) {
            temptemp.push([...t, [item]]);
          }
        }
      }
      res = [...temptemp];
    } else {
      if (locked) {
        res = [[array]];
      } else {
        res = array.map(i => [[i]]);
      }
    }
  }
  return res;
};

export const convertExpressionToLabel = (
  expression: string,
  labelSrc: string,
  tsMap: TSResponseMap
) => {
  return composeSTSQuery(parse(expression), item => {
    if (isSTSReference(item)) {
      const [{ value }] = getIdFilters(item);
      const serie = tsMap[String(value)];
      if (labelSrc) {
        return getLabelWithInjectedProps(labelSrc, serie);
      }
      return `${serie.name || serie.externalId || serie.id}`;
    }
  });
};

export const getLabelsForExpression = async (
  expressions: string[],
  labelSrc: string,
  target,
  connector: Connector
) => {
  const tsIds = getReferencedIdsInExpressions(expressions);
  const tsUniqueIds = uniqBy(tsIds, unwrapId);
  const referencedTS = await getTimeseries({ items: tsUniqueIds }, target, connector, false);
  const tsMap = reduceTsToMap(referencedTS);
  return expressions.map(expr => convertExpressionToLabel(expr, labelSrc, tsMap));
};

export const getReferencedTimeseries = (route: STSQuery): StringMap[] => {
  let idFilters: STSServerFilter[] = [];
  walk(route, obj => {
    if (isSTSReference(obj)) {
      const ids = getIdFilters(obj);
      idFilters = [...idFilters, ...ids];
    }
  });
  return idFilters.map(({ path, value }) => ({
    [path]: value as string,
  }));
};

export const hasAggregates = (expression: string): boolean => {
  let hasAggregates = false;
  walk(parse(expression), obj => {
    if (isSTSReference(obj) && obj.query.some(isSTSAggregateFilter)) {
      hasAggregates = true;
    }
  });
  return hasAggregates;
};

export const flattenServerQueryFilters = (items: unknown[]): StringMap => {
  return items.filter(isSTSFilter).reduce((res, filter) => {
    let value: any;
    if (isByIdsQuery(filter.value)) {
      value = filter.value.map(item => flattenServerQueryFilters([item]));
    } else if (isSTSFilterArr(filter.value)) {
      value = { ...res[filter.path], ...flattenServerQueryFilters(filter.value) };
    } else if (isSTSFilterArr2d(filter.value)) {
      value = filter.value.map(flattenServerQueryFilters);
    } else {
      value = filter.value;
    }
    res[filter.path] = value;
    return res;
  }, {});
};

export const walk = (route: STSQuery, iterator: (item: STSQueryItem | STSFunction) => void) => {
  if (isArray(route)) {
    route.forEach(r => walk(r, iterator));
  } else {
    iterator(route);
    if (isSTSFunction(route)) {
      walk(isMapFunction(route) ? route.args[0] : route.args, iterator);
    }
  }
};

export const getIndicesOfMultiaryFunctionArgs = (route: STSQuery): number[] => {
  const responseArr = [];
  const argsIndices = [];
  let index = 0;
  walk(route, obj => {
    if (isMultiaryFunction(obj) && obj.args.length === 1) {
      argsIndices.push(...obj.args);
    } else if (isSTSReference(obj) && !hasIdsFilter(obj)) {
      if (argsIndices.includes(obj)) {
        responseArr.push(index);
      }
      index++;
    }
  });
  return responseArr;
};

export const extractFilters = (
  route: STSQuery,
  condition: (_, __, parent) => boolean
): unknown[][] => {
  const extracted: unknown[][] = [];
  walk(route, obj => {
    if (isSTSReference(obj) && !hasIdsFilter(obj)) {
      extracted.push(filterDeep(obj.query, condition));
    }
  });
  return extracted;
};

export const getServerFilters = (route: STSQuery): StringMap[] => {
  const filter = (_, __, parent) => isServerFilter(parent) || !isSTSFilter(parent);
  return extractFilters(route, filter).map(filters =>
    flattenServerQueryFilters(filters || [])
  ) as StringMap[];
};

export const flattenClientQueryFilters = (filters: unknown[], path = []): STSClientFilter[] => {
  const res: STSClientFilter[] = [];
  filters.filter(isSTSFilter).forEach(filter => {
    if (isServerFilter(filter) && isSTSFilterArr(filter.value)) {
      res.push(...flattenClientQueryFilters(filter.value, [...path, filter.path]));
    } else {
      res.push({
        path: [...path, filter.path].join('.'),
        value: filter.value,
        filter: filter.filter,
      } as STSClientFilter);
    }
  });
  return res;
};

export const getClientFilters = (route: STSQuery): STSClientFilter[][] => {
  const filter = (_, __, parent) => isClientFilter(parent) || isArray(parent.value);
  return extractFilters(route, filter).map(filters =>
    flattenClientQueryFilters(filters || [])
  ) as STSClientFilter[][];
};

const reverseSTSFilter = ({ path, filter, value }: STSFilter) => {
  return `${path}${filter}${stringifyValue(value)}`;
};

const stringifyValue = (val: STSValue, wrap: boolean = true) => {
  if (isArray(val)) {
    const items = (val as any).map(item => {
      return isSTSFilter(item) ? reverseSTSFilter(item) : stringifyValue(item);
    });
    const joinedStr = items.join(', ');
    if (wrap) {
      return isSTSFilterArr(val) ? `{${joinedStr}}` : `[${joinedStr}]`;
    }
    return joinedStr;
  }
  return JSON.stringify(val);
};

export const composeSTSQuery = (
  target: STSQuery,
  custom?: (item: STSQuery) => string,
  separateWith: string = ''
): string => {
  if (custom) {
    const customRes = custom(target);
    if (customRes !== undefined) {
      return customRes;
    }
  }
  if (isArray(target)) {
    return target.map(i => composeSTSQuery(i, custom)).join(separateWith);
  }
  if (isSTSReference(target)) {
    return `${target.type}{${stringifyValue(target.query, false)}}`;
  }
  if (isOperator(target)) {
    return ` ${target.operator} `;
  }
  if (isWrappedConst(target)) {
    return `${target.constant}`;
  }
  const separator = isMultiaryFunction(target) ? ', ' : '';
  let stringArgs = '';
  if (isMapFunction(target)) {
    const [arg0, ...args] = target.args;
    stringArgs = `${composeSTSQuery(arg0, custom)}, ${args
      .map(arg => stringifyValue(arg))
      .join(', ')}`;
  } else {
    stringArgs = composeSTSQuery(target.args, custom, separator);
  }
  return `${target.func}(${stringArgs})`;
};

const flattenSumFunctions = (expression: string): string => {
  return composeSTSQuery(parse(expression), item => {
    if (isSumFunction(item)) {
      return `(${composeSTSQuery(item.args, null, ' + ')})`;
    }
  });
};

const isSimpleSyntheticExpression = (expr: string): boolean => {
  const parsed = parse(expr);
  return !getServerFilters(parsed).length;
};

const unwrapId = (idEither: IdEither) => {
  if ('id' in idEither) {
    return idEither.id;
  }
  return idEither.externalId;
};

const getReferencedIdsInExpressions = (expressions: string[]) => {
  const allIds: IdEither[] = [];
  for (const expression of expressions) {
    const parsed = parse(expression);
    const referenced = getReferencedTimeseries(parsed) as IdEither[];
    allIds.push(...referenced);
  }
  return allIds;
};

const reduceTsToMap = (timeseries: TimeSeriesResponseItem[]): TSResponseMap => {
  return timeseries.reduce(
    (map, serie) => {
      map[serie.id] = serie;
      if (serie.externalId) {
        map[serie.externalId] = serie;
      }
      return map;
    },
    {} as TSResponseMap
  );
};

export const STSReference = (query: STSFilter[] = []): STSReference => {
  return {
    query,
    type: 'ts',
  };
};

export const STSFilter = (
  path: string,
  value: STSFilter['value'],
  filter: FilterType = '='
): STSFilter => {
  return { path, value, filter } as STSFilter;
};

export const Operator = (operator: Operator['operator']): Operator => {
  return { operator };
};

export const Constant = (constant: number): WrappedConst => {
  return { constant };
};

const getIdFilters = (obj: STSReference) => {
  return obj.query.filter(isIdsFilter);
};

const hasIdsFilter = (obj: STSReference) => {
  return getIdFilters(obj).length;
};

const isEqualsFilter = (query: any): query is STSServerFilter => {
  return isSTSFilter(query) && query.filter === FilterType.Equals;
};

const isOneOf = (value: string, ...arr: string[]) => {
  return arr.indexOf(value) !== -1;
};

const isSTSAggregateFilter = (query: STSFilter) => {
  return isEqualsFilter(query) && isOneOf(query.path, 'granularity', 'aggregate');
};

const isIdsFilter = (query: STSFilter): query is STSServerFilter => {
  return isEqualsFilter(query) && isOneOf(query.path, 'id', 'externalId');
};

const isServerFilter = (item: STSFilter): item is STSServerFilter => {
  return isEqualsFilter(item) && !isSTSAggregateFilter(item);
};

const isClientFilter = (item: any): item is STSClientFilter => {
  return isSTSFilter(item) && !isEqualsFilter(item);
};

const isByIdsQuery = (query: any): query is STSFilter[] => {
  return isArray(query) && query.some(isIdsFilter);
};

const isSTSFilter = (item: any): item is STSFilter => {
  return isObjectLike(item) && item.path && item.filter && 'value' in item;
};

const isSTSFilterArr = (query: any): query is STSFilter[] => {
  return isArray(query) && query.length && query.every(isSTSFilter);
};

const isSTSFilterArr2d = (query: any): query is STSFilter[][] => {
  return isArray(query) && query.every(isSTSFilterArr);
};

const isWrappedConst = (obj: any): obj is WrappedConst => {
  return isObjectLike(obj) && 'constant' in obj;
};

const isSTSReference = (obj: any): obj is STSReference => {
  return isObjectLike(obj) && obj.type === 'ts';
};

const isOperator = (obj: any): obj is Operator => {
  return isObjectLike(obj) && 'operator' in obj;
};

const isSTSFunction = (obj: any): obj is STSFunction => {
  return isObjectLike(obj) && 'args' in obj && 'func' in obj;
};

const isSpecificFunction = (obj: any, name: string): obj is STSFunction => {
  return isSTSFunction(obj) && name === obj.func;
};

const isMapFunction = (obj: any): obj is MapFunction => {
  return isSpecificFunction(obj, 'map');
};

const isSumFunction = (obj: any): obj is MultiaryFunction => {
  return isSpecificFunction(obj, 'sum');
};

const isMultiaryFunction = (obj: any): obj is MultiaryFunction => {
  return (
    isSTSFunction(obj) && isOneOf(obj.func, 'avg', 'sum', 'min', 'max', 'pow', 'round', 'on_error')
  );
};

type TSResponseMap = { [s: string]: TimeSeriesResponseItem };

type StringMap = { [key: string]: string };

type STSValue = STSPrimitiveValue | STSPrimitiveValue[] | STSFilter[] | STSFilter[][];

type STSPrimitiveValue = string | number | boolean;

export type STSQuery = (STSQueryItem[] | STSQueryItem)[] | STSQueryItem;

export type STSFilter = STSClientFilter | STSServerFilter;

export type STSClientFilter = {
  path: string;
  filter: Exclude<FilterType, '='>;
  value: STSPrimitiveValue;
};

export type STSServerFilter = {
  path: string;
  filter: FilterType;
  value: STSValue;
};

export type Operator = {
  operator: '+' | '-' | '/' | '*';
};

export type STSQueryItem = Operator | STSReference | WrappedConst | STSFunction;

export type WrappedConst = {
  constant: number | 'pi()';
};

export type STSFunction = UnaryFunction | MultiaryFunction | MapFunction;

export type UnaryFunction = {
  func: 'sin' | 'cos' | 'ln' | 'sqrt' | 'exp' | 'abs' | '';
  args: STSQueryItem[];
};

export type MultiaryOperator = 'avg' | 'max' | 'min' | 'sum';

export type BinaryOperator = 'pow' | 'round' | 'on_error';

export type MultiaryFunction = {
  func: MultiaryOperator | BinaryOperator;
  args: (STSQueryItem[] | STSQueryItem)[];
};

export type MapFunction = {
  func: 'map';
  args: [STSReference, string[], number[], number];
};

export type STSReference = {
  type: 'ts';
  query: STSFilter[];
};
