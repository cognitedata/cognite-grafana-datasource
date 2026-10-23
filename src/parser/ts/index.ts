import { IdEither, TimeSeriesResponseItem } from "../../cdf/types";
import { DataQueryRequestItem, QueryTarget } from "../../types";
import _, { isArray } from "lodash";
import { Grammar, Parser } from "nearley";
import grammar from "./grammar";
import { getLabelWithInjectedProps, getTimeseries } from "../../cdf/client";
import { Connector } from "../../connector";
import { applyFilters } from "../../utils";
import { parseWith } from "../events-assets/index";
import getFilterDeep from "deepdash/getFilterDeep";
import {
  composeSTSQuery,
  enrichWithDefaultAggregates,
  generateAllPossiblePermutations,
  getIndicesOfMultiaryFunctionArgsWith,
  isEqualsFilter,
  isOneOf,
  isSTSAggregateFilter,
  isSTSFilter,
  isSTSFilterArr,
  isSTSFilterArr2d,
  isSTSReference,
  isSumFunction,
  STSClientFilter,
  STSFilter,
  STSQuery,
  STSReference,
  STSServerFilter,
  walk,
} from "../shared";

// Grammar-agnostic AST types/constructors/helpers live in ../shared; re-exported
// here so existing importers (tests, cdf/client, datasources) keep working.
export * from "../shared";

const filterDeep = getFilterDeep(_);
const compiledGrammar = Grammar.fromCompiled(grammar);

export const formQueriesForExpression = async (
  expression: string,
  target: QueryTarget,
  connector: Connector,
  defaultInterval: string,
): Promise<DataQueryRequestItem[]> => {
  const rawParsed = parse(expression);
  const { aggregation, granularity } = target;
  const parsed = enrichWithDefaultAggregates(
    rawParsed,
    { granularity, aggregate: aggregation },
    defaultInterval,
  );
  const serverFilters = getServerFilters(parsed);
  if (!serverFilters.length) {
    return [{ expression: composeSTSQuery(parsed) }];
  }
  const timeseries = await Promise.all(
    serverFilters.map(async (filter) => {
      const tsResult = await getTimeseries({ filter }, connector, false);
      if (!tsResult.length) {
        throw NoTimeseriesFound(expression, filter);
      }
      return tsResult;
    }),
  );
  const clientFilters = getClientFilters(parsed);
  const clientFilteredTimeseries = timeseries.map((arr, i) =>
    applyFilters(arr, clientFilters[i])
  );
  const multiaryFuncTsIndices = getIndicesOfMultiaryFunctionArgs(parsed);
  const permutations = generateAllPossiblePermutations(
    clientFilteredTimeseries,
    multiaryFuncTsIndices,
  );
  const queryExpressions = permutations.map((series) =>
    injectTSIdsInExpression(parsed, series)
  );
  if (!queryExpressions.length) {
    throw NoTimeseriesFound(expression);
  }
  return queryExpressions.map((expression) => ({ expression }));
};

const NoTimeseriesFound = (expr: string, filter?: StringMap) => {
  const where = filter ? ` ${JSON.stringify(filter)}` : "s";
  return new Error(
    `No timeseries found for filter${where} in expression ${expr}`,
  );
};

export const injectTSIdsInExpression = (
  parsedData: STSQuery,
  timeseries: TimeSeriesResponseItem[][],
) => {
  let i = 0;
  const exprWithSum = composeSTSQuery(parsedData, (item) => {
    if (isSTSReference(item) && !hasIdsFilter(item)) {
      const syntheticFilters = item.query.filter(isSTSAggregateFilter);
      const paramTSIds = timeseries[i++].map(({ id }) => id);
      const pseudoParsedSTS = paramTSIds.map((id) =>
        STSReference([STSFilter("id", id), ...syntheticFilters])
      );
      return pseudoParsedSTS.map((ts) => composeSTSQuery(ts)).join(", ");
    }
  });
  return flattenSumFunctions(exprWithSum);
};

export const parse = (s: string): STSQuery => {
  return parseWith(new Parser(compiledGrammar), s);
};

