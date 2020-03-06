export enum FilterType {
  RegexNotEquals = '!~',
  RegexEquals = '=~',
  NotEquals = '!=',
  Equals = '=',
}
export interface QueryFilter {
  filter: FilterType;
  value: string;
}

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

export interface ParsedFilter extends QueryFilter {
  path: string;
}

export interface QueryCondition {
  [key: string]: any;
}

export interface ParserResponse extends QueryParserType {
  params: QueryCondition;
  filters: ParsedFilter[];
}
