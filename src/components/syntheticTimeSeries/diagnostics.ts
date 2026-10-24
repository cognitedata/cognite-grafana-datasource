/**
 * Live diagnostics for the Synthetic time series editors: syntax errors from
 * the nearley grammars, unknown variables in the expression, and filter
 * properties the selected view does not declare.
 */
import type { Monaco, monacoTypes } from '@grafana/ui';
import { validateExpression, validateFilter } from '../../parser/dms';
import { RESERVED_VARIABLE_NAMES } from '../../parser/dms/variables';
import { INSTANCE_PROPERTIES } from '../../cdf/instanceProperties';

const DEBOUNCE_MS = 300;

export interface SyntheticMarker {
  severity: 'error' | 'warning';
  message: string;
  startOffset: number;
  endOffset: number;
}

const syntaxMarker = (
  text: string,
  error: { offset: number; message: string } | null,
  what: string
): SyntheticMarker[] =>
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
): SyntheticMarker[] => {
  const syntax = syntaxMarker(expression, validateExpression(expression), 'the expression');
  if (syntax.length || !knownVariables) {
    return syntax;
  }
  const markers: SyntheticMarker[] = [];
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
): SyntheticMarker[] => {
  const syntax = syntaxMarker(filter, validateFilter(filter), 'the filter');
  if (syntax.length || !knownProperties) {
    return syntax;
  }
  const markers: SyntheticMarker[] = [];
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

const toMonacoMarkers = (
  monaco: Monaco,
  model: monacoTypes.editor.ITextModel,
  markers: SyntheticMarker[]
): monacoTypes.editor.IMarkerData[] =>
  markers.map(({ severity, message, startOffset, endOffset }) => {
    const start = model.getPositionAt(startOffset);
    const end = model.getPositionAt(endOffset);
    return {
      severity: severity === 'error' ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning,
      message,
      startLineNumber: start.lineNumber,
      startColumn: start.column,
      endLineNumber: end.lineNumber,
      endColumn: end.column,
    };
  });

/**
 * Attaches debounced validation to an editor. Returns a disposer; call it when
 * the editor unmounts. `compute` is called with the current text, so markers
 * follow view or variable changes without rewiring.
 */
export const wireDiagnostics = (
  editor: monacoTypes.editor.IStandaloneCodeEditor,
  monaco: Monaco,
  compute: (text: string) => SyntheticMarker[],
  owner: string
): (() => void) => {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const validate = () => {
    const model = editor.getModel();
    if (!model) {
      return;
    }
    monaco.editor.setModelMarkers(
      model,
      owner,
      toMonacoMarkers(monaco, model, compute(model.getValue()))
    );
  };
  const subscription = editor.onDidChangeModelContent(() => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(validate, DEBOUNCE_MS);
  });
  validate();
  return () => {
    if (timeout) {
      clearTimeout(timeout);
    }
    subscription.dispose();
    const model = editor.getModel();
    if (model) {
      monaco.editor.setModelMarkers(model, owner, []);
    }
  };
};
