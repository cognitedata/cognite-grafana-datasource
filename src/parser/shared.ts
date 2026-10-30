/* eslint-disable */
// Grammar-agnostic synthetic-time-series AST helpers shared by the legacy `ts{}`
// parser (src/parser/ts) and the DMS/CDM parser (src/parser/dms). Extracted from
// src/parser/ts/index.ts without behavior changes.
import { cloneDeep, findIndex, isArray, isObjectLike } from "lodash";
import { FilterType, FilterTypes } from "./types";

export type STSPrimitiveValue = string | number | boolean;

export type STSValue =
  | STSPrimitiveValue
  | STSPrimitiveValue[]
  | STSFilter[]
  | STSFilter[][];

export type STSQuery = (STSQueryItem[] | STSQueryItem)[] | STSQueryItem;

export type STSFilter = STSClientFilter | STSServerFilter;

export type STSClientFilter = {
  path: string;
  filter: Exclude<FilterType, "=">;
  value: STSPrimitiveValue;
};

export type STSServerFilter = {
  path: string;
  filter: FilterType;
  value: STSValue;
};

export type Operator = {
  operator: "+" | "-" | "/" | "*";
};

export type STSQueryItem = Operator | STSReference | WrappedConst | STSFunction;

export type WrappedConst = {
  constant: number | "pi()";
};

export type STSFunction = UnaryFunction | MultiaryFunction | MapFunction;

export type UnaryFunction = {
  func: "sin" | "cos" | "ln" | "sqrt" | "exp" | "abs" | "";
  args: STSQueryItem[];
};

export type MultiaryOperator = "avg" | "max" | "min" | "sum";

export type BinaryOperator = "pow" | "round" | "on_error";

export type MultiaryFunction = {
  func: MultiaryOperator | BinaryOperator;
  args: (STSQueryItem[] | STSQueryItem)[];
};

export type MapFunction = {
  func: "map";
  args: [STSReference, string[], number[], number];
};

export type STSReference = {
  type: "ts";
  query: STSFilter[];
};

export const STSReference = (query: STSFilter[] = []): STSReference => {
  return {
    query,
    type: "ts",
  };
};

export const STSFilter = (
  path: string,
  value: STSFilter["value"],
  filter: FilterType = "=",
): STSFilter => {
  return { path, value, filter } as STSFilter;
};

export const Operator = (operator: Operator["operator"]): Operator => {
  return { operator };
};

export const Constant = (constant: number): WrappedConst => {
  return { constant };
};

export const isOneOf = (value: string, ...arr: string[]) => {
  return arr.indexOf(value) !== -1;
};

export const isSTSFilter = (item: any): item is STSFilter => {
  return isObjectLike(item) && item.path && item.filter && "value" in item;
};

export const isSTSFilterArr = (query: any): query is STSFilter[] => {
  return isArray(query) && query.length && query.every(isSTSFilter);
};

export const isSTSFilterArr2d = (query: any): query is STSFilter[][] => {
  return isArray(query) && query.every(isSTSFilterArr);
};

export const isEqualsFilter = (query: any): query is STSServerFilter => {
  return isSTSFilter(query) && query.filter === FilterTypes.Equals;
};

export const isSTSAggregateFilter = (query: STSFilter) => {
  return isEqualsFilter(query) &&
    isOneOf(
      query.path,
      "granularity",
      "aggregate",
      "alignment",
      "targetUnit",
      "targetUnitSystem",
    );
};

export const isWrappedConst = (obj: any): obj is WrappedConst => {
  return isObjectLike(obj) && "constant" in obj;
};

export const isSTSReference = (obj: any): obj is STSReference => {
  return isObjectLike(obj) && obj.type === "ts";
};

export const isOperator = (obj: any): obj is Operator => {
  return isObjectLike(obj) && "operator" in obj;
};

export const isSTSFunction = (obj: any): obj is STSFunction => {
  return isObjectLike(obj) && "args" in obj && "func" in obj;
};

export const isSpecificFunction = (obj: any, name: string): obj is STSFunction => {
  return isSTSFunction(obj) && name === obj.func;
};

