import _, { isNil, omitBy, get, map, assignIn, sortBy, filter, find, uniq, head } from 'lodash';
import { TimeRange } from '@grafana/data';
import { stringify } from 'query-string';
import ms from 'ms';
import { ExecutableDefinitionNode } from 'graphql';
import gql from 'graphql-tag';
import { QueryOptions, QueryTarget, Tuple } from './types';
import { FilterTypes, ParsedFilter } from './parser/types';
import { handleError } from './appEventHandler';

export function getQueryString(obj: any) {
  return stringify(omitBy(obj, isNil));
}

export function toGranularityWithLowerBound(milliseconds: number, lowerBound = 1000): string {
  return ms(Math.max(milliseconds, lowerBound));
}

// used for generating the options.requestId
export function getRequestId(options: QueryOptions, target: QueryTarget) {
  return `${options.dashboardId}_${options.panelId}_${target.refId}`;
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
      return value !== valueToFilter;
    default:
      return false;
  }
};

export function getRange(range: TimeRange): Tuple<number> {
  const timeFrom = range.from.valueOf();
  const timeTo = range.to.valueOf();
  return [timeFrom, timeTo];
}
export const isValidQuery = (query, refId) => {
  try {
    return gql`
      ${query}
    `;
  } catch (e) {
    handleError(e, refId);
    return false;
  }
};
const getFirstSelectionArr = (arr: ExecutableDefinitionNode) => arr?.selectionSet?.selections;
export const getFirstSelection = (graphQuery, refId) => {
  try {
    const { definitions } = gql`
      ${graphQuery}
    `;
    return getFirstSelectionArr(definitions[0] as ExecutableDefinitionNode);
  } catch (e) {
    handleError(e, refId);
    return [];
  }
};

const getNodeSelection = (selection) => {
  const { selectionSet } = head(selection) as any;
  if (selectionSet) {
    const { selections } = selectionSet;
    if (selection[0]?.name.value === 'node') {
      return selections;
    }
    if (selection[0]?.name.value === 'items') {
      return selections;
    }
    return getNodeSelection(selections);
  }
  return [];
};

export const typeNameList = (selected) =>
  uniq(
    filter(
      map(getNodeSelection(selected), ({ selectionSet, name: { value } }) => {
        if (selectionSet) {
          if (find(selectionSet.selections, ({ name: { value } }) => value === '__typename')) {
            return value;
          }
        }
        return undefined;
      })
    )
  );
