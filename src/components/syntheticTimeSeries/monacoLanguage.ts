/**
 * Registers the two languages of the Synthetic time series tab with Monaco:
 * the expression over variables, and a variable's filter on view properties.
 * Registration is global to the Monaco instance and idempotent; per-editor
 * completion context is supplied through setSyntheticModelContext.
 */
import type { Monaco } from '@grafana/ui';
import {
  EXPRESSION_FUNCTIONS,
  provideExpressionCompletions,
  provideFilterCompletions,
} from './completions';
import { SYNTHETIC_EXPRESSION_LANG_ID, SYNTHETIC_FILTER_LANG_ID } from './languageIds';

const VARIABLE_TOKEN = /\$\{\w+(:\w+)?\}|\$\w+|\[\[\w+\]\]/;
const STRING_TOKENS: Array<[RegExp, string]> = [
  [/'([^'\\]|\\.)*'/, 'string'],
  [/"([^"\\]|\\.)*"/, 'string'],
];
const NUMBER_TOKEN = /\d+(\.\d+)?([eE][+-]?\d+)?/;

const registered = (monaco: Monaco, id: string) =>
  monaco.languages.getLanguages().some((language) => language.id === id);

const registerExpressionLanguage = (monaco: Monaco) => {
  monaco.languages.register({ id: SYNTHETIC_EXPRESSION_LANG_ID });
  monaco.languages.setLanguageConfiguration(SYNTHETIC_EXPRESSION_LANG_ID, {
    brackets: [
      ['(', ')'],
      ['[', ']'],
    ],
    autoClosingPairs: [
      { open: '(', close: ')' },
      { open: '[', close: ']' },
      { open: "'", close: "'" },
    ],
  });
  monaco.languages.setMonarchTokensProvider(SYNTHETIC_EXPRESSION_LANG_ID, {
    ignoreCase: false,
    functions: EXPRESSION_FUNCTIONS.map(({ name }) => name),
    tokenizer: {
      root: [
        [
          /[a-zA-Z_]\w*(?=\s*\()/,
          { cases: { '@functions': 'support.function', '@default': 'identifier' } },
        ],
        [VARIABLE_TOKEN, 'variable'],
        [/[a-zA-Z_]\w*/, 'variable.name'],
        [/[()]/, 'delimiter.parenthesis'],
        [/[+\-*/]/, 'operators'],
        [NUMBER_TOKEN, 'number'],
        ...STRING_TOKENS,
        [/[[\],]/, 'delimiter'],
      ],
    },
  } as any);
  monaco.languages.registerCompletionItemProvider(SYNTHETIC_EXPRESSION_LANG_ID, {
    triggerCharacters: ['$'],
    provideCompletionItems: (model, position) =>
      provideExpressionCompletions(monaco, model, position),
  });
};

const registerFilterLanguage = (monaco: Monaco) => {
  monaco.languages.register({ id: SYNTHETIC_FILTER_LANG_ID });
  monaco.languages.setLanguageConfiguration(SYNTHETIC_FILTER_LANG_ID, {
    brackets: [
      ['{', '}'],
      ['[', ']'],
    ],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: "'", close: "'" },
      { open: '"', close: '"' },
    ],
  });
  monaco.languages.setMonarchTokensProvider(SYNTHETIC_FILTER_LANG_ID, {
    ignoreCase: false,
    tokenizer: {
      root: [
        [VARIABLE_TOKEN, 'variable'],
        [/[a-zA-Z0-9_.]+(?=\s*(=~|!~|!=|>=|<=|\^=|[=<>]))/, 'attribute.name'],
        [/=~|!~|!=|>=|<=|\^=|[=<>]/, 'operators'],
        ...STRING_TOKENS,
        [NUMBER_TOKEN, 'number'],
        [/\btrue\b|\bfalse\b|\bnull\b/, 'keyword'],
        [/[{}]/, 'delimiter.curly'],
        [/[[\],]/, 'delimiter'],
      ],
    },
  } as any);
  monaco.languages.registerCompletionItemProvider(SYNTHETIC_FILTER_LANG_ID, {
    // Not the quote: a popup right after a typed value would swallow the Enter that commits the row.
    triggerCharacters: [',', '=', '$', '{'],
    provideCompletionItems: (model, position) => provideFilterCompletions(monaco, model, position),
  });
};

export const ensureSyntheticLanguages = (monaco: Monaco): void => {
  if (!registered(monaco, SYNTHETIC_EXPRESSION_LANG_ID)) {
    registerExpressionLanguage(monaco);
  }
  if (!registered(monaco, SYNTHETIC_FILTER_LANG_ID)) {
    registerFilterLanguage(monaco);
  }
};
