/**
 * The DMS filter language of the Synthetic time series tab: parsing a
 * variable's filter, splitting it into what CDF filters on and what is checked
 * afterwards, and compiling the CDF part into a DMS filter.
 */
import { isArray } from 'lodash';
import { Grammar, Parser } from 'nearley';
import filterGrammar from './filter';
import { parseWith } from '../events-assets/index';
import {
  isEqualsFilter,
  isSTSAggregateFilter,
  isSTSFilter,
  isSTSFilterArr,
  STSClientFilter,
  STSFilter,
  STSReference,
} from '../shared';
import { FilterTypes } from '../types';
import { DMSFilter, ViewRef } from '../../types/dms';
import { INSTANCE_PROPERTIES } from '../../cdf/instanceProperties';

const compiledFilter = Grammar.fromCompiled(filterGrammar);

/** The filter pairs of a variable; an empty filter selects every instance of the view. */
export const parseFilter = (s: string): STSFilter[] =>
  s.trim() ? parseWith(new Parser(compiledFilter), s) : [];

/**
 * Non-throwing syntax check used for editor diagnostics. Returns the 0-based
 * offset (into the original, untrimmed string) and a short message for the
 * first syntax error, or null when the text parses.
 */
export const validateWith = (
  grammar: Grammar,
  s: string
): { offset: number; message: string } | null => {
  const trimmed = s.trim();
  if (!trimmed) {
    return null;
  }
  const leading = s.length - s.trimStart().length;
  const parser = new Parser(grammar);
  try {
    parser.feed(trimmed);
    const [result] = parser.finish();
    if (result === undefined) {
      return { offset: leading + trimmed.length, message: 'Unexpected end of input' };
    }
  } catch (e: any) {
    const offset = Number.isInteger(e?.offset) ? e.offset : trimmed.length;
    return { offset: leading + offset, message: 'Syntax error' };
  }
  return null;
};

export const validateFilter = (s: string) => validateWith(compiledFilter, s);

/**
 * DMS reserves these property names on the instance itself (they never appear as
 * view properties), so they filter through node-scoped paths like ["node", "space"].
 * The node's `type` is left out: views can have their own, as CogniteTimeSeries does.
 */
const RESERVED_INSTANCE_PROPS = [...INSTANCE_PROPERTIES.map(({ name }) => name), 'version'];

const RANGE_OPERATOR_KEYS: Record<string, 'gte' | 'gt' | 'lte' | 'lt'> = {
  [FilterTypes.GreaterOrEquals as string]: 'gte',
  [FilterTypes.Greater as string]: 'gt',
  [FilterTypes.LessOrEquals as string]: 'lte',
  [FilterTypes.Less as string]: 'lt',
};

const isRangeFilter = ({ filter }: STSFilter) => filter in RANGE_OPERATOR_KEYS;
const isPrefixFilter = ({ filter }: STSFilter) => filter === FilterTypes.Prefix;
const isExistsShapedFilter = ({ filter, value }: STSFilter) =>
  (filter === FilterTypes.Equals || filter === FilterTypes.NotEquals) && value === null;

/** CDF can't reach a nested value, so only a top-level != is sent to CDF. */
const isTopLevelNotEquals = (item: unknown): boolean =>
  isSTSFilter(item) && item.filter === FilterTypes.NotEquals && item.path.indexOf('.') === -1;

export interface SplitRefFilters {
  /** Synthetic reference parameters: the tab sets them, a filter may not */
  synthetic: STSFilter[];
  /** compiled into a DMS FilterDefinition */
  server: STSFilter[];
  /** !=, =~, !~ — applied client-side on the fetched instance properties */
  client: STSClientFilter[];
}

export const splitRefFilters = (ref: STSReference): SplitRefFilters => {
  const synthetic: STSFilter[] = [];
  const server: STSFilter[] = [];
  const client: STSClientFilter[] = [];
  ref.query.forEach((item) => {
    if (isSTSAggregateFilter(item)) {
      synthetic.push(item);
    } else if (
      isEqualsFilter(item) ||
      isRangeFilter(item) ||
      isPrefixFilter(item) ||
      isExistsShapedFilter(item) ||
      isTopLevelNotEquals(item)
    ) {
      server.push(item);
    } else {
      client.push(item as STSClientFilter);
    }
  });
  return { synthetic, server, client };
};

