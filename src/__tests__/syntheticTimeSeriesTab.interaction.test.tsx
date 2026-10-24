import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { dateTime } from '@grafana/data';
import { SyntheticTimeSeriesTab } from '../components/syntheticTimeSeriesTab';
import { CdmSyntheticQuery, CogniteQuery, defaultQuery } from '../types';
import { getMockedDataSource } from '../test_utils';

jest.mock('@grafana/runtime');

const setValue = jest.fn();
// Counts real mounts per editor language, so a test can tell a remount from a re-render.
const mockEditorMounts = jest.fn();
// Set by a test to mount the editors with a Monaco stub, so the markers they set can be read.
let mockMonaco: any = null;
let mockModelCount = 0;

// Monaco does not run under jsdom; a textarea keeps the commit-on-blur contract testable.
jest.mock('@grafana/ui', () => {
  const actual = jest.requireActual('@grafana/ui');
  return {
    ...actual,
    CodeEditor: ({ value, language, onBlur, onEditorDidMount }: any) => {
      const { useEffect } = require('react');
      useEffect(() => {
        mockEditorMounts(language);
        const model = mockMonaco && {
          uri: { toString: () => `${language}:${(mockModelCount += 1)}` },
          getValue: () => value,
          getPositionAt: (offset: number) => ({ lineNumber: 1, column: offset + 1 }),
          onDidChangeContent: () => ({ dispose() {} }),
        };
        onEditorDidMount?.(
          {
            getValue: () => value,
            setValue,
            getModel: () => model,
            addCommand: () => null,
            onDidChangeModelContent: () => ({ dispose() {} }),
            onDidContentSizeChange: () => ({ dispose() {} }),
            getContentHeight: () => 20,
            getLayoutInfo: () => ({ width: 400 }),
            layout: () => null,
            updateOptions: () => null,
          },
          mockMonaco
        );
        // Mount only, as Monaco calls it once per editor.
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);
      return (
        <textarea
          data-testid={language === 'cognite-synthetic-filter' ? 'filter-editor' : 'code-editor'}
          defaultValue={value}
          onBlur={({ currentTarget }) => onBlur?.(currentTarget.value)}
        />
      );
    },
  };
});

const VIEW = { space: 'cdf_cdm', externalId: 'CogniteTimeSeries', version: 'v1' };
const VIEW_PROPERTIES = {
  name: { type: { type: 'text' } },
  isStep: { type: { type: 'boolean' } },
};

const answer = (url: string) => {
  if (url.endsWith('/models/views/byids')) {
    return { items: [{ ...VIEW, properties: VIEW_PROPERTIES }] };
  }
  if (url.endsWith('/models/containers/inspect')) {
    return {
      items: [
        {
          space: 'cdf_cdm',
          externalId: 'CogniteTimeSeries',
          inspectionResults: { involvedViews: [VIEW] },
        },
      ],
    };
  }
  if (url.endsWith('/models/instances/search')) {
    return {
      items: [
        {
          instanceType: 'node',
          space: 'cdm_try',
          externalId: 'ts-1',
          properties: {
            cdf_cdm: {
              'CogniteTimeSeries/v1': {
                name: 'Temp 1',
                type: 'numeric',
                unit: { externalId: 'temperature:deg_c' },
              },
            },
          },
        },
      ],
    };
  }
  if (url.endsWith('/models/instances/byids')) {
    return {
      items: [
        {
          properties: {
            cdf_cdm: {
              'CogniteTimeSeries/v1': {
                type: 'numeric',
                unit: { externalId: 'temperature:deg_c' },
              },
            },
          },
        },
      ],
    };
  }
  if (url.endsWith('/models/instances/list')) {
    return {
      items: [
        {
          instanceType: 'node',
          space: 'cdm_try',
          externalId: 'ts-2',
          properties: { cdf_cdm: { 'CogniteTimeSeries/v1': { name: 'PT 2' } } },
        },
      ],
    };
  }
  if (url.endsWith('/units/systems')) {
    return { items: [{ name: 'SI' }, { name: 'Imperial' }] };
  }
  return { items: [] };
};

const expressionQuery = (patch: Partial<CdmSyntheticQuery>): CdmSyntheticQuery => ({
  version: 2,
  view: VIEW,
  variables: [{ name: 'A', mode: 'instance', aggregate: 'average' }],
  expression: '',
  ...patch,
});

const renderTab = async (patch: Partial<CogniteQuery> = {}) => {
  const fetcher = {
    fetch: jest.fn().mockImplementation(async ({ url }) => ({ status: 200, data: answer(url) })),
  };
  const onQueryChange = jest.fn();
  await act(async () => {
    render(
      <SyntheticTimeSeriesTab
        query={
          {
            ...defaultQuery,
            refId: 'A',
            aggregation: 'average',
            granularity: '',
            label: '',
            ...patch,
          } as CogniteQuery
        }
        onQueryChange={onQueryChange}
        connector={getMockedDataSource(fetcher).connector}
        intervalMs={60_000}
        range={{ from: dateTime(1000), to: dateTime(2000), raw: { from: 'now-1h', to: 'now' } }}
        timezone="utc"
      />
    );
  });
  return { onQueryChange, fetcher };
};

const lastPatch = (onQueryChange: jest.Mock) =>
  onQueryChange.mock.calls[onQueryChange.mock.calls.length - 1][0];

beforeEach(() => {
  setValue.mockClear();
  mockEditorMounts.mockClear();
});

const filterEditorMounts = () =>
  mockEditorMounts.mock.calls.filter(([language]) => language === 'cognite-synthetic-filter')
    .length;

/** The tab with its query kept in state, as Grafana's query row keeps it. */
const StatefulTab = ({
  initial,
  connector,
}: {
  initial: Partial<CogniteQuery>;
  connector: any;
}) => {
  const [query, setQuery] = React.useState({
    ...defaultQuery,
    refId: 'A',
    aggregation: 'average',
    granularity: '',
    label: '',
    ...initial,
  } as CogniteQuery);
  return (
    <SyntheticTimeSeriesTab
      query={query}
      onQueryChange={(patch) => setQuery((current) => ({ ...current, ...patch }) as CogniteQuery)}
      connector={connector}
      intervalMs={60_000}
      range={{ from: dateTime(1000), to: dateTime(2000), raw: { from: 'now-1h', to: 'now' } }}
      timezone="utc"
    />
  );
};

const mockedConnector = () =>
  getMockedDataSource({
    fetch: jest.fn().mockImplementation(async ({ url }) => ({ status: 200, data: answer(url) })),
  }).connector;

describe('SyntheticTimeSeriesTab', () => {
  it('opens on the default view with one picked-series variable and the shared field ids', async () => {
    await renderTab();
    await waitFor(() =>
      expect(screen.getByText('CogniteTimeSeries (cdf_cdm) v1')).toBeInTheDocument()
    );
    expect(document.getElementById('view-A')).not.toBeNull();
    expect(document.getElementById('variable-instance-A-0')).not.toBeNull();
    expect(document.getElementById('variable-aggregate-A-0')).not.toBeNull();
    expect(document.getElementById('granularity-auto-A')).not.toBeNull();
    expect(document.getElementById('label-A')).not.toBeNull();
    expect((screen.getByTestId('variable-name-A-0') as HTMLInputElement).value).toEqual('A');
    // The row's controls sit under column headers; Fixed is the picked-series mode.
    // "Aggregate" is also the Data points radio, so count the headers by their info icons.
    const headers = screen
      .getAllByTestId('info-circle')
      .map((icon) => icon.parentElement?.textContent);
    expect(headers).toEqual(expect.arrayContaining(['Time series', 'Aggregate', 'Unit']));
    // Granularity has a Fixed radio too, so look inside the variable's own mode group.
    const modeGroup = screen.getByRole('radiogroup', { name: 'Mode of variable A' });
    expect(within(modeGroup).getByRole('radio', { name: 'Fixed' })).toBeChecked();
  });

  it('adds a variable with the next free name and removes one', async () => {
    const { onQueryChange } = await renderTab();
    fireEvent.click(screen.getByTestId('variable-add-A'));
    expect(lastPatch(onQueryChange).cdmSyntheticQuery.variables.map((v: any) => v.name)).toEqual([
      'A',
      'B',
    ]);
    fireEvent.click(screen.getByTestId('variable-remove-A-0'));
    expect(lastPatch(onQueryChange).cdmSyntheticQuery.variables).toEqual([]);
  });

  it('renaming a variable rewrites the expression', async () => {
    const { onQueryChange } = await renderTab({
      cdmSyntheticQuery: expressionQuery({ expression: 'A * 2' }),
    });
    const name = screen.getByTestId('variable-name-A-0');
    fireEvent.change(name, { target: { value: 'pump' } });
    fireEvent.blur(name);
    expect(setValue).toHaveBeenCalledWith('pump * 2');
    expect(lastPatch(onQueryChange).cdmSyntheticQuery).toEqual(
      expect.objectContaining({
        expression: 'pump * 2',
        variables: [{ name: 'pump', mode: 'instance', aggregate: 'average' }],
      })
    );
  });

  it('flags an invalid name and keeps the expression', async () => {
    const { onQueryChange } = await renderTab({
      cdmSyntheticQuery: expressionQuery({ expression: 'A' }),
    });
    const name = screen.getByTestId('variable-name-A-0');
    fireEvent.change(name, { target: { value: 'avg' } });
    fireEvent.blur(name);
    expect(setValue).not.toHaveBeenCalled();
    expect(lastPatch(onQueryChange).cdmSyntheticQuery.expression).toEqual('A');
  });

  it('switching a row to Filter shows the filter editor and commits the filter', async () => {
    const { onQueryChange } = await renderTab({
      cdmSyntheticQuery: expressionQuery({ variables: [{ name: 'A', mode: 'filter' }] }),
    });
    const editor = screen.getByTestId('filter-editor');
    fireEvent.change(editor, { target: { value: "name^='PT'" } });
    fireEvent.blur(editor);
    expect(lastPatch(onQueryChange).cdmSyntheticQuery.variables[0]).toEqual({
      name: 'A',
      mode: 'filter',
      filter: "name^='PT'",
    });
  });

  it('switching modes clears the target unit only', async () => {
    const { onQueryChange } = await renderTab({
      cdmSyntheticQuery: expressionQuery({
        variables: [
          {
            name: 'A',
            mode: 'instance',
            instance: { space: 's', externalId: 'x' },
            targetUnit: 'u',
            aggregate: 'max',
          },
        ],
      }),
    });
    fireEvent.click(screen.getByRole('radio', { name: 'Filter' }));
    expect(lastPatch(onQueryChange).cdmSyntheticQuery.variables[0]).toEqual({
      name: 'A',
      mode: 'filter',
      instance: { space: 's', externalId: 'x' },
      aggregate: 'max',
    });
  });

  it('commits the expression on blur', async () => {
    const { onQueryChange } = await renderTab();
    const editor = screen.getByTestId('code-editor');
    fireEvent.change(editor, { target: { value: 'A * 2' } });
    fireEvent.blur(editor);
    expect(lastPatch(onQueryChange).cdmSyntheticQuery.expression).toEqual('A * 2');
  });

  it('Raw hides the aggregates and the granularity', async () => {
    const { onQueryChange } = await renderTab({ aggregation: 'none' });
    expect(document.getElementById('variable-aggregate-A-0')).toBeNull();
    expect(document.getElementById('granularity-auto-A')).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: 'Aggregate' }));
    expect(lastPatch(onQueryChange)).toEqual({ aggregation: 'average' });
  });

  it('opens the request preview with the expanded synthetic items', async () => {
    await renderTab({
      cdmSyntheticQuery: expressionQuery({
        variables: [{ name: 'A', mode: 'filter', filter: "name^='PT'" }],
        expression: 'A * 2',
      }),
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('expression-open-request-preview'));
    });
    await waitFor(() =>
      expect(screen.getByText(/timeseries\/synthetic\/query/)).toBeInTheDocument()
    );
    await waitFor(() =>
      expect(screen.getByTestId('expression-request-preview-note')).toHaveTextContent(
        /A: 1 time series/
      )
    );
    const body = JSON.parse(
      (
        within(screen.getByTestId('expression-request-preview-body-0')).getByRole(
          'textbox'
        ) as HTMLTextAreaElement
      ).value
    );
    expect(body.items[0]).toEqual(
      expect.objectContaining({ start: 1000, end: 2000, timeZone: 'UTC' })
    );
  });

  it('shows how many time series a filter row matches, and nothing for an empty one', async () => {
    await renderTab({
      cdmSyntheticQuery: expressionQuery({
        variables: [
          { name: 'A', mode: 'filter', filter: "name^='PT'" },
          { name: 'B', mode: 'filter', filter: '' },
        ],
      }),
    });
    await waitFor(() =>
      expect(screen.getByTestId('variable-matches-A-0')).toHaveTextContent('1 time series')
    );
    expect(screen.queryByTestId('variable-matches-A-1')).toBeNull();
  });

  it('opens a filter variable preview with its instance lookup', async () => {
    await renderTab({
      cdmSyntheticQuery: expressionQuery({
        variables: [{ name: 'A', mode: 'filter', filter: "name^='PT'" }],
      }),
    });
    fireEvent.click(screen.getByTestId('variable-preview-A-0'));
    await waitFor(() => expect(screen.getByText(/models\/instances\/list/)).toBeInTheDocument());
    expect(screen.getByText('Request preview: variable A')).toBeInTheDocument();
  });
});

