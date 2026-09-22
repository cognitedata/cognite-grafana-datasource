import { ScopedVars } from '@grafana/data';
import { TemplateSrv } from '@grafana/runtime';
import { InstanceRef, parseInstanceRef } from './instanceRef';

type RefField = keyof InstanceRef;

/** Grafana's sentinel for a variable with "All" selected. */
const ALL_VALUE = '$__all';

/**
 * The variable forms Grafana itself recognises, minus the `:format` suffix, which
 * is left for Grafana to render. Only the two reference parts are accepted after
 * the dot, so any other `$var.field` keeps Grafana's meaning.
 */
const TOKEN =
  /\$\{(\w+)(?:\.(space|externalId))?\}|\[\[(\w+)(?:\.(space|externalId))?\]\]|\$(\w+)(?:\.(space|externalId))?(?!\w)/g;

/** The body of a GraphQL string literal, without its surrounding quotes. */
const escapeGraphqlString = (value: string): string => JSON.stringify(value).slice(1, -1);

/** GraphQL input-object syntax, which is not JSON: keys are bare. */
export const toGraphqlInstanceLiteral = ({ space, externalId }: InstanceRef): string =>
  `{space: ${JSON.stringify(space)}, externalId: ${JSON.stringify(externalId)}}`;

interface VariableLike {
  name: string;
  current?: { value?: unknown };
  options?: Array<{ value?: unknown }>;
  allValue?: string | null;
}

const isAll = (value: unknown): boolean =>
  value === ALL_VALUE || (Array.isArray(value) && value.length === 1 && value[0] === ALL_VALUE);

/**
 * The raw values a variable currently stands for. With "All" selected, Grafana's
 * `current.value` is only the sentinel; the values themselves sit in `options`.
 * A custom `allValue` is Grafana's to render, so it counts as "not references".
 */
const currentValues = (
  name: string,
  templateSrv: TemplateSrv,
  scopedVars?: ScopedVars
): unknown[] | null => {
  if (scopedVars?.[name]) {
    const { value } = scopedVars[name];
    return Array.isArray(value) ? value : [value];
  }
  const variable = (templateSrv.getVariables() as unknown as VariableLike[]).find(
    (v) => v.name === name
  );
  if (!variable) {
    return null;
  }
  const value = variable.current?.value;
  if (isAll(value)) {
    if (variable.allValue) {
      return null;
    }
    return (variable.options ?? [])
      .map((option) => option.value)
      .filter((optionValue) => optionValue !== ALL_VALUE);
  }
  return Array.isArray(value) ? value : [value];
};

/** The references a variable holds, or null when it holds anything else. */
const referencesOf = (
  name: string,
  templateSrv: TemplateSrv,
  scopedVars?: ScopedVars
): InstanceRef[] | null => {
  const values = currentValues(name, templateSrv, scopedVars);
  if (!values?.length) {
    return null;
  }
  const refs = values.map((value) => (typeof value === 'string' ? parseInstanceRef(value) : null));
  if (refs.some((ref) => ref === null)) {
    return null;
  }
  return refs as InstanceRef[];
};

/**
 * Renders dashboard variables that hold instance references into GraphQL before
 * Grafana's own interpolation runs.
 *
 * A variable emitted by the Instance ID value field carries a JSON reference, and
 * Grafana can only paste that string back verbatim -- which is neither a GraphQL
 * input object nor one of its parts. So `${var}` becomes an input object, a
 * multi-value variable a list of them, and `${var.space}` / `${var.externalId}`
 * the bare part, escaped for use inside a GraphQL string. Parts of a multi-value
 * variable are joined with `","`, so a quoted use of one composes into a GraphQL
 * list: `["${vars.externalId}"]`.
 *
 * Variables holding anything else, and tokens with a `:format`, are left for
 * Grafana, so every other interpolation behaves exactly as it always has.
 */
export function interpolateInstanceRefs(
  query: string,
  templateSrv: TemplateSrv,
  scopedVars?: ScopedVars
): string {
  if (!query || !(query.includes('$') || query.includes('[['))) {
    return query;
  }
  return query.replace(
    TOKEN,
    (match, bracedName, bracedField, bracketName, bracketField, bareName, bareField) => {
      const name: string = bracedName ?? bracketName ?? bareName;
      const field: RefField | undefined = bracedField ?? bracketField ?? bareField;
      const refs = referencesOf(name, templateSrv, scopedVars);
      if (!refs) {
        return match;
      }
      if (field) {
        return refs.map((ref) => escapeGraphqlString(ref[field])).join('","');
      }
      return refs.length === 1
        ? toGraphqlInstanceLiteral(refs[0])
        : `[${refs.map(toGraphqlInstanceLiteral).join(', ')}]`;
    }
  );
}
