/* eslint-disable */
import { STSClientFilter } from './ts';

export const FilterType = {
  RegexNotEquals: '!~' as FilterType,
  RegexEquals: '=~' as FilterType,
  NotEquals: '!=' as FilterType,
  Equals: '=' as FilterType,
};
export type FilterType = '!~' | '=~' | '!=' | '=';

export enum QueryParserTypes {
  assets = 'assets',
  events = 'events',
}

export interface QueryParserType {
  type: QueryParserTypes;
}

export interface QueryParserResponse extends QueryParserType {
  query: QueryCondition[];
}

export type ParsedFilter = STSClientFilter;

export interface QueryCondition {
  [key: string]: any;
}

export interface ParserResponse extends QueryParserType {
  params: QueryCondition;
  filters: ParsedFilter[];
}