/** ["prop"]-style DMS filter path for a property of the selected view. */
export const viewPropertyPath = (view: ViewRef, prop: string): string[] =>
  RESERVED_INSTANCE_PROPS.indexOf(prop) !== -1
    ? ['node', prop]
    : [view.space, `${view.externalId}/${view.version}`, prop];

/** Converts a parsed STS value (which may hold nested filter pairs) into a plain DMS value. */
const toDmsValue = (value: unknown): any => {
  if (isSTSFilterArr(value)) {
    return value.reduce((acc, f) => ({ ...acc, [f.path]: toDmsValue(f.value) }), {});
  }
  if (isArray(value)) {
    return value.map(toDmsValue);
  }
  return value;
};

export interface BuildDmsFilterOptions {
  /** The view's list-valued properties: `=` on one means "contains any of", as DMS has no equals for lists. */
  listProperties?: Set<string>;
}

/**
 * Compiles a variable's server-side filters into a DMS FilterDefinition scoped
 * to the given view. Range operators on the same property merge into a single
 * range leaf. No hasData leaf: listing with the view as the source already
 * returns only instances with data in it.
 */
export const buildDmsFilter = (
  view: ViewRef,
  serverFilters: STSFilter[],
  { listProperties = new Set<string>() }: BuildDmsFilterOptions = {}
): DMSFilter | undefined => {
  const leaves: DMSFilter[] = [];
  const rangesByProp: { [path: string]: DMSFilter['range'] } = {};

  serverFilters.forEach((f) => {
    if (f.path.indexOf('.') !== -1) {
      throw new Error(`"${f.path}" only works with !=, =~ and !~.`);
    }
    const property = viewPropertyPath(view, f.path);
    if ((isRangeFilter(f) || isPrefixFilter(f)) && isArray(f.value)) {
      throw new Error(`"${f.filter}" takes one value, but "${f.path}" has several.`);
    }
    if (isRangeFilter(f)) {
      const key = RANGE_OPERATOR_KEYS[f.filter];
      const range = rangesByProp[f.path] ?? { property };
      if (range[key] !== undefined) {
        throw new Error(`"${f.path}" has two "${f.filter}" conditions; keep one.`);
      }
      range[key] = toDmsValue(f.value);
      rangesByProp[f.path] = range;
    } else if (isPrefixFilter(f)) {
      leaves.push({ prefix: { property, value: String(f.value) } });
    } else if (isExistsShapedFilter(f)) {
      // prop!=null -> exists; prop=null -> not(exists)
      const exists: DMSFilter = { exists: { property } };
      leaves.push(f.filter === FilterTypes.NotEquals ? exists : { not: exists });
    } else {
      if (isArray(f.value) && !isSTSFilterArr(f.value) && f.value.length === 0) {
        throw new Error(`The list for "${f.path}" is empty.`);
      }
      const equality: DMSFilter =
        isArray(f.value) && !isSTSFilterArr(f.value)
          ? listProperties.has(f.path)
            ? { containsAny: { property, values: toDmsValue(f.value) } }
            : { in: { property, values: toDmsValue(f.value) } }
          : listProperties.has(f.path)
            ? { containsAny: { property, values: [toDmsValue(f.value)] } }
            : { equals: { property, value: toDmsValue(f.value) } };
      // prop!=x keeps instances without a value, like a local comparison would.
      leaves.push(f.filter === FilterTypes.NotEquals ? { not: equality } : equality);
    }
  });

  leaves.push(...Object.values(rangesByProp).map((range) => ({ range })));

  if (!leaves.length) {
    return undefined;
  }
  return leaves.length === 1 ? leaves[0] : { and: leaves };
};

export const instanceKey = ({ space, externalId }: { space: string; externalId: string }) =>
  `${space}:${externalId}`;
