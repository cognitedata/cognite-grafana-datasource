import { CodeEditorSuggestionItem, CodeEditorSuggestionItemKind, MonacoEditor } from '@grafana/ui';
import { GraphQLSchema } from 'graphql';
import {
  CompletionItem,
  CompletionItemKind,
  DIAGNOSTIC_SEVERITY,
  getAutocompleteSuggestions,
  getDiagnostics,
  Position,
  Range as GqlRange,
} from 'graphql-language-service';
import type { CodeMarker } from './common/monacoDiagnostics';

/** The nearest of the few kinds Grafana's code editor shows, so fields, arguments and values look apart. */
const suggestionKind = (kind?: CompletionItemKind): CodeEditorSuggestionItemKind => {
  switch (kind) {
    case CompletionItemKind.Field:
      return CodeEditorSuggestionItemKind.Field;
    case CompletionItemKind.Function:
    case CompletionItemKind.Method:
      return CodeEditorSuggestionItemKind.Method;
    case CompletionItemKind.EnumMember:
    case CompletionItemKind.Enum:
    case CompletionItemKind.Value:
    case CompletionItemKind.Constant:
      return CodeEditorSuggestionItemKind.Constant;
    case CompletionItemKind.Keyword:
    case CompletionItemKind.Snippet:
    case CompletionItemKind.Class:
    case CompletionItemKind.Interface:
    case CompletionItemKind.TypeParameter:
      return CodeEditorSuggestionItemKind.Text;
    default:
      return CodeEditorSuggestionItemKind.Property;
  }
};

/** Format the text, adds icon and returns in format that monaco editor expects */
const toCompletionItem = (entry: CompletionItem, range?: GqlRange): CodeEditorSuggestionItem => {
  const results = {
    label: entry.label,
    insertText: entry.insertText || entry.label,
    insertTextFormat: entry.insertTextFormat,
    sortText: entry.sortText,
    filterText: entry.filterText,
    documentation: entry.documentation,
    detail: entry.detail,
    range: range ? toMonacoRange(range) : undefined,
    kind: suggestionKind(entry.kind),
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

/**
 * A function from a 0-based line and column to the character offset in the text. A
 * column past the line's end (the language service ends some ranges one past) stays
 * on that line.
 */
const offsetsOf = (text: string) => {
  const lines = text.split('\n');
  const lineStarts = [0];
  lines.forEach((line) => lineStarts.push(lineStarts[lineStarts.length - 1] + line.length + 1));
  return (line: number, character: number): number =>
    Math.min(
      text.length,
      lineStarts[Math.min(line, lines.length)] + Math.min(character, lines[line]?.length ?? 0)
    );
};

/**
 * Dashboard variables written `${name}`, `${name:format}` or `[[name]]` become
 * `$name` padded with spaces, so they parse as GraphQL variables at the same offsets.
 */
const maskDashboardVariables = (text: string): string =>
  text.replace(/\$\{(\w+)(?::[^}]*)?\}|\[\[(\w+)(?::[^\]]*)?\]\]/g, (match, braced, bracketed) => {
    const name = `$${braced ?? bracketed}`;
    return name + ' '.repeat(match.length - name.length);
  });

/**
 * Grafana replaces `$name` before the query is sent, so a variable the operation
 * doesn't declare is a dashboard variable, not a mistake.
 */
const isUndefinedVariable = (message: string) => /^Variable "\$\w+" is not defined/.test(message);

const SEVERITIES: Record<number, CodeMarker['severity']> = {
  [DIAGNOSTIC_SEVERITY.Error]: 'error',
  [DIAGNOSTIC_SEVERITY.Warning]: 'warning',
  [DIAGNOSTIC_SEVERITY.Information]: 'info',
  [DIAGNOSTIC_SEVERITY.Hint]: 'hint',
};

/**
 * Problems in the query as the user types it: syntax errors always, and fields or
 * arguments the data model does not have once its schema is known. Dashboard
 * variables are not marked.
 */
export const getGraphqlMarkers = (text: string, schema?: GraphQLSchema): CodeMarker[] => {
  if (!text.trim()) {
    return [];
  }
  const offsetAt = offsetsOf(text);
  return getDiagnostics(maskDashboardVariables(text), schema)
    .filter(({ message }) => !isUndefinedVariable(message))
    .map(({ range, message, severity }) => {
      const startOffset = offsetAt(range.start.line, range.start.character);
      let endOffset = Math.max(offsetAt(range.end.line, range.end.character), startOffset + 1);
      // Validation ranges end one past the token: keep the underline off the space after it.
      while (endOffset > startOffset + 1 && /\s/.test(text[endOffset - 1])) {
        endOffset--;
      }
      return {
        severity: SEVERITIES[severity ?? DIAGNOSTIC_SEVERITY.Error] ?? 'warning',
        message,
        startOffset,
        endOffset,
      };
    });
};