describe('SyntheticTimeSeriesTab editor checks', () => {
  beforeEach(() => {
    mockMonaco = {
      languages: {
        getLanguages: () => [],
        register: jest.fn(),
        setLanguageConfiguration: jest.fn(),
        setMonarchTokensProvider: jest.fn(),
        registerCompletionItemProvider: jest.fn(),
      },
      editor: { setModelMarkers: jest.fn() },
      MarkerSeverity: { Error: 8, Warning: 4 },
      KeyCode: { Enter: 3, KeyF: 36 },
      KeyMod: { Shift: 1024, CtrlCmd: 2048 },
    };
  });
  afterEach(() => {
    mockMonaco = null;
  });

  /** The messages of every marker set for an editor, call by call. */
  const markerCalls = (owner: string): string[][] =>
    mockMonaco.editor.setModelMarkers.mock.calls
      .filter(([, callOwner]: any[]) => callOwner === owner)
      .map(([, , markers]: any[]) => markers.map(({ message }: any) => message));

  const connector = () =>
    getMockedDataSource({
      fetch: jest.fn().mockImplementation(async ({ url }) => ({ status: 200, data: answer(url) })),
    }).connector;
  const tab = (tabConnector: ReturnType<typeof connector>, query: Partial<CdmSyntheticQuery>) => (
    <SyntheticTimeSeriesTab
      query={
        {
          ...defaultQuery,
          refId: 'A',
          aggregation: 'average',
          granularity: '',
          label: '',
          cdmSyntheticQuery: expressionQuery(query),
        } as CogniteQuery
      }
      onQueryChange={jest.fn()}
      connector={tabConnector}
      intervalMs={60_000}
      range={{ from: dateTime(1000), to: dateTime(2000), raw: { from: 'now-1h', to: 'now' } }}
      timezone="utc"
    />
  );

  it('clears an unknown variable once a row defines it, without editing the expression', async () => {
    const instance = { space: 's', externalId: 'x' };
    const tabConnector = connector();
    let rerender: (ui: React.ReactElement) => void = () => {};
    await act(async () => {
      ({ rerender } = render(
        tab(tabConnector, {
          expression: 'A - B',
          variables: [{ name: 'A', mode: 'instance', instance }],
        })
      ));
    });
    expect(markerCalls('cognite-synthetic-expression').at(-1)).toEqual(['Unknown variable "B"']);
    await act(async () =>
      rerender(
        tab(tabConnector, {
          expression: 'A - B',
          variables: [
            { name: 'A', mode: 'instance', instance },
            { name: 'B', mode: 'instance', instance },
          ],
        })
      )
    );
    expect(markerCalls('cognite-synthetic-expression').at(-1)).toEqual([]);
  });

  it('warns about a filter property only once the view is read', async () => {
    await act(async () => {
      render(
        tab(connector(), {
          expression: 'A',
          variables: [{ name: 'A', mode: 'filter', filter: 'pressure>2' }],
        })
      );
    });
    const calls = markerCalls('cognite-synthetic-filter-A-0');
    expect(calls[0]).toEqual([]);
    await waitFor(() =>
      expect(markerCalls('cognite-synthetic-filter-A-0').at(-1)).toEqual([
        'The view has no property "pressure"',
      ])
    );
  });
});

