/**
 * The shape of a GraphQL result set, stated once.
 *
 * The data modelling API answers a list query with `{ items: [row] }`, or with the
 * Relay form `{ edges: [{ node: row }] }`. Everything that walks a query or a
 * response -- field extraction, time series detection, the variable resolver, the
 * panel datasource -- reads rows through here rather than restating the envelope.
 */

/** Fields whose children are row fields. */
export const GRAPHQL_ROW_FIELDS = ['items', 'node'];

/** Every wrapper around the rows, `edges` included, which wraps the `node`s. */
export const GRAPHQL_ENVELOPE_FIELDS = [...GRAPHQL_ROW_FIELDS, 'edges'];

export type GraphqlRow = Record<string, unknown>;

export type GraphqlRowEnvelope =
  | { kind: 'items'; raw: GraphqlRow[]; rows: GraphqlRow[] }
  | { kind: 'edges'; raw: Array<{ node?: GraphqlRow }>; rows: GraphqlRow[] }
  | { kind: 'array'; raw: GraphqlRow[]; rows: GraphqlRow[] };

const isRow = (value: unknown): value is GraphqlRow =>
  !!value && typeof value === 'object' && !Array.isArray(value);

/** The rows of one root field's response, and which envelope they came in. */
export function readGraphqlRows(response: unknown): GraphqlRowEnvelope | null {
  if (Array.isArray(response)) {
    const raw = response.filter(isRow);
    return { kind: 'array', raw, rows: raw };
  }
  if (!isRow(response)) {
    return null;
  }
  if (Array.isArray(response.items)) {
    const raw = response.items.filter(isRow);
    return { kind: 'items', raw, rows: raw };
  }
  if (Array.isArray(response.edges)) {
    const raw = response.edges as Array<{ node?: GraphqlRow }>;
    return { kind: 'edges', raw, rows: raw.map((edge) => edge?.node).filter(isRow) };
  }
  return null;
}

/**
 * The rows of a response's first populated root field, whatever the envelope.
 * `!= null` rather than `!== null`: an undefined root field is no more usable than
 * a null one.
 */
export function unwrapGraphqlRows(data: Record<string, unknown> | undefined | null): GraphqlRow[] {
  if (!data) {
    return [];
  }
  const rootKey = Object.keys(data).find((key) => data[key] != null);
  return rootKey ? readGraphqlRows(data[rootKey])?.rows ?? [] : [];
}
