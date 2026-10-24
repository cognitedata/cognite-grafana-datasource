/**
 * Completions for the two editors of the Synthetic time series tab. The
 * providers are registered once per Monaco instance (languages are global), so
 * per-editor context — the selected view's properties, the declared variable
 * names and the dashboard's template variables — is looked up from a registry
 * keyed by the editor model's URI.
 */
import { getTemplateSrv } from '@grafana/runtime';
import type { Monaco, monacoTypes } from '@grafana/ui';

export interface SyntheticPropertyMeta {
  name: string;
  /** DMS property type identifier, e.g. text, float64, boolean, enum, direct */
  type?: string;
  description?: string;
}

export interface SyntheticModelContext {
  /** The view's properties, for a filter editor. */
  properties?: SyntheticPropertyMeta[];
  /** The declared variable names, for the expression editor. */
  variables?: string[];
}

const modelContexts = new Map<string, SyntheticModelContext>();

export const setSyntheticModelContext = (
  modelUri: string,
  context: SyntheticModelContext
): void => {
  modelContexts.set(modelUri, context);
};

export const clearSyntheticModelContext = (modelUri: string): void => {
  modelContexts.delete(modelUri);
};

const contextOf = (model: monacoTypes.editor.ITextModel): SyntheticModelContext =>
  modelContexts.get(model.uri.toString()) ?? {};

/** Read when suggesting, so a dashboard variable added while the editor is open is offered. */
const dashboardVariables = (): string[] =>
  getTemplateSrv()
    .getVariables()
    .map(({ name }) => name);

export const EXPRESSION_FUNCTIONS = [
  { name: 'sin', snippet: 'sin($0)' },
  { name: 'cos', snippet: 'cos($0)' },
  { name: 'ln', snippet: 'ln($0)' },
  { name: 'sqrt', snippet: 'sqrt($0)' },
  { name: 'exp', snippet: 'exp($0)' },
  { name: 'abs', snippet: 'abs($0)' },
  { name: 'pow', snippet: 'pow($1, $2)' },
  { name: 'round', snippet: 'round($1, $2)' },
  { name: 'on_error', snippet: 'on_error($1, $2)' },
  { name: 'avg', snippet: 'avg($0)' },
  { name: 'sum', snippet: 'sum($0)' },
  { name: 'min', snippet: 'min($0)' },
  { name: 'max', snippet: 'max($0)' },
  { name: 'map', snippet: "map($1, ['$2'], [$3], $4)" },
  { name: 'pi', snippet: 'pi()' },
];

/** What goes where the cursor is: a property, a value, or a key of a `{space, externalId}` value. */
export type FilterContextKind = 'property' | 'value' | 'reference';

const OPERATOR_BEFORE = /([A-Za-z0-9_.]+)\s*(?:=~|!~|!=|>=|<=|\^=|[=<>])[^,]*$/;
const blankQuoted = (text: string) => text.replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/g, "''");

/**
 * Inside a filter, everything after a comparator up to the next comma is the
 * value position, and so is every item of a list. Inside a `{...}` value the
 * keys of an instance reference go; anywhere else, a property name.
 */
export const detectFilterContext = (textBefore: string): FilterContextKind => {
  const text = blankQuoted(textBefore);
  const openList = text.lastIndexOf('[') > text.lastIndexOf(']') ? text.lastIndexOf('[') : -1;
  const openObject = text.lastIndexOf('{') > text.lastIndexOf('}') ? text.lastIndexOf('{') : -1;
  if (openObject > openList) {
    return OPERATOR_BEFORE.test(text.slice(openObject)) ? 'value' : 'reference';
  }
  if (openList >= 0) {
    return 'value';
  }
  return OPERATOR_BEFORE.test(text) ? 'value' : 'property';
};

/** The property a value is being written for, as typed before its operator. */
const propertyBefore = (textBefore: string): string | undefined =>
  OPERATOR_BEFORE.exec(blankQuoted(textBefore))?.[1];

const textBefore = (model: monacoTypes.editor.ITextModel, position: monacoTypes.Position) =>
  model.getValueInRange({
    startLineNumber: 1,
    startColumn: 1,
    endLineNumber: position.lineNumber,
    endColumn: position.column,
  });

