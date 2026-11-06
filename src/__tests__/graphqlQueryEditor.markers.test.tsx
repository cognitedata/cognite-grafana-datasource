import React from 'react';
import { act, render } from '@testing-library/react';
import { buildSchema, GraphQLSchema } from 'graphql';
import { GraphqlQueryEditor } from '../components/graphql/GraphqlQueryEditor';

const schema = buildSchema(`
  type Pump { name: String }
  type Query { listPump: [Pump] }
`);

let mockSchema: GraphQLSchema | undefined;
jest.mock('../components/graphql/useGraphqlSchema', () => ({
  useGraphqlSchema: () => ({ schema: mockSchema }),
}));
jest.mock('../components/graphql/useGraphqlDataModels', () => ({
  useGraphqlDataModels: () => ({
    dataModelOptions: [],
    versions: [],
    loadingDataModels: false,
    loadingVersions: false,
  }),
}));
jest.mock('../components/graphql/useGraphqlPreview', () => ({
  useGraphqlPreview: () => ({ isRunning: false, canRun: false, run: jest.fn() }),
}));

const QUERY = '{ listPump { flow } }';
const dispose = jest.fn();
const commands: Array<{ keys: number; run: () => void }> = [];
const model = {
  getValue: () => QUERY,
  getPositionAt: (offset: number) => ({ lineNumber: 1, column: offset + 1 }),
};
const mockEditor = {
  getModel: () => model,
  getValue: () => QUERY,
  onDidChangeModelContent: () => ({ dispose }),
  addCommand: (keys: number, run: () => void) => commands.push({ keys, run }),
};
const mockMonaco = {
  editor: { setModelMarkers: jest.fn() },
  MarkerSeverity: { Error: 8, Warning: 4, Info: 2, Hint: 1 },
  KeyCode: { Enter: 3 },
  KeyMod: { Shift: 1024 },
};

jest.mock('@grafana/ui', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    ...jest.requireActual('@grafana/ui'),
    // Monaco does not resolve under jest: the query editor mounts on the stubs above.
    CodeEditor: ({ language, onEditorDidMount }: any) => {
      useEffect(() => {
        if (language === 'graphql') {
          onEditorDidMount?.(mockEditor, mockMonaco);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);
      return null;
    },
  };
});

const renderEditor = (onQueryChange = jest.fn()) => {
  const props = {
    datasource: {} as any,
    refId: 'A',
    dataModel: { space: 'sp', externalId: 'model', version: '1' },
    graphqlQuery: QUERY,
    onDataModelChange: jest.fn(),
    onVersionChange: jest.fn(),
    onQueryChange,
  };
  const view = render(<GraphqlQueryEditor {...props} />);
  return { ...view, rerenderWith: () => view.rerender(<GraphqlQueryEditor {...props} />) };
};

/** The marker messages of the last check. */
const lastMarkers = (): string[] =>
  mockMonaco.editor.setModelMarkers.mock.calls
    .filter(([, owner]: any[]) => owner === 'graphql-A')
    .at(-1)?.[2]
    .map(({ message }: any) => message);

beforeEach(() => {
  mockSchema = undefined;
  commands.length = 0;
  dispose.mockClear();
  mockMonaco.editor.setModelMarkers.mockClear();
});

describe('GraphqlQueryEditor markers', () => {
  it('checks the text again when the schema arrives', () => {
    const { rerenderWith } = renderEditor();
    expect(lastMarkers()).toEqual([]);
    mockSchema = schema;
    act(() => rerenderWith());
    expect(lastMarkers()).toEqual([expect.stringMatching(/flow/)]);
  });

  it('saves the text on Shift+Enter', () => {
    const onQueryChange = jest.fn();
    renderEditor(onQueryChange);
    const shiftEnter = commands.find(({ keys }) => keys === (1024 | 3));
    shiftEnter!.run();
    expect(onQueryChange).toHaveBeenCalledWith(QUERY);
  });

  it('stops checking and clears its markers on unmount', () => {
    const { unmount } = renderEditor();
    unmount();
    expect(dispose).toHaveBeenCalled();
    expect(lastMarkers()).toEqual([]);
  });
});