export const isMapFunction = (obj: any): obj is MapFunction => {
  return isSpecificFunction(obj, "map");
};

export const isSumFunction = (obj: any): obj is MultiaryFunction => {
  return isSpecificFunction(obj, "sum");
};

export const isMultiaryFunction = (obj: any): obj is MultiaryFunction => {
  return (
    isSTSFunction(obj) &&
    isOneOf(obj.func, "avg", "sum", "min", "max", "pow", "round", "on_error")
  );
};

export const walk = (
  route: STSQuery,
  iterator: (item: STSQueryItem | STSFunction) => void,
) => {
  if (isArray(route)) {
    route.forEach((r) => walk(r, iterator));
  } else {
    iterator(route);
    if (isSTSFunction(route)) {
      walk(isMapFunction(route) ? route.args[0] : route.args, iterator);
    }
  }
};

const reverseSTSFilter = ({ path, filter, value }: STSFilter) => {
  return `${path}${filter}${stringifyValue(value)}`;
};

const stringifyValue = (val: STSValue, wrap: boolean = true) => {
  if (isArray(val)) {
    const items = (val as any).map((item) => {
      return isSTSFilter(item) ? reverseSTSFilter(item) : stringifyValue(item);
    });
    const joinedStr = items.join(", ");
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
  separateWith: string = "",
): string => {
  if (custom) {
    const customRes = custom(target);
    if (customRes !== undefined) {
      return customRes;
    }
  }
  if (isArray(target)) {
    return target.map((i) => composeSTSQuery(i, custom)).join(separateWith);
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
  const separator = isMultiaryFunction(target) ? ", " : "";
  let stringArgs = "";
  if (isMapFunction(target)) {
    const [arg0, ...args] = target.args;
    stringArgs = `${composeSTSQuery(arg0, custom)}, ${
      args
        .map((arg) => stringifyValue(arg))
        .join(", ")
    }`;
  } else {
    stringArgs = composeSTSQuery(target.args, custom, separator);
  }
  return `${target.func}(${stringArgs})`;
};

export const generateAllPossiblePermutations = <T>(
  arrayOfArrays: T[][],
  lockIndices: number[] = [],
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
        res = array.map((i) => [[i]]);
      }
    }
  }
  return res;
};

/**
 * Injects default values of aggregate and granularity (if it is not provided).
 * @param parsedData: synthetic timeseries parsed data
 * @param target: {aggregation, granularity}
 * @param defaultInterval – interval that comes from grafana options
 * @return result – parsed data with default values of aggregation and granularity
 */
export const enrichWithDefaultAggregates = (
  parsedData: STSQuery,
  { aggregate, granularity }: { aggregate: string; granularity: string },
  defaultInterval: string,
) => {
  if (aggregate === "none") {
    return parsedData;
  }

  const result = cloneDeep(parsedData);
  const defaultValues = {
    aggregate,
    granularity: granularity || defaultInterval,
  };
  walk(result, (obj) => {
    if (isSTSReference(obj)) {
      Object.keys(defaultValues).forEach((key) => {
        if (findIndex(obj.query, ["path", key]) === -1) {
          obj.query.push(STSFilter(key, defaultValues[key]));
        }
      });
    }
  });

  return result;
};

/**
 * A single-argument multiary function (e.g. `avg(ts{...})`) "locks" its ts reference:
 * all series matched by that reference collapse into one expression instead of
 * fanning out one series per match. `isPinnedRef` tells which references are already
 * bound to a single series (by id/externalId for the legacy grammar, by
 * space+externalId for the DMS grammar) and therefore not counted.
 */
export const getIndicesOfMultiaryFunctionArgsWith = (
  route: STSQuery,
  isPinnedRef: (ref: STSReference) => boolean,
): number[] => {
  const responseArr = [];
  const argsIndices = [];
  let index = 0;
  walk(route, (obj) => {
    if (isMultiaryFunction(obj) && obj.args.length === 1) {
      argsIndices.push(...obj.args);
    } else if (isSTSReference(obj) && !isPinnedRef(obj)) {
      if (argsIndices.includes(obj)) {
        responseArr.push(index);
      }
      index++;
    }
  });
  return responseArr;
};
