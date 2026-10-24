jest.mock('@grafana/runtime', () => ({
  getTemplateSrv: () => ({ getVariables: () => [{ name: 'tag' }] }),
}));

import {
  clearSyntheticModelContext,
  detectFilterContext,
  EXPRESSION_FUNCTIONS,
  provideFilterCompletions,
  setSyntheticModelContext,
} from '../components/syntheticTimeSeries/completions';
import {
  computeExpressionMarkers,
  computeFilterMarkers,
} from '../components/syntheticTimeSeries/diagnostics';
import { wireDiagnostics } from '../components/common/monacoDiagnostics';
import { RESERVED_VARIABLE_NAMES } from '../parser/dms/variables';

it('offers exactly the function names a variable may not take', () => {
  expect(EXPRESSION_FUNCTIONS.map(({ name }) => name).sort()).toEqual(
    [...RESERVED_VARIABLE_NAMES].sort()
  );
});

describe('expression markers', () => {
  const messages = (expression: string, known = ['A', 'B']) =>
    computeExpressionMarkers(expression, new Set(known)).map(({ message }) => message);

  it('reports one syntax error, or every unknown variable', () => {
    expect(messages('A +')).toEqual(['Unexpected end of input in the expression']);
    expect(messages('A + C * D')).toEqual(['Unknown variable "C"', 'Unknown variable "D"']);
  });

  it('leaves out functions, numbers, strings and dashboard variables', () => {
    expect(messages('avg(A) * 1e3 + pi()')).toEqual([]);
    expect(messages("map(A, ['C'], [1], 0)")).toEqual([]);
    expect(messages('A * $factor + [[offset]] + ${scale:raw}')).toEqual([]);
  });

  it('points at the name it reports', () => {
    expect(computeExpressionMarkers('A + C', new Set(['A']))).toEqual([
      { severity: 'error', message: 'Unknown variable "C"', startOffset: 4, endOffset: 5 },
    ]);
  });
});

describe('filter markers', () => {
  const view = new Set(['name', 'isStep', 'unit']);
  const messages = (filter: string, known = view) =>
    computeFilterMarkers(filter, known).map(({ message }) => message);

  it('warns about properties the view does not have', () => {
    expect(messages("name='a', pressure>2")).toEqual(['The view has no property "pressure"']);
  });

  it('knows the instance properties, nested paths and quoted text', () => {
    expect(messages("space='s', version=2, type='numeric', unit.externalId!='x'")).toEqual([]);
    expect(messages("name='a, pressure=2'")).toEqual([]);
  });

  it('warns about nothing while the view is unknown', () => {
    expect(computeFilterMarkers('pressure>2', undefined)).toEqual([]);
  });
});

describe('filter completion context', () => {
  it('expects a property at the start, after a comma, and inside an object', () => {
    expect(detectFilterContext('')).toBe('property');
    expect(detectFilterContext("name='a', ")).toBe('property');
    expect(detectFilterContext("name='a', assets={space='s'}, ")).toBe('property');
  });

  it('expects the keys of an instance reference inside a {...} value', () => {
    expect(detectFilterContext('assets={')).toBe('reference');
    expect(detectFilterContext("assets={space='s', ")).toBe('reference');
    expect(detectFilterContext("assets=[{space='s', ")).toBe('reference');
    expect(detectFilterContext('assets={space=')).toBe('value');
  });

  it('expects a value after an operator and inside a list', () => {
    expect(detectFilterContext('name=')).toBe('value');
    expect(detectFilterContext("name=['a', ")).toBe('value');
    expect(detectFilterContext("name='a, b', tag=")).toBe('value');
  });
});

describe('diagnostics wiring', () => {
  const fakeEditor = (text: string) => {
    let listener = () => {};
    const model = {
      getValue: () => text,
      getPositionAt: (offset: number) => ({ lineNumber: 1, column: offset + 1 }),
    };
    return {
      editor: {
        getModel: () => model,
        onDidChangeModelContent: (callback: () => void) => {
          listener = callback;
          return { dispose: () => (listener = () => {}) };
        },
      } as any,
      model,
      type: () => listener(),
    };
  };
  const fakeMonaco = () =>
    ({ editor: { setModelMarkers: jest.fn() }, MarkerSeverity: { Error: 8, Warning: 4 } }) as any;

  it('marks at once, again after typing settles, and clears on dispose', () => {
    jest.useFakeTimers();
    const { editor, model, type } = fakeEditor('A + C');
    const monaco = fakeMonaco();
    const dispose = wireDiagnostics(
      editor,
      monaco,
      (text) => computeExpressionMarkers(text, new Set(['A'])),
      'owner'
    );
    expect(monaco.editor.setModelMarkers).toHaveBeenLastCalledWith(model, 'owner', [
      expect.objectContaining({
        severity: 8,
        message: 'Unknown variable "C"',
        startColumn: 5,
        endColumn: 6,
      }),
    ]);
    type();
    type();
    jest.advanceTimersByTime(300);
    expect(monaco.editor.setModelMarkers).toHaveBeenCalledTimes(2);
    dispose();
    expect(monaco.editor.setModelMarkers).toHaveBeenLastCalledWith(model, 'owner', []);
    jest.useRealTimers();
  });
});

describe('filter completions', () => {
  const monaco = {
    languages: { CompletionItemKind: { Field: 3, Variable: 4, Value: 5 } },
  } as any;
  const model = (text: string) =>
    ({
      uri: { toString: () => 'filter-model' },
      getValueInRange: ({ startColumn, endColumn }: any) =>
        text.slice(Math.max(startColumn - 1, 0), endColumn - 1),
      getWordUntilPosition: () => {
        const word = /\w*$/.exec(text)![0];
        return { startColumn: text.length - word.length + 1, endColumn: text.length + 1 };
      },
    }) as any;
  const suggest = (text: string) =>
    provideFilterCompletions(monaco, model(text), { lineNumber: 1, column: text.length + 1 } as any)
      .suggestions;
  const labels = (text: string) => suggest(text).map(({ label }) => label);

  beforeEach(() =>
    setSyntheticModelContext('filter-model', {
      properties: [
        { name: 'name', type: 'text' },
        { name: 'isStep', type: 'boolean' },
      ],
    })
  );
  afterEach(() => clearSyntheticModelContext('filter-model'));

  it('offers the view properties, then values after an operator', () => {
    expect(labels('')).toEqual(['name', 'isStep', '$tag']);
    expect(labels('name=')).toEqual(['$tag', 'null']);
    expect(labels('isStep=')).toEqual(['$tag', 'true', 'false', 'null']);
    clearSyntheticModelContext('filter-model');
    expect(labels('')).toEqual(['$tag']);
  });

  it('offers the keys of an instance reference inside {...}', () => {
    expect(labels('assets={')).toEqual(['space', 'externalId']);
  });

  it('replaces a $ already typed when a dashboard variable is picked', () => {
    const [variable] = suggest('name=$ta');
    expect(variable.insertText).toBe('$tag');
    expect((variable.range as any).startColumn).toBe('name=$'.length);
    const [atDollar] = suggest('name=$');
    expect((atDollar.range as any).startColumn).toBe('name=$'.length);
  });
});
