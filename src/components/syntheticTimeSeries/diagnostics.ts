/**
 * Live diagnostics for the Synthetic time series editors: syntax errors from
 * the nearley grammars, unknown variables in the expression, and filter
 * properties the selected view does not declare.
 */
import { CodeMarker } from '../common/monacoDiagnostics';
import { validateExpression, validateFilter } from '../../parser/dms';
import { RESERVED_VARIABLE_NAMES } from '../../parser/dms/variables';
import { INSTANCE_PROPERTIES } from '../../cdf/instanceProperties';

const syntaxMarker = (
  text: string,
  error: { offset: number; message: string } | null,
  what: string
): CodeMarker[] =>
  error
    ? [
        {
          severity: 'error',
          message: `${error.message} in ${what}`,
          startOffset: Math.min(error.offset, Math.max(text.length - 1, 0)),
          endOffset: text.length,
        },
      ]
    : [];

/** Quoted strings blanked out (same length), so identifiers inside them are not scanned. */
const blankStrings = (text: string) =>
  text.replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/g, (match) => ' '.repeat(match.length));

/** An identifier that is neither a function call, a dashboard variable nor part of a property path. */
const IDENTIFIER_REGEX = /(?<![\w$.{:[])([A-Za-z_][A-Za-z0-9_]*)\b(?!\s*\()/g;

/**
 * Markers for the expression: one syntax error, or every reference to a variable
 * that is not declared. Pass undefined as `knownVariables` to skip the second pass.
 */
export const computeExpressionMarkers = (
  expression: string,
  knownVariables?: Set<string>
): CodeMarker[] => {
  const syntax = syntaxMarker(expression, validateExpression(expression), 'the expression');
  if (syntax.length || !knownVariables) {
    return syntax;
  }
  const markers: CodeMarker[] = [];
  for (const match of blankStrings(expression).matchAll(IDENTIFIER_REGEX)) {
    const name = match[1];
    if (RESERVED_VARIABLE_NAMES.includes(name) || knownVariables.has(name)) {
      continue;
    }
    markers.push({
      severity: 'error',
      message: `Unknown variable "${name}"`,
      startOffset: match.index,
      endOffset: match.index + name.length,
    });
  }
  return markers;
};

// The instance's own properties, which a filter reaches on any view; type only where the view has none.
const KNOWN_FILTER_PROPS = new Set([
  ...INSTANCE_PROPERTIES.map(({ name }) => name),
  'version',
  'type',
]);

/** Matches `prop<op>` at the start of the filter or right after a `,` or `{`. */
const FILTER_PAIR_REGEX = /(?:^|[,{])\s*([A-Za-z0-9_.]+)\s*(?==~|!~|!=|>=|<=|\^=|[=<>])/g;

/**
 * Markers for a variable's filter: one syntax error, or a warning for every
 * property the view does not declare. `knownProperties` undefined skips the
 * second pass (e.g. while the view schema is still loading).
 */
export const computeFilterMarkers = (
  filter: string,
  knownProperties?: Set<string>
): CodeMarker[] => {
  const syntax = syntaxMarker(filter, validateFilter(filter), 'the filter');
  if (syntax.length || !knownProperties) {
    return syntax;
  }
  const markers: CodeMarker[] = [];
  for (const match of blankStrings(filter).matchAll(FILTER_PAIR_REGEX)) {
    const prop = match[1];
    const root = prop.split('.')[0];
    if (KNOWN_FILTER_PROPS.has(root) || knownProperties.has(root)) {
      continue;
    }
    const startOffset = match.index + match[0].indexOf(prop);
    markers.push({
      severity: 'warning',
      message: `The view has no property "${root}"`,
      startOffset,
      endOffset: startOffset + prop.length,
    });
  }
  return markers;
};