describe('SyntheticTimeSeriesTab with the panel scoped variables', () => {
  it('resolves $__interval and the like as the query does', async () => {
    const fetcher = {
      fetch: jest.fn().mockImplementation(async ({ url }) => ({ status: 200, data: answer(url) })),
    };
    await act(async () => {
      render(
        <SyntheticTimeSeriesTab
          query={
            {
              ...defaultQuery,
              refId: 'A',
              aggregation: 'average',
              granularity: '',
              label: '',
              cdmSyntheticQuery: expressionQuery({
                variables: [{ name: 'A', mode: 'filter', filter: 'name=$__interval' }],
              }),
            } as CogniteQuery
          }
          onQueryChange={jest.fn()}
          connector={getMockedDataSource(fetcher).connector}
          intervalMs={60_000}
          range={{ from: dateTime(1000), to: dateTime(2000), raw: { from: 'now-1h', to: 'now' } }}
          timezone="utc"
          scopedVars={{ __interval: { text: '1h', value: '1h' } }}
        />
      );
    });
    fireEvent.click(screen.getByTestId('variable-preview-A-0'));
    await waitFor(() => expect(screen.getByDisplayValue(/"value": "1h"/)).toBeInTheDocument());
  });
});

describe('SyntheticTimeSeriesTab after a view change', () => {
  const OTHER = { space: 'cdf_cdm', externalId: 'OtherTimeSeries', version: 'v1' };

  it('compiles a filter preview with the new view, not the one before it', async () => {
    // isStep is a boolean on the first view and text on the other, so the body tells them apart.
    const fetcher = {
      fetch: jest.fn().mockImplementation(async ({ url, data }) => {
        if (url.endsWith('/models/views/byids')) {
          const [{ externalId }] = data.items;
          const isStep = { type: { type: externalId === OTHER.externalId ? 'text' : 'boolean' } };
          return {
            status: 200,
            data: { items: [{ ...VIEW, externalId, properties: { ...VIEW_PROPERTIES, isStep } }] },
          };
        }
        return { status: 200, data: answer(url) };
      }),
    };
    const connector = getMockedDataSource(fetcher).connector;
    const tab = (view: typeof VIEW) => (
      <SyntheticTimeSeriesTab
        query={
          {
            ...defaultQuery,
            refId: 'A',
            aggregation: 'average',
            granularity: '',
            label: '',
            cdmSyntheticQuery: expressionQuery({
              view,
              variables: [{ name: 'A', mode: 'filter', filter: "isStep='true'" }],
            }),
          } as CogniteQuery
        }
        onQueryChange={jest.fn()}
        connector={connector}
        intervalMs={60_000}
        range={{ from: dateTime(1000), to: dateTime(2000), raw: { from: 'now-1h', to: 'now' } }}
        timezone="utc"
      />
    );
    let rerender: (ui: React.ReactElement) => void = () => {};
    await act(async () => {
      ({ rerender } = render(tab(VIEW)));
    });
    await act(async () => rerender(tab(OTHER)));
    fireEvent.click(screen.getByTestId('variable-preview-A-0'));
    await waitFor(() => expect(screen.getByDisplayValue(/"value": "true"/)).toBeInTheDocument());
  });
});

