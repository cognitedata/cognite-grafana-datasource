import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { FlexibleDataModellingTab } from '../components/flexibleDataModellingTab';
import { labelTooltip } from '../components/graphql/FlexibleDataModellingOptions';
import { defaultQuery } from '../types';
import { graphqlDatasourceStub } from '../test_utils';

// The real editor lazily loads Monaco, which does not resolve under jest. These
// assertions are about the surrounding layout, not the editor itself.
jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  CodeEditor: () => <div data-testid="code-editor" />,
}));

const renderTab = async (
  graphQlQuery = 'query MyQuery { listCogniteAsset { items { name } } }',
  tsKeys: string[] = ['_numeric_type']
) => {
  await act(async () => {
    render(
      <FlexibleDataModellingTab
        query={{
          ...defaultQuery,
          refId: 'A',
          flexibleDataModellingQuery: {
            externalId: 'model',
            space: 'sp',
            version: '1',
            graphQlQuery,
            tsKeys,
          },
        } as any}
        onQueryChange={jest.fn()}
        datasource={graphqlDatasourceStub()}
      />
    );
  });
};

describe('FlexibleDataModellingTab', () => {
  it('shares the redesigned GraphQL layout with the variable editor', async () => {
    await renderTab();
    expect(screen.getByLabelText('Data model')).toBeTruthy();
    expect(screen.getByLabelText('Version')).toBeTruthy();
    expect(screen.getByText('Query')).toBeTruthy();
    expect(screen.getByText('Response')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Test query/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Examples/ })).toBeTruthy();
  });

  it('offers the response preview before anything has been run', async () => {
    await renderTab();
    expect(screen.getByText('Test the query to inspect the raw response.')).toBeTruthy();
  });

  it('keeps label beside aggregation and granularity in one row', async () => {
    await renderTab();
    // All three are options on the returned series, so they belong together rather
    // than in two rows built out of different primitives.
    expect(screen.getByLabelText('Aggregation')).toBeTruthy();
    expect(screen.getByLabelText(/Label/)).toBeTruthy();
    expect(screen.getByPlaceholderText('{{name}}')).toBeTruthy();
    expect(document.querySelector('.gf-form-inline')).toBeNull();
  });

  it('hides the series options until the query yields series', async () => {
    await renderTab('query MyQuery { listCogniteAsset { items { name } } }', []);
    expect(screen.queryByLabelText('Aggregation')).toBeNull();
    expect(screen.queryByPlaceholderText('{{name}}')).toBeNull();
  });
});

describe('the Label tooltip', () => {
  it('names the fields the current query selects, as tokens', () => {
    expect(labelTooltip(['name', 'instanceId.space'])).toContain(
      'Fields in this query: {{name}}, {{instanceId.space}}.'
    );
  });

  it('names nothing when the query yields no fields', () => {
    expect(labelTooltip([])).not.toContain('Fields in this query');
  });
});
