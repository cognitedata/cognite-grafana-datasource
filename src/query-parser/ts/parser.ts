import {
  DataQueryRequestItem,
  QueryOptions,
  TimeSeriesResponseItem,
  QueryTarget,
  IdEither,
} from '../../types';
import _, { isArray, isObjectLike } from 'lodash';
import { TemplateSrv } from 'grafana/app/features/templating/template_srv';
import { Parser, Grammar } from 'nearley';
import grammar from './grammar';
import { getTimeseries, getLabelWithInjectedProps } from '../../cdfDatasource';
import { Connector } from '../../connector';
import { FilterType, ParsedFilter } from '../types';
import { applyFilters } from '../../utils';
import { parseWith } from '../index';
import getFilterDeep from 'deepdash/getFilterDeep';

const filterDeep = getFilterDeep(_);
const compiledGrammar = Grammar.fromCompiled(grammar);

export const formQueriesForExpression = async (
  expr: string,
  options: QueryOptions,
  templateSrv: TemplateSrv,
  target: QueryTarget,
  connector: Connector
): Promise<DataQueryRequestItem[]> => {
  const templatedExpr = templateSrv.replace(expr.trim(), options.scopedVars);
  if (isSimpleSyntheticExpression(templatedExpr)) {
    return [{ expression: templatedExpr }];
  }
  const parsed = parse(templatedExpr);
  const serverFilters = getServerFilters(parsed);
  const timeseries = await Promise.all(
    serverFilters.map(async filter => {
      const tsResult = await getTimeseries({ filter }, target, connector, false);
      if (!tsResult.length) {
        throw new Error(
          `No timeseries found for filter ${JSON.stringify(filter)} in expression ${expr}`
        );
      }
      return tsResult;
    })
  );
  const clientFilters = getClientFilters(parsed);
  const clientFilteredTimeseries = timeseries.map((arr, i) =>
    applyFilters(arr, clientFilters[i])
  );
  const multiaryFuncTsIndices = getIndicesOfMultiaryFunctionArgs(parsed);
  const permutations = generateAllPossiblePermutations(
    clientFilteredTimeseries,
    multiaryFuncTsIndices
  );
  const queryExpressions = permutations.map(series => injectTSIdsInExpression(parsed, series));
  return queryExpressions.map(expression => ({ expression }));
};

export const injectTSIdsInExpression = (
  parsedData: STSQueryItem[] | STSFunction,
  timeseries: TimeSeriesResponseItem[][]
) => {
  let i = 0;
  const exprWithSum = reverse(parsedData, item => {
    if (isSTSReference(item) && !hasIdsFilter(item)) {
      const syntheticFilters = item.query.filter(isSTSAggregateFilter);
      const paramTSIds = timeseries[i++].map(({ id }) => id);
      const pseudoParsedSTS = paramTSIds.map(id =>
        STSReference([STSFilter('id', id), ...syntheticFilters])
      );
      return pseudoParsedSTS.map(ts => reverse(ts)).join(', ');
    }
  });
  return flattenSumFunctions(exprWithSum);
};

export const parse = (s: string): STSQueryItem[] | STSFunction => {
  return parseWith(new Parser(compiledGrammar), s)
};

