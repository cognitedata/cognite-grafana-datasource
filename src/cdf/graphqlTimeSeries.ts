import {
  getNamedType,
  GraphQLNamedType,
  GraphQLSchema,
  isInterfaceType,
  isObjectType,
  parse,
  TypeInfo,
  visit,
  visitWithTypeInfo,
} from 'graphql';
import { uniq } from 'lodash';
import { GRAPHQL_ROW_FIELDS } from './graphqlRows';

/** The type of `fieldName` on an object or interface type, unwrapped of list and non-null. */
const namedFieldType = (
  type: GraphQLNamedType | null | undefined,
  fieldName: string
): GraphQLNamedType | undefined => {
  if (!type || !(isObjectType(type) || isInterfaceType(type))) {
    return undefined;
  }
  const field = type.getFields()[fieldName];
  return field ? getNamedType(field.type) : undefined;
};

/**
 * `tsKeys` entries that are markers rather than field names.
 *
 * TIME_SERIES_ROOT_KEY: the schema says the result rows themselves are time series.
 * NUMERIC_TYPE_KEY: the query selects `type`, so rows whose type is numeric are
 * plotted (the pre-schema heuristic, kept for saved queries and custom models).
 */
export const TIME_SERIES_ROOT_KEY = '_root';
export const NUMERIC_TYPE_KEY = '_numeric_type';

const TIME_SERIES_TYPE = 'CogniteTimeSeries';

/** The core time series type, or a model type that extends it. */
export const isTimeSeriesType = (type: GraphQLNamedType | null | undefined): boolean => {
  if (!type) {
    return false;
  }
  if (type.name === TIME_SERIES_TYPE) {
    return true;
  }
  if (isObjectType(type) || isInterfaceType(type)) {
    return type.getInterfaces().some((iface) => iface.name === TIME_SERIES_TYPE);
  }
  return false;
};

/**
 * A connection of time series. The data modelling API types every to-many relation
 * this way -- `timeSeries { items { … } }` or `timeSeries { edges { node { … } } }`
 * -- so a relation field is rarely a time series itself.
 */
export const isTimeSeriesConnection = (type: GraphQLNamedType | null | undefined): boolean =>
  isTimeSeriesType(namedFieldType(type, 'items')) ||
  isTimeSeriesType(namedFieldType(namedFieldType(type, 'edges'), 'node'));

/**
 * The `tsKeys` the schema can vouch for: TIME_SERIES_ROOT_KEY when the rows of the
 * query's first result set are time series, plus each row field that resolves to
 * one, directly or through a connection. Follows the same `items` / `node` envelope
 * the datasource reads rows from.
 * A query the parser rejects yields nothing, leaving the other heuristics to it.
 */
export function timeSeriesKeysFromSchema(schema: GraphQLSchema, query: string): string[] {
  let ast;
  try {
    ast = parse(query);
  } catch {
    return [];
  }

  const typeInfo = new TypeInfo(schema);
  const keys: string[] = [];
  let depth = 0;
  let rowDepth = -1;
  let done = false;

  visit(
    ast,
    visitWithTypeInfo(typeInfo, {
      Field: {
        enter(node) {
          depth++;
          if (done) {
            return;
          }
          // The response is keyed by alias, and so is everything that reads it.
          const name = node.alias?.value ?? node.name.value;
          const type = getNamedType(typeInfo.getType());
          if (rowDepth < 0) {
            if (GRAPHQL_ROW_FIELDS.includes(name)) {
              rowDepth = depth;
              if (isTimeSeriesType(type)) {
                keys.push(TIME_SERIES_ROOT_KEY);
              }
            }
            return;
          }
          if (
            depth === rowDepth + 1 &&
            node.selectionSet &&
            (isTimeSeriesType(type) || isTimeSeriesConnection(type))
          ) {
            keys.push(name);
          }
        },
        leave() {
          if (depth === rowDepth) {
            done = true;
          }
          depth--;
        },
      },
    })
  );

  return uniq(keys);
}
