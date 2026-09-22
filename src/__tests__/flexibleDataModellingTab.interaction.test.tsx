import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FlexibleDataModellingTab } from '../components/flexibleDataModellingTab';
import { defaultQuery } from '../types';
import { graphqlDatasourceStub } from '../test_utils';

jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  // Monaco does not resolve under jest. A textarea stands in, handing its text to
  // onBlur the way the real editor does.
  CodeEditor: ({ value, onBlur }: { value: string; onBlur?: (text: string) => void }) => (
    <textarea
      data-testid="code-editor"
      defaultValue={value}
      onBlur={(event) => onBlur?.(event.target.value)}
    />
  ),
}));

const renderTab = (aggregation?: string) => {
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
            graphQlQuery: 'query MyQuery { listCogniteTimeSeries { items { name } } }',
            tsKeys: ['_numeric_type'],
          },
        } as any
      }
      onQueryChange={onQueryChange}
      datasource={graphqlDatasourceStub()}
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
