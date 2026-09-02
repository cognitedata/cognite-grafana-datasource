import { CodeEditorSuggestionItem, CodeEditorSuggestionItemKind, MonacoEditor } from '@grafana/ui';
import { GraphQLSchema } from 'graphql';
import {
  CompletionItem,
  getAutocompleteSuggestions,
  Position,
  Range as GqlRange,
} from 'graphql-language-service';

/** Format the text, adds icon and returns in format that monaco editor expects */
const toCompletionItem = (
  entry: CompletionItem,
  range?: GqlRange
): CodeEditorSuggestionItem => {
  const results = {
    label: entry.label,
    insertText: entry.insertText || entry.label,
    insertTextFormat: entry.insertTextFormat,
    sortText: entry.sortText,
    filterText: entry.filterText,
    documentation: entry.documentation,
    detail: entry.detail,
    range: range ? toMonacoRange(range) : undefined,
    kind: CodeEditorSuggestionItemKind.Property,
  };
  if (entry.insertTextFormat) {
    results.insertTextFormat = entry.insertTextFormat;
  }

  return results;
};

const toMonacoRange = (range: GqlRange) => {
  return {
    startLineNumber: range.start.line + 1,
    startColumn: range.start.character + 1,
    endLineNumber: range.end.line + 1,
    endColumn: range.end.character + 1,
  };
};

/**
 * Schema-aware completions at the editor's caret. Returns nothing until both the
 * introspected schema and the mounted editor are available, so the code editor is
 * usable before the model has been picked.
 */
export const getGraphqlSuggestions = (
  schema?: GraphQLSchema,
  editor?: MonacoEditor
): CodeEditorSuggestionItem[] => {
  if (!schema || !editor) {
    return [];
  }
  const position = editor.getPosition();
  const model = editor.getModel();
  if (!position || !model) {
    return [];
  }
  return getAutocompleteSuggestions(
    schema,
    model.getValue(),
    new Position(position.lineNumber - 1, position.column - 1)
  ).map((el) => toCompletionItem(el));
};
