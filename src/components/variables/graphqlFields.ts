import { SelectableValue } from '@grafana/data';
import { parse } from 'graphql';
import { INSTANCE_ID_FIELD, INSTANCE_REF_HINT } from '../../cdf/instanceRef';
import { leafFieldNames } from '../graphql/graphqlFields';
import { VariableQueryData } from '../../types';

const INSTANCE_ID_OPTION: SelectableValue<string> = {
  value: INSTANCE_ID_FIELD,
  label: 'Instance ID (space + externalId)',
  description: `Emits ${INSTANCE_REF_HINT} for filtering on a direct relation`,
};

/**
 * The reference option only makes sense once both identifiers are selected on the
 * same object: at the top level, or under exactly one nested field. `a.space` next
 * to `b.externalId` is not a reference, and two nested candidates are ambiguous --
 * the same rules `readInstanceRef` applies when the variable runs.
 */
export const canEmitInstanceRef = (fieldNames: string[]): boolean => {
  const parentsOf = (name: string) =>
    new Set(
      fieldNames
        .filter((field) => field === name || field.endsWith(`.${name}`))
        .map((field) => field.slice(0, Math.max(0, field.length - name.length - 1)))
    );
  const spaces = parentsOf('space');
  const shared = [...parentsOf('externalId')].filter((parent) => spaces.has(parent));
  if (shared.includes('')) {
    return true;
  }
  return shared.length === 1;
};

/** Offered when the query cannot be parsed yet, so the field is never empty. */
const FALLBACK_VALUE_FIELDS: Array<SelectableValue<string>> = [
  { value: 'name', label: 'name' },
  { value: 'externalId', label: 'externalId' },
  { value: 'id', label: 'id' },
];

/**
 * Value-field options for a query. Labels are the raw field paths so they read the
 * same here as they do in the query text.
 */
export const buildValueFieldOptions = (fieldNames: string[]): Array<SelectableValue<string>> => {
  if (!fieldNames.length) {
    return FALLBACK_VALUE_FIELDS;
  }
  return [
    // Offered whenever the query selects space and externalId, so the variable can
    // be piped straight into a filter that matches on a direct relation.
    ...(canEmitInstanceRef(fieldNames) ? [INSTANCE_ID_OPTION] : []),
    ...fieldNames.map((field) => ({ value: field, label: field })),
  ];
};

/**
 * Display-text candidates. The instance-reference sentinel is not a readable label,
 * and object paths stringify to nothing, so only leaf paths are offered.
 */
export const buildDisplayFieldOptions = (
  fieldNames: string[]
): Array<SelectableValue<string>> =>
  leafFieldNames(fieldNames).map((field) => ({ value: field, label: field }));

/** Why a state could not be persisted, for the editor to show. */
export type VariableQueryProblem =
  | { reason: 'incomplete-graphql' }
  | { reason: 'invalid-graphql'; message: string }
  | { reason: 'empty-assets' }
  | { reason: 'invalid-assets'; message: string };

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export type PersistedVariableQuery =
  | { value: VariableQueryData; problem?: undefined }
  | { value?: undefined; problem: VariableQueryProblem };

/**
 * The payload to persist, or the reason it cannot be.
 *
 * Refusing rather than writing an empty query is what keeps a half-finished edit
 * from overwriting a working variable. Grafana derives a variable's definition from
 * `query`, so whichever tab is active puts its own text there -- and the other tab's
 * text rides along in its own key so neither is ever lost.
 */
export const buildPersistedVariableQuery = (
  state: VariableQueryData,
  validateAssets?: (query: string) => void
): PersistedVariableQuery => {
  const { valueType, queryType, graphqlQuery, dataModel, displayField } = state;
  const assetsQuery = state.queryType === 'graphql' ? state.assetsQuery : state.query;

  if (queryType === 'graphql') {
    if (
      !graphqlQuery ||
      !dataModel?.space ||
      !dataModel?.externalId ||
      !dataModel?.version
    ) {
      return { problem: { reason: 'incomplete-graphql' } };
    }
    // Same rule as the panel tab: text the parser rejects is never saved over a
    // working query.
    try {
      parse(graphqlQuery);
    } catch (error) {
      return { problem: { reason: 'invalid-graphql', message: errorMessage(error) } };
    }
    return {
      value: {
        query: graphqlQuery,
        valueType,
        queryType,
        graphqlQuery,
        dataModel,
        // The assets expression is kept verbatim, so opening this tab cannot
        // discard a query the other tab still owns.
        ...(assetsQuery?.trim() ? { assetsQuery } : {}),
        ...(displayField ? { displayField } : {}),
      },
    };
  }

  // An empty assets query is never worth saving: it is what merely opening the tab
  // looks like, and persisting it would silently retire a working variable.
  if (!state.query?.trim()) {
    return { problem: { reason: 'empty-assets' } };
  }

  // Reached from the value-type control as well as from the query field, so the
  // expression is checked here rather than only where it is typed.
  try {
    validateAssets?.(state.query);
  } catch (error) {
    return { problem: { reason: 'invalid-assets', message: errorMessage(error) } };
  }

  return {
    value: {
      query: state.query,
      valueType,
      queryType: 'assets',
      // Carried through so switching tabs never discards the other side.
      ...(graphqlQuery ? { graphqlQuery } : {}),
      ...(dataModel ? { dataModel } : {}),
      ...(displayField ? { displayField } : {}),
    },
  };
};
