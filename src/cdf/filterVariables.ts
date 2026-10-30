/**
 * Dashboard variables in a Synthetic time series filter, rendered as filter
 * syntax before Grafana interpolates the rest.
 */
import { ScopedVars } from '@grafana/data';
import { TemplateSrv } from '@grafana/runtime';
import { DMSViewWithProperties } from '../types/dms';
import { NUMBER, ViewFilterProperties } from '../parser/dms/filterCompiler';
import { currentValues, INSTANCE_REF_VARIABLE_TOKEN, isAll } from './graphqlInstanceRefs';
import { InstanceRef, parseInstanceRef } from './instanceRef';

/** A single-quoted filter string literal. */
const quoteFilterString = (value: string): string =>
  `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

/** The filter syntax for a direct relation value. */
export const toFilterInstanceLiteral = ({ space, externalId }: InstanceRef): string =>
  `{space=${quoteFilterString(space)}, externalId=${quoteFilterString(externalId)}}`;

/** A pattern matching any of the values, each taken literally. */
const anyOfPattern = (values: string[]): string => {
  const escaped = values.map((value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return escaped.length === 1 ? escaped[0] : `(${escaped.join('|')})`;
};

/** A single-quoted pattern literal: the grammar keeps a pattern's backslashes as typed. */
const quoteFilterPattern = (pattern: string): string => `'${pattern.replace(/'/g, "\\'")}'`;

type ValueContext = 'pattern' | 'range' | 'value';

/** What the operator just before a variable expects. */
const valueContextOf = (rendered: string): ValueContext =>
  /(=~|!~)\s*$/.test(rendered) ? 'pattern' : /(>=|<=|>|<)\s*$/.test(rendered) ? 'range' : 'value';

/**
 * Renders a dashboard variable used as a filter value, before Grafana's own
 * interpolation runs, so it reads the way it looks: `name=$tag` compares with
 * the selected text, several selected values become a list, `assets=$asset`
 * becomes the selected instance(s), and `name=~$tag` a pattern matching any of
 * the values. Inside a list (`[$tag, 'x']`) the values join the list instead of
 * nesting one, and an empty selection leaves the list. A number stays bare after
 * a range operator; elsewhere it is quoted, as text properties need.
 * buildDmsFilter converts either form to the type the property holds.
 * `${asset.space}` / `${asset.externalId}` give the quoted part(s).
 *
 * Variables inside quotes, tokens with a `:format`, and variables Grafana
 * defines itself are left for Grafana, which pastes them in as text.
 */
export function interpolateFilterVariables(
  filter: string,
  templateSrv: TemplateSrv,
  scopedVars?: ScopedVars
): string {
  if (!filter || !(filter.includes('$') || filter.includes('[['))) {
    return filter;
  }
  const token = new RegExp(INSTANCE_REF_VARIABLE_TOKEN.source, 'y');
  let out = '';
  let quote: string | null = null;
  let listDepth = 0;
  for (let i = 0; i < filter.length; ) {
    const char = filter[i];
    if (quote) {
      out += char;
      if (char === '\\' && i + 1 < filter.length) {
        out += filter[i + 1];
        i += 2;
        continue;
      }
      if (char === quote) {
        quote = null;
      }
      i++;
      continue;
    }
    // A [[var]] token is consumed whole, so its brackets never count as a list.
    token.lastIndex = i;
    const match = char === '$' || char === '[' ? token.exec(filter) : null;
    if (!match) {
      if (char === "'" || char === '"') {
        quote = char;
      } else if (char === '[') {
        listDepth++;
      } else if (char === ']') {
        listDepth = Math.max(0, listDepth - 1);
      }
      out += char;
      i++;
      continue;
    }
    const [text, bracedName, bracedField, bracketName, bracketField, bareName, bareField] = match;
    const inList = listDepth > 0;
    const rendered = renderFilterVariable(
      bracedName ?? bracketName ?? bareName,
      (bracedField ?? bracketField ?? bareField) as keyof InstanceRef | undefined,
      valueContextOf(out),
      inList,
      templateSrv,
      scopedVars
    );
    i += text.length;
    if (rendered === '' && inList) {
      // Nothing selected: drop the item and the comma that joins it to the list.
      if (/,\s*$/.test(out)) {
        out = out.replace(/,\s*$/, '');
      } else {
        i += /^\s*,\s*/.exec(filter.slice(i))?.[0].length ?? 0;
      }
      continue;
    }
    out += rendered ?? text;
  }
  return out;
}

/** The value Grafana pastes for "All" when the variable defines its own. */
const customAllValue = (name: string, templateSrv: TemplateSrv, scopedVars?: ScopedVars) => {
  if (scopedVars?.[name]) {
    return undefined;
  }
  const variable = (templateSrv.getVariables() as unknown as Array<Record<string, any>>).find(
    (v) => v.name === name
  );
  return variable && isAll(variable.current?.value) && variable.allValue
    ? String(variable.allValue)
    : undefined;
};

/** One variable token as filter syntax, or null to leave it for Grafana. */
const renderFilterVariable = (
  name: string,
  field: keyof InstanceRef | undefined,
  context: ValueContext,
  inList: boolean,
  templateSrv: TemplateSrv,
  scopedVars?: ScopedVars
): string | null => {
  const values = currentValues(name, templateSrv, scopedVars);
  if (!values) {
    // "All" with a custom value: Grafana's text, as a pattern after =~ or a value elsewhere.
    const allValue = field ? undefined : customAllValue(name, templateSrv, scopedVars);
    if (allValue === undefined) {
      return null;
    }
    return context === 'pattern' ? quoteFilterPattern(allValue) : quoteFilterString(allValue);
  }
  const asList = (items: string[]) =>
    inList ? items.join(', ') : items.length === 1 ? items[0] : `[${items.join(', ')}]`;
  const refs = values.map((value) => (typeof value === 'string' ? parseInstanceRef(value) : null));
  if (refs.length > 0 && refs.every((ref) => ref !== null)) {
    if (context === 'pattern') {
      return null;
    }
    return asList(
      (refs as InstanceRef[]).map((ref) =>
        field ? quoteFilterString(ref[field]) : toFilterInstanceLiteral(ref)
      )
    );
  }
  if (field || values.some((value) => typeof value !== 'string' && typeof value !== 'number')) {
    return null;
  }
  const texts = values.map(String);
  if (context === 'pattern') {
    return quoteFilterPattern(anyOfPattern(texts));
  }
  // Only a range compares numbers; anywhere else a number-like value may be text, like a tag "1001".
  // buildDmsFilter converts the value to the property's type once it knows the view.
  const numbers = context === 'range' && texts.every((text) => NUMBER.test(text));
  return asList(numbers ? texts : texts.map(quoteFilterString));
};

/** What a filter needs to know about a view's properties; connections have no type to compare. */
export const filterPropertiesOf = (
  viewDef: DMSViewWithProperties | null | undefined
): ViewFilterProperties =>
  new Map(
    Object.entries(viewDef?.properties ?? {})
      .filter(([, def]) => !!def.type?.type)
      .map(([name, def]) => [name, { type: def.type.type, list: !!def.type.list }])
  );