const wordRange = (model: monacoTypes.editor.ITextModel, position: monacoTypes.Position) => {
  const word = model.getWordUntilPosition(position);
  return {
    startLineNumber: position.lineNumber,
    endLineNumber: position.lineNumber,
    startColumn: word.startColumn,
    endColumn: word.endColumn,
  };
};

/** The word range, widened over a `$` typed before it, which a dashboard variable replaces too. */
const variableRange = (model: monacoTypes.editor.ITextModel, position: monacoTypes.Position) => {
  const range = wordRange(model, position);
  const before = model.getValueInRange({
    ...range,
    startColumn: range.startColumn - 1,
    endColumn: range.startColumn,
  });
  return before === '$' ? { ...range, startColumn: range.startColumn - 1 } : range;
};

const sort = (group: number, i: number) => `${group}${String(i).padStart(3, '0')}`;

const templateVariableItems = (
  monaco: Monaco,
  model: monacoTypes.editor.ITextModel,
  position: monacoTypes.Position
): monacoTypes.languages.CompletionItem[] => {
  const range = variableRange(model, position);
  return dashboardVariables().map((name, i) => ({
    label: `$${name}`,
    kind: monaco.languages.CompletionItemKind.Variable,
    insertText: `$${name}`,
    detail: 'Dashboard variable',
    sortText: sort(3, i),
    range,
  }));
};

export const provideExpressionCompletions = (
  monaco: Monaco,
  model: monacoTypes.editor.ITextModel,
  position: monacoTypes.Position
): monacoTypes.languages.CompletionList => {
  const { variables = [] } = contextOf(model);
  const range = wordRange(model, position);
  const { CompletionItemKind, CompletionItemInsertTextRule } = monaco.languages;
  return {
    suggestions: [
      ...variables.map((name, i) => ({
        label: name,
        kind: CompletionItemKind.Variable,
        insertText: name,
        detail: 'Variable',
        sortText: sort(0, i),
        range,
      })),
      ...EXPRESSION_FUNCTIONS.map((func, i) => ({
        label: `${func.name}()`,
        kind: CompletionItemKind.Function,
        insertText: func.snippet,
        insertTextRules: CompletionItemInsertTextRule.InsertAsSnippet,
        sortText: sort(1, i),
        range,
      })),
      ...templateVariableItems(monaco, model, position),
    ],
  };
};

export const provideFilterCompletions = (
  monaco: Monaco,
  model: monacoTypes.editor.ITextModel,
  position: monacoTypes.Position
): monacoTypes.languages.CompletionList => {
  const { properties = [] } = contextOf(model);
  const range = wordRange(model, position);
  const { CompletionItemKind } = monaco.languages;
  const before = textBefore(model, position);
  const context = detectFilterContext(before);
  if (context === 'reference') {
    return {
      suggestions: ['space', 'externalId'].map((key, i) => ({
        label: key,
        kind: CompletionItemKind.Field,
        insertText: key,
        detail: 'Instance reference',
        sortText: sort(0, i),
        range,
      })),
    };
  }
  if (context === 'value') {
    // true and false only for a boolean property; null checks whether any property is set.
    const type = properties.find(({ name }) => name === propertyBefore(before))?.type;
    const values = type === 'boolean' ? ['true', 'false', 'null'] : ['null'];
    return {
      suggestions: [
        ...templateVariableItems(monaco, model, position),
        ...values.map((value, i) => ({
          label: value,
          kind: CompletionItemKind.Value,
          insertText: value,
          detail:
            value === 'null' ? 'Use with = or != to check whether the property is set' : undefined,
          sortText: sort(1, i),
          range,
        })),
      ],
    };
  }
  return {
    suggestions: [
      ...properties.map((prop, i) => ({
        label: prop.name,
        kind: CompletionItemKind.Field,
        insertText: prop.name,
        detail: prop.type,
        documentation: prop.description,
        sortText: sort(0, i),
        range,
      })),
      ...templateVariableItems(monaco, model, position),
    ],
  };
};
