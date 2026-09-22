import { getFirstSelection } from '../../utils';
import { GRAPHQL_ENVELOPE_FIELDS } from '../../cdf/graphqlRows';

interface GraphQLSelection {
  kind: string;
  name?: { value: string };
  alias?: { value: string };
  selectionSet?: { selections: readonly GraphQLSelection[] };
}

/**
 * Pagination metadata, which sits beside the rows rather than on them. Neither the
 * field nor its children describe a row, so the whole subtree is skipped -- offering
 * `hasNextPage` as a value field yields nothing at run time.
 */
const GRAPHQL_SKIPPED_FIELDS = ['pageInfo'];

const extractFieldNamesFromSelections = (
  selections: readonly GraphQLSelection[]
): string[] => {
  const fieldNames: string[] = [];

  if (!selections || !Array.isArray(selections)) {
    return fieldNames;
  }

  selections.forEach((selection) => {
    if (selection.kind !== 'Field' || !selection.name) {
      return;
    }
    // The response is keyed by alias, so an aliased field is offered by that name.
    const fieldName = selection.alias?.value ?? selection.name.value;

    // Skip GraphQL introspection fields and pagination metadata.
    if (fieldName.startsWith('__') || GRAPHQL_SKIPPED_FIELDS.includes(fieldName)) {
      return;
    }

    if (selection.selectionSet?.selections) {
      // A to-many relation on a row is a connection (`timeSeries { items { name } }`):
      // its children are many rows, so no single path leads to a value. The row
      // envelope itself (`items`, `edges { node }`) is unwrapped, not skipped.
      if (
        !GRAPHQL_ENVELOPE_FIELDS.includes(fieldName) &&
        isConnection(selection.selectionSet.selections)
      ) {
        return;
      }
      const nested = extractFieldNamesFromSelections(selection.selectionSet.selections);
      // An envelope's children *are* row fields, so the wrapper name is dropped and
      // the children promoted in its place. Anything else naming an object --
      // `instanceId { space externalId }` -- is offered as a path too, so it can be
      // picked whole.
      if (!GRAPHQL_ENVELOPE_FIELDS.includes(fieldName)) {
        fieldNames.push(fieldName, ...nested.map((child) => `${fieldName}.${child}`));
      } else {
        fieldNames.push(...nested);
      }
    } else {
      fieldNames.push(fieldName);
    }
  });

  return [...new Set(fieldNames)];
};

/**
 * Field names selected by a query, or [] when it cannot be parsed.
 *
 * Only the first root field is read, matching execution: the datasource unwraps a
 * single root field before mapping rows, so fields from a second one would be
 * offered but never resolve. `refId` routes parse errors to the caller's own query.
 */
/** True when the selections are a row envelope: the field is a connection or a list. */
const isConnection = (selections: readonly GraphQLSelection[]): boolean =>
  selections.some(
    (selection) =>
      selection.kind === 'Field' &&
      !!selection.name &&
      GRAPHQL_ENVELOPE_FIELDS.includes(selection.name.value)
  );

export const extractFieldNamesFromQuery = (
  graphqlQuery: string,
  refId: string
): string[] => {
  const rootSelections: readonly GraphQLSelection[] =
    getFirstSelection(graphqlQuery, refId) ?? [];
  // The operation's own root field (`listCogniteAsset`) is an envelope too, so an
  // offered path has to be relative to a row. Without this, every field came back
  // prefixed with the root field name and silently resolved to nothing.
  const rowSelections = rootSelections[0]?.selectionSet?.selections ?? [];
  return extractFieldNamesFromSelections(
    rowSelections.length ? rowSelections : rootSelections
  );
};

/**
 * Leaf paths only. Object paths stringify to nothing, so they are never useful as
 * text -- neither as a variable's display field nor in a series label.
 */
export const leafFieldNames = (fieldNames: string[]): string[] => {
  const parents = new Set(
    fieldNames
      .filter((field) => field.includes('.'))
      .map((field) => field.slice(0, field.lastIndexOf('.')))
  );
  return fieldNames.filter((field) => !parents.has(field));
};