const flattenSumFunctions = (queryWithSum: string): string => {
  const parsed = parse(queryWithSum);
  return reverse(parsed, item => {
    if (isMultiaryFunction(item) && item.func === 'sum') {
      return `(${reverse(item.args, null, ' + ')})`;
    }
  });
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

const isSimpleSyntheticExpression = (expr: string): boolean => {
  const parsed = parse(expr);
  return !getServerFilters(parsed).length;
};

function unwrapId(idEither: IdEither) {
  if ('id' in idEither) {
    return idEither.id;
  } else {
    return idEither.externalId;
  }
}

const filterNonUniqueIds = (ids: IdEither[]) => {
  const uniqueMap = {};
  for (const idEither of ids) {
    uniqueMap[unwrapId(idEither)] = idEither;
  }
  const uniqueIds = Object.keys(uniqueMap).map(key => uniqueMap[key]);
  return uniqueIds;
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

export const convertExpressionToLabel = (
  expression: string,
  labelSrc: string,
  tsMap: TSResponseMap
) => {
  const parsed = parse(expression);
  const labelRes = reverse(parsed, item => {
    if (isSTSReference(item)) {
      const [{ value }] = getIdFilters(item);
      const serie = tsMap[String(value)];
      if (labelSrc) {
        return getLabelWithInjectedProps(labelSrc, serie);
      }
      return `${serie.name || serie.externalId || serie.id}`;
    }
  });
  return labelRes;
};

export const getLabelsForExpression = async (
  expressions: string[],
  labelSrc: string,
  target,
  connector: Connector
) => {
  const tsIds = getReferencedIdsInExpressions(expressions);
  const tsUniqueIds = filterNonUniqueIds(tsIds);
  const referencedTS = await getTimeseries({ items: tsUniqueIds }, target, connector, false);
  const tsMap = reduceTsToMap(referencedTS);
  return expressions.map(expr => convertExpressionToLabel(expr, labelSrc, tsMap));
};

type TSResponseMap =  { [s: string]: TimeSeriesResponseItem };
type StringMap = { [key: string]: string };

export type STSFilter = {
  path: string;
  filter: FilterType;
  value: string | number | STSFilter[] | STSFilter[][];
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
} 

export type STSReference = {
  type: 'ts';
  query: STSFilter[];
};

export const getReferencedTimeseries = (
  route: STSQueryItem[] | STSFunction
): StringMap[] => {
  let idFilters: STSFilter[] = [];
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

export function flattenServerQueryFilters(items: STSFilter[]): StringMap {
  return items.reduce((res, filter) => {
    let value: any;
    if (isByIdsQuery(filter.value)) {
      value = filter.value.map(item => flattenServerQueryFilters([item]));
    } else if(isSTSFilterArr(filter.value)) {
      value = {...res[filter.path], ...flattenServerQueryFilters(filter.value)};
    } else if (isArray(filter.value)){
      value = filter.value.map(flattenServerQueryFilters);
    } else {
      value = filter.value
    }
    res[filter.path] = value;
    return res;
  }, {});
}

export const walk = (
  route: (STSQueryItem[] | STSQueryItem)[] | STSQueryItem | STSFunction | WrappedConst,
  iterator: (item: STSQueryItem | STSFunction) => any
) => {
  if (isArray(route)) {
    return route.map(r => walk(r, iterator));
  }
  {
    const resArr = [];
    const res = iterator(route);
    if (res !== undefined) {
      resArr.push(res);
    }
    if (isSTSFunction(route)) {
      let args;
      if(isMapFunction(route)) {
        args = route.args[0];
      } else {
        args = route.args;
      }
      resArr.push(...walk(args, iterator));
    }
    return resArr;
  }
};

export const getIndicesOfMultiaryFunctionArgs = (route: STSQueryItem[] | STSFunction): number[] => {
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

export const getServerFilters = (
  route: STSQueryItem[] | STSFunction
): StringMap[] => {
  const responseArr: StringMap[] = [];
  const filter = (_, __, parent) => isServerFilter(parent);
  walk(route, obj => {
    if (isSTSReference(obj) && !hasIdsFilter(obj)) {
      const serverQuery = filterDeep(filterDeep(obj.query, filter), filter);
      const flatFilters = flattenServerQueryFilters(serverQuery || []);
      responseArr.push(flatFilters);
    }
  });
  return responseArr;
};


export function flattenClientQueryFilters(items: STSFilter[], path = []): ParsedFilter[] {
  const res: ParsedFilter[] = [];
  items.forEach(filter => {
    if (isServerFilter(filter) && isSTSFilterArr(filter.value)) {
      res.push(
        ...flattenClientQueryFilters(filter.value, [...path, filter.path])
      )
    } else {
      res.push({
        path: [...path, filter.path].join('.'),
        value: filter.value as string | number,
        filter: filter.filter
      })
    }
  })
  return res;
}

export const getClientFilters = (route: STSQueryItem[] | STSFunction): ParsedFilter[][] => {
  const responseArr: ParsedFilter[][] = [];
  const filter = (_, __, parent) => isClientFilter(parent) || isArray(parent.value);
  walk(route, obj => {
    if (isSTSReference(obj) && !hasIdsFilter(obj)) {
      const clientQuery = filterDeep(filterDeep(obj.query, filter), filter);
      const flatFilters = flattenClientQueryFilters(clientQuery || []);
      responseArr.push(flatFilters);
    }
  });
  return responseArr;
};

const reverseItem = (
  item: STSQueryItem | STSFunction | WrappedConst | STSQueryItem[],
  custom?: (item: STSQueryItem | STSFunction | WrappedConst | (STSQueryItem | STSQueryItem[])[]) => string
) => {
  if (custom) {
    const customRes = custom(item);
    if (customRes !== undefined) {
      return customRes;
    }
  }
  if (isArray(item)) {
    return reverse(item, custom);
  }
  if (isSTSReference(item)) {
    const filters = item.query.map(reverseSTSFilter).join(', ');
    return `ts{${filters}}`;
  }
  if (isOperator(item)) {
    return ` ${item.operator} `;
  }
  if (isWrappedConst(item)) {
    return `${item.constant}`;
  }
  const separator = isMultiaryFunction(item) ? ', ' : '';
  let stringArgs = '';
  if(isMapFunction(item)) {
    const [arg0, ...args] = item.args;
    stringArgs = `${reverseItem(arg0, custom)}, ${args.map(stringifyValue).join(', ')}`
  } else {
    stringArgs = (item.args as any).map(i => reverseItem(i, custom)).join(separator);
  }
  return `${item.func}(${stringArgs})`;
};

function reverseSTSFilter({ path, filter, value }: STSFilter) {
  return `${path}${filter}${stringifyValue(value)}`;
};

function stringifyValue(val: string | number | number[] | string[] | STSFilter[] | STSFilter[][]) {
  if(isArray(val)) {
    const items = (val as any).map(item => {
      return isSTSFilter(item) ? reverseSTSFilter(item) : stringifyValue(item)
    });
    const joinedItems = items.join(', ');
    if(isSTSFilterArr(val)) {
      return `{${joinedItems}}`;
    }
    if (isArray(val)) {
      return `[${joinedItems}]`;
    }
  }
  return JSON.stringify(val);
}

export const reverse = (
  arr: (STSQueryItem[] | STSQueryItem)[] | STSQueryItem | STSFunction | WrappedConst,
  custom?: (item: STSQueryItem | STSFunction) => string,
  separator: string = ''
) => {
  if (isArray(arr)) {
    return arr.map(i => reverseItem(i, custom)).join(separator);
  }
  return reverseItem(arr, custom);
};

export function STSReference(query: STSFilter[] = []): STSReference {
  return {
    query,
    type: 'ts',
  };
}

export function STSFilter(
  path: string,
  value: STSFilter['value'],
  filter: FilterType = '='
): STSFilter {
  return { path, value, filter };
}

export function Operator(operator: Operator['operator']): Operator {
  return { operator };
}

const getIdFilters = (obj: STSReference) => {
  return obj.query.filter(isIdsFilter);
};

const hasIdsFilter = (obj: STSReference) => {
  return getIdFilters(obj).length;
};

function isEqualsFilter(query: any)  {
  return isSTSFilter(query) && query.filter === FilterType.Equals;
}

function isOneOf(value: string, ...arr: string[]) {
  return arr.indexOf(value) !== -1;
}

function isSTSAggregateFilter(query: STSFilter) {
  return isEqualsFilter(query) && isOneOf(query.path, 'granularity', 'aggregate');
}

function isIdsFilter(query: STSFilter) {
  return isEqualsFilter(query) && isOneOf(query.path, 'id', 'externalId');
}

function isServerFilter(item: STSFilter) {
  return isEqualsFilter(item) && !isSTSAggregateFilter(item);
}

function isClientFilter(item: any) {
  return isSTSFilter(item) && !isEqualsFilter(item);
}

function isByIdsQuery(query: any): query is STSFilter[] {
  return isArray(query) && query.some(isIdsFilter);
}

function isSTSFilter(item: any): item is STSFilter {
  return isObjectLike(item) && item.path && item.filter && 'value' in item;
}

function isSTSFilterArr(query: any): query is STSFilter[] {
  return isArray(query) && query.length && query.every(isSTSFilter);
}

function isWrappedConst(obj: any): obj is WrappedConst {
  return isObjectLike(obj) && 'constant' in obj;
}

function isSTSReference(obj: any): obj is STSReference {
  return isObjectLike(obj) && obj.type === 'ts';
}

function isOperator(obj: any): obj is Operator {
  return isObjectLike(obj) && 'operator' in obj;
}

function isSTSFunction(obj: any): obj is STSFunction {
  return isObjectLike(obj) && 'args' in obj && 'func' in obj;
}

function isMapFunction(obj: any): obj is MapFunction {
  return isSTSFunction(obj) && 'map' === obj.func;
}

function isMultiaryFunction(obj: any): obj is MultiaryFunction {
  return isSTSFunction(obj) && [
    'avg',
    'sum',
    'min',
    'max',
    'pow',
    'round',
    'on_error',
  ].includes(obj.func);
}