describe('SyntheticTimeSeriesTab layout', () => {
  const resizeCallbacks: Array<(entries: Array<{ contentRect: { width: number } }>) => void> = [];
  const originalResizeObserver = (global as any).ResizeObserver;
  let measuredWidth = 0;
  let rectSpy: jest.SpyInstance;

  beforeEach(() => {
    resizeCallbacks.length = 0;
    (global as any).ResizeObserver = class {
      constructor(callback: (entries: Array<{ contentRect: { width: number } }>) => void) {
        resizeCallbacks.push(callback);
      }
      observe() {}
      disconnect() {}
    };
    rectSpy = jest
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(() => ({ width: measuredWidth }) as DOMRect);
  });

  afterEach(() => {
    (global as any).ResizeObserver = originalResizeObserver;
    rectSpy.mockRestore();
  });

  const resizeTo = (width: number) =>
    act(() => resizeCallbacks.forEach((callback) => callback([{ contentRect: { width } }])));

  it('shows each variable as a card of labelled fields when the list is narrow', async () => {
    measuredWidth = 500;
    await act(async () => {
      render(
        <StatefulTab
          connector={mockedConnector()}
          initial={{
            cdmSyntheticQuery: expressionQuery({
              variables: [
                { name: 'A', mode: 'instance', aggregate: 'average' },
                { name: 'B', mode: 'filter', filter: "name^='PT'", aggregate: 'average' },
              ],
            }),
          }}
        />
      );
    });
    const card = screen.getByTestId('variable-card-A-1');
    for (const label of ['Variable', 'Time series', 'Aggregate', 'Unit']) {
      expect(within(card).getByText(label, { exact: true })).toBeInTheDocument();
    }
    await waitFor(() =>
      expect(within(card).getByTestId('variable-matches-A-1')).toHaveTextContent('1 time series')
    );
    fireEvent.click(within(card).getByTestId('variable-remove-A-1'));
    expect(screen.queryByTestId('variable-card-A-1')).toBeNull();
    expect(screen.getByTestId('variable-card-A-0')).toBeInTheDocument();
  });

  it('keeps the filter editor mounted when the match chip appears and when the layout changes', async () => {
    measuredWidth = 1600;
    await act(async () => {
      render(
        <StatefulTab
          connector={mockedConnector()}
          initial={{
            cdmSyntheticQuery: expressionQuery({
              variables: [{ name: 'A', mode: 'filter', aggregate: 'average' }],
            }),
          }}
        />
      );
    });
    expect(filterEditorMounts()).toBe(1);
    expect(screen.queryByTestId('variable-matches-A-0')).toBeNull();

    const editor = screen.getByTestId('filter-editor');
    fireEvent.change(editor, { target: { value: "name^='PT'" } });
    await act(async () => {
      fireEvent.blur(editor);
    });
    await waitFor(() =>
      expect(screen.getByTestId('variable-matches-A-0')).toHaveTextContent('1 time series')
    );
    expect(filterEditorMounts()).toBe(1);

    await resizeTo(500);
    expect(screen.getByTestId('variable-card-A-0')).toBeInTheDocument();
    await resizeTo(1600);
    expect(screen.queryByTestId('variable-card-A-0')).toBeNull();
    expect(filterEditorMounts()).toBe(1);
  });
});
