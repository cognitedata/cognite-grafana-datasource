import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FlexibleDataModellingTab } from '../components/flexibleDataModellingTab';
import { defaultQuery } from '../types';
import { graphqlDatasourceStub } from '../test_utils';

jest.mock('@grafana/ui', () => {
  const { useEffect, useRef } = jest.requireActual('react');
  return {
    ...jest.requireActual('@grafana/ui'),
    // Monaco does not resolve under jest. A textarea stands in: it hands its text to
    // onBlur the way the real editor does, and exposes it through the editor
    // instance's getValue(), which is what Test query reads.
    CodeEditor: ({
      value,
      onBlur,
      onEditorDidMount,
    }: {
      value: string;
      onBlur?: (text: string) => void;
      onEditorDidMount?: (editor: unknown) => void;
    }) => {
      const ref = useRef(null);
      useEffect(() => {
        onEditorDidMount?.({
          getValue: () => (ref.current as HTMLTextAreaElement | null)?.value ?? '',
          getPosition: () => null,
          getModel: () => null,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);
      return (
        <textarea
          ref={ref}
          data-testid="code-editor"
          defaultValue={value}
          onBlur={(event) => onBlur?.(event.target.value)}
        />
      );
    },
  };
});

const SAVED_QUERY = 'query MyQuery { listCogniteTimeSeries { items { name } } }';

const renderTab = (aggregation?: string, datasource = graphqlDatasourceStub()) => {
  const onQueryChange = jest.fn();
  render(
    <FlexibleDataModellingTab
      query={
        {
          ...defaultQuery,
          ...(aggregation ? { aggregation } : {}),
          refId: 'A',
          flexibleDataModellingQuery: {
            space: 'sp',
            externalId: 'model',
            version: '1',
            graphQlQuery: SAVED_QUERY,
            tsKeys: ['_numeric_type'],
          },
        } as any
      }
      onQueryChange={onQueryChange}
      datasource={datasource}
    />
  );
  return onQueryChange;
};

describe('FlexibleDataModellingTab query editing', () => {
  it('saves a query the parser accepts', async () => {
    const onQueryChange = renderTab();
    const editor = screen.getByTestId('code-editor');
    onQueryChange.mockClear();

    fireEvent.change(editor, { target: { value: '{ listCogniteAsset { items { name } } }' } });
    fireEvent.blur(editor);

    const patch = onQueryChange.mock.calls.find(
      ([p]) => p.flexibleDataModellingQuery?.graphQlQuery
    )?.[0];
    expect(patch.flexibleDataModellingQuery.graphQlQuery).toBe(
      '{ listCogniteAsset { items { name } } }'
    );
    expect(screen.queryByText(/Not saved/)).toBeNull();
  });

  it('says so, beside the editor, when an edit is not saved', async () => {
    // The text on screen and the query being run have diverged; a notification
    // elsewhere on the page did not make that visible.
    const onQueryChange = renderTab();
    const editor = screen.getByTestId('code-editor');
    onQueryChange.mockClear();

    fireEvent.change(editor, { target: { value: '{ listCogniteAsset { items {' } });
    fireEvent.blur(editor);

    expect(await screen.findByText(/Not saved: Syntax Error/)).toBeTruthy();
    expect(
      onQueryChange.mock.calls.some(([p]) => p.flexibleDataModellingQuery?.graphQlQuery)
    ).toBe(false);
    expect(
      screen.getByRole('button', { name: /Test query/ }).getAttribute('aria-disabled')
    ).toBe('true');
  });
});

describe('FlexibleDataModellingTab Test query', () => {
  // Monaco reports blur a tick late, so a click can arrive before the edit is
  // saved. These type and click without ever blurring the editor.
  const typeWithoutBlur = (text: string) =>
    fireEvent.change(screen.getByTestId('code-editor'), { target: { value: text } });
  const clickTestQuery = () => fireEvent.click(screen.getByRole('button', { name: /Test query/ }));

  it('tests the text on screen and saves it, not the previously saved query', async () => {
    const datasource = graphqlDatasourceStub();
    const onQueryChange = renderTab(undefined, datasource);
    const edited = '{ listCogniteAsset { items { name } } }';

    typeWithoutBlur(edited);
    clickTestQuery();

    await waitFor(() => expect(datasource.runGraphqlQuery).toHaveBeenCalled());
    expect((datasource.runGraphqlQuery as jest.Mock).mock.calls[0][0].graphqlQuery).toBe(edited);
    expect(
      onQueryChange.mock.calls.some(
        ([patch]) => patch.flexibleDataModellingQuery?.graphQlQuery === edited
      )
    ).toBe(true);
  });

  it('runs nothing for unsaved text that does not parse, and says why', async () => {
    const datasource = graphqlDatasourceStub();
    renderTab(undefined, datasource);

    typeWithoutBlur('{ listCogniteAsset { items {');
    clickTestQuery();

    expect(await screen.findByText(/Not saved: Syntax Error/)).toBeTruthy();
    expect(datasource.runGraphqlQuery).not.toHaveBeenCalled();
  });

  it('tests the saved query when the text has not changed', async () => {
    const datasource = graphqlDatasourceStub();
    renderTab(undefined, datasource);

    clickTestQuery();

    await waitFor(() => expect(datasource.runGraphqlQuery).toHaveBeenCalled());
    expect((datasource.runGraphqlQuery as jest.Mock).mock.calls[0][0].graphqlQuery).toBe(
      SAVED_QUERY
    );
  });
});

describe('FlexibleDataModellingTab series options', () => {
  it('does not re-run the query while the label is being typed', async () => {
    // Every onQueryChange here re-runs the panel: a GraphQL request plus a
    // datapoints fetch per series. Typing a template must not do that per keystroke.
    const onQueryChange = renderTab();
    const label = await screen.findByPlaceholderText('{{name}}');
    onQueryChange.mockClear();

    fireEvent.change(label, { target: { value: '{{name}} @ {{space}}' } });

    expect(onQueryChange).not.toHaveBeenCalled();
    expect((label as HTMLInputElement).value).toBe('{{name}} @ {{space}}');
  });

  it('applies the label once the field loses focus', async () => {
    const onQueryChange = renderTab();
    const label = await screen.findByPlaceholderText('{{name}}');
    onQueryChange.mockClear();

    fireEvent.change(label, { target: { value: '{{externalId}}' } });
    fireEvent.blur(label);

    await waitFor(() => expect(onQueryChange).toHaveBeenCalled());
    const patch = onQueryChange.mock.calls[0][0];
    expect(patch.flexibleDataModellingQuery.label).toBe('{{externalId}}');
  });

  it('does not save an unchanged label on blur', async () => {
    const onQueryChange = renderTab();
    const label = await screen.findByPlaceholderText('{{name}}');
    onQueryChange.mockClear();

    fireEvent.blur(label);

    expect(onQueryChange).not.toHaveBeenCalled();
  });

  it('applies the granularity on blur, not per keystroke', async () => {
    const onQueryChange = renderTab('average');
    const granularity = await screen.findByPlaceholderText('default');
    onQueryChange.mockClear();

    fireEvent.change(granularity, { target: { value: '1h' } });
    expect(onQueryChange).not.toHaveBeenCalled();

    fireEvent.blur(granularity);
    await waitFor(() => expect(onQueryChange).toHaveBeenCalledWith({ granularity: '1h' }));
  });
});