export const convertExpressionToLabel = (
  expression: string,
  labelSrc: string,
  tsMap: TSResponseMap,
) => {
  return composeSTSQuery(parse(expression), (item) => {
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
  connector: Connector,
) => {
  const tsIds = getReferencedIdsInExpressions(expressions);
  const tsUniqueIds = _.uniqBy(tsIds, unwrapId);
  const referencedTS = await getTimeseries(
    { items: tsUniqueIds },
    connector,
    false,
  );
  const tsMap = reduceTsToMap(referencedTS);
  return expressions.map((expr) =>
    convertExpressionToLabel(expr, labelSrc, tsMap)
  );
};

export const getReferencedTimeseries = (route: STSQuery): StringMap[] => {
  let idFilters: STSServerFilter[] = [];
  walk(route, (obj) => {
    if (isSTSReference(obj)) {
      const ids = getIdFilters(obj);
      idFilters = [...idFilters, ...ids];
    }
  });
  return idFilters.map(({ path, value }) => ({
    [path]: value as string,
  }));
};

export const flattenServerQueryFilters = (items: unknown[]): StringMap => {
  return items.filter(isSTSFilter).reduce((res, filter) => {
    let value: any;
    if (isByIdsQuery(filter.value)) {
      value = filter.value.map((item) => flattenServerQueryFilters([item]));
    } else if (isSTSFilterArr(filter.value)) {
      value = {
        ...res[filter.path],
        ...flattenServerQueryFilters(filter.value),
      };
    } else if (isSTSFilterArr2d(filter.value)) {
      value = filter.value.map(flattenServerQueryFilters);
    } else {
      value = filter.value;
    }
    res[filter.path] = value;
    return res;
  }, {});
};

export const getIndicesOfMultiaryFunctionArgs = (route: STSQuery): number[] => {
  return getIndicesOfMultiaryFunctionArgsWith(route, hasIdsFilter);
};

export const extractFilters = (
  route: STSQuery,
  condition: (_, __, parent) => boolean,
): unknown[][] => {
  const extracted: unknown[][] = [];
  walk(route, (obj) => {
    if (isSTSReference(obj) && !hasIdsFilter(obj)) {
      extracted.push(filterDeep(obj.query, condition));
    }
  });
  return extracted;
};

export const getServerFilters = (route: STSQuery): StringMap[] => {
  const filter = (_, __, parent) =>
    isServerFilter(parent) || !isSTSFilter(parent);
  return extractFilters(route, filter).map((filters) =>
    flattenServerQueryFilters(filters || [])
  ) as StringMap[];
};

export const flattenClientQueryFilters = (
  filters: unknown[],
  path = [],
): STSClientFilter[] => {
  const res: STSClientFilter[] = [];
  filters.filter(isSTSFilter).forEach((filter) => {
    if (isServerFilter(filter) && isSTSFilterArr(filter.value)) {
      res.push(
        ...flattenClientQueryFilters(filter.value, [...path, filter.path]),
      );
    } else {
      res.push({
        path: [...path, filter.path].join("."),
        value: filter.value,
        filter: filter.filter,
      } as STSClientFilter);
    }
  });
  return res;
};

export const getClientFilters = (route: STSQuery): STSClientFilter[][] => {
  const filter = (_, __, parent) =>
    isClientFilter(parent) || isArray(parent.value);
  return extractFilters(route, filter).map((filters) =>
    flattenClientQueryFilters(filters || [])
  ) as STSClientFilter[][];
};

const flattenSumFunctions = (expression: string): string => {
  return composeSTSQuery(parse(expression), (item) => {
    if (isSumFunction(item)) {
      return `(${composeSTSQuery(item.args, null, " + ")})`;
    }
  });
};

const unwrapId = (idEither: IdEither) => {
  if ("id" in idEither) {
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
  return timeseries.reduce((map, serie) => {
    map[serie.id] = serie;
    if (serie.externalId) {
      map[serie.externalId] = serie;
    }
    return map;
  }, {} as TSResponseMap);
};

const getIdFilters = (obj: STSReference) => {
  return obj.query.filter(isIdsFilter);
};

const hasIdsFilter = (obj: STSReference) => {
  return getIdFilters(obj).length > 0;
};

const isIdsFilter = (query: STSFilter): query is STSServerFilter => {
  return isEqualsFilter(query) && isOneOf(query.path, "id", "externalId");
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

type TSResponseMap = { [s: string]: TimeSeriesResponseItem };

type StringMap = { [key: string]: string };
