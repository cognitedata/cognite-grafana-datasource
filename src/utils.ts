import _, { isNil, omitBy, get, map, filter, find, uniq, head } from 'lodash';
import { DataFrame, TimeRange } from '@grafana/data';
import ms from 'ms';
import { ExecutableDefinitionNode } from 'graphql';
import gql from 'graphql-tag';
import { CogniteQuery, QueryOptions, QueryTarget, Tuple } from './types';
import { FilterTypes, ParsedFilter } from './parser/types';
import { NUMERIC_TYPE_KEY } from './cdf/graphqlTimeSeries';
import { GRAPHQL_ROW_FIELDS } from './cdf/graphqlRows';

/** Same encoding as former `query-string` / `strict-uri-encode`: %20 for space, strict on !'()* */
const encodeQueryPart = (value: unknown) =>
  encodeURIComponent(String(value)).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );

/**
 * Builds a query string like `query-string@6` `stringify(omitBy(obj, isNil))`:
 * sorted keys, `key=1&key=2` for arrays, skips null/undefined.
 */
export function getQueryString(obj: { [s: string]: any }) {
  const params = omitBy(obj, isNil) as Record<string, unknown>;
  return Object.keys(params)
    .sort()
    .flatMap((key) => {
      const value = params[key];
      return (Array.isArray(value) ? value : [value])
        .filter((item) => !isNil(item))
        .map((item) => `${encodeQueryPart(key)}=${encodeQueryPart(item)}`);
    })
    .join('&');
}

export function toGranularityWithLowerBound(milliseconds: number, lowerBound = 1000): string {
  return ms(Math.max(milliseconds, lowerBound));
}

// used for generating the options.requestId
export function getRequestId(options: QueryOptions, target: QueryTarget) {
  return `${options.dashboardUID}_${options.panelId}_${target.refId}`;
}

export const applyFilters = <T>(objs: T[], filters: ParsedFilter[]): T[] => {
  if (!filters.length) {
    return objs;
  }

  return objs.filter((obj) => filters.every((filter) => checkFilter(obj, filter)));
};

export const checkFilter = <T>(obj: T, { path, filter, value }: ParsedFilter): boolean => {
  const valueToFilter = get(obj, path, null);
  const regex = new RegExp(`^${value}$`);

  switch (filter) {
    case FilterTypes.RegexEquals:
      return regex.test(valueToFilter);
    case FilterTypes.RegexNotEquals:
      return !regex.test(valueToFilter);
    case FilterTypes.NotEquals:
      return Array.isArray(value) ? !value.includes(valueToFilter) : value !== valueToFilter;
    default:
      return false;
  }
};

export function getRange(range: TimeRange): Tuple<number> {
  const timeFrom = range.from.valueOf();
  const timeTo = range.to.valueOf();
  return [timeFrom, timeTo];
}
const getFirstSelectionArr = (arr: ExecutableDefinitionNode) => arr?.selectionSet?.selections;
/**
 * The query's top-level selection, or none for text that does not parse. The editor
 * reports a parse error itself, and a query that does not parse never runs.
 */
export const getFirstSelection = (graphQuery: string) => {
  try {
    const { definitions } = gql`
      ${graphQuery}
    `;
    return getFirstSelectionArr(definitions[0] as ExecutableDefinitionNode);
  } catch {
    return [];
  }
};

const getNodeSelection = (selection) => {
  const { selectionSet } = head(selection) as any;
  if (selectionSet) {
    const { selections } = selectionSet;
    if (GRAPHQL_ROW_FIELDS.includes(selection[0]?.name.value)) {
      return selections;
    }
    return getNodeSelection(selections);
  }
  return [];
};


export const isAnnotationTarget = (target: CogniteQuery) => !target.tab && target.query && target.refId === "Anno";

export const typeNameList = (selected) => {
  const nodeSelections = getNodeSelection(selected);
  
  // Check if 'type' field exists at node/items level (for numeric time series detection)
  const hasTypeField = find(nodeSelections, ({ name: { value } }) => value === 'type');
  if (hasTypeField) {
    // Return a marker to indicate time series detection is active
    return [NUMERIC_TYPE_KEY];
  }
  
  // Legacy: look for fields whose selectionSet contains __typename
  return uniq(
    filter(
      map(nodeSelections, ({ selectionSet, name: { value } }) => {
        if (selectionSet) {
          if (find(selectionSet.selections, ({ name: { value } }) => value === '__typename')) {
            return value;
          }
        }
        return undefined;
      })
    )
  );
};

export const addValuesToDataFrameObj = (dataFrame: Partial<DataFrame>, valueObj: any) => {
  for (const field of dataFrame.fields) {
      const fieldName = field.name;
      field.values.push(_.get(valueObj, fieldName));
    }
}
