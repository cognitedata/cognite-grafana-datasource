import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CogniteVariableQueryEditor } from '../components/variableQueryEditor';
import {
  DEFAULT_GRAPHQL_DATA_MODEL,
  DEFAULT_GRAPHQL_VARIABLE_QUERY,
  VariableQueryData,
} from '../types';
import { INSTANCE_ID_FIELD } from '../cdf/instanceRef';
import { graphqlDatasourceStub } from '../test_utils';

// The real editor lazily loads Monaco, which does not resolve under jest. These
// assertions are about the surrounding layout and gating, not the editor itself.
jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  CodeEditor: () => <div data-testid="code-editor" />,
}));

const graphqlQuery: VariableQueryData = {
  query: '',
  queryType: 'graphql',
  graphqlQuery: 'query MyQuery { listCogniteAsset { items { space externalId name } } }',
  dataModel: { space: 'sp', externalId: 'model', version: '1' },
};

const mountEditor = async ({
  legacyEnabled = true,
  graphqlEnabled = true,
  query,
}: {
  legacyEnabled?: boolean;
  graphqlEnabled?: boolean;
  query: string | VariableQueryData;
}) => {
  const onChange = jest.fn();
  const datasource = graphqlDatasourceStub({
    connector: {
      isLegacyDataModelFeaturesEnabled: () => legacyEnabled,
      isFlexibleDataModellingEnabled: () => graphqlEnabled,
    },
  });
  let unmount = () => {};
  await act(async () => {
    ({ unmount } = render(
      <CogniteVariableQueryEditor query={query} onChange={onChange} datasource={datasource} />
    ));
  });
  const lastSaved = () => onChange.mock.calls[onChange.mock.calls.length - 1][0];
  const clickTab = async (label: string) => {
    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: label }));
    });
  };
  return { onChange, lastSaved, clickTab, unmount };
};

const tab = (name: string) => screen.queryByRole('tab', { name });

describe('CogniteVariableQueryEditor defaults', () => {
  it('saves the default query for a brand new variable, so it runs as shown', async () => {
    const { onChange } = await mountEditor({ legacyEnabled: false, query: '' });

    expect(onChange).toHaveBeenCalledTimes(1);
    const [saved] = onChange.mock.calls[0];
    expect(saved.queryType).toBe('graphql');
    expect(saved.graphqlQuery).toBe(DEFAULT_GRAPHQL_VARIABLE_QUERY);
    expect(saved.dataModel).toEqual(DEFAULT_GRAPHQL_DATA_MODEL);
  });

  it('leaves a variable that already has a query untouched', async () => {
    const { onChange } = await mountEditor({ legacyEnabled: false, query: graphqlQuery });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('leaves a saved assets variable untouched', async () => {
    const { onChange } = await mountEditor({ query: { query: 'assets{}', queryType: 'assets' } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('leaves a half-saved variable untouched rather than seeding over it', async () => {
    // A model without a query, or a query without a model: seeding would display
    // defaults the variable never persisted.
    const withModel = await mountEditor({
      query: { query: '', queryType: 'graphql', dataModel: graphqlQuery.dataModel },
    });
    expect(withModel.onChange).not.toHaveBeenCalled();
    withModel.unmount();

    const withQuery = await mountEditor({
      query: { query: '', queryType: 'graphql', graphqlQuery: graphqlQuery.graphqlQuery },
    });
    expect(withQuery.onChange).not.toHaveBeenCalled();
  });
});

describe('CogniteVariableQueryEditor display field', () => {
  it('clears a display field the query no longer selects', async () => {
    // The control would read "Auto" while the stale field kept being saved.
    const { onChange, lastSaved } = await mountEditor({
      query: {
        ...graphqlQuery,
        valueType: { value: 'name', label: 'name' },
        displayField: 'description',
      },
    });
    expect(onChange).toHaveBeenCalled();
    expect('displayField' in lastSaved()).toBe(false);
  });

  it('keeps a display field the query still selects', async () => {
    const { onChange } = await mountEditor({
      query: { ...graphqlQuery, valueType: { value: 'name', label: 'name' }, displayField: 'name' },
    });
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('CogniteVariableQueryEditor tab switching', () => {
  const savedAssets: VariableQueryData = { query: 'assets{name="x"}', queryType: 'assets' };

  it('keeps a saved assets query when the GraphQL tab takes over', async () => {
    // Regression: one click on GraphQL used to overwrite `query` with the default
    // GraphQL text, destroying the asset expression outright.
    const { onChange, lastSaved, clickTab } = await mountEditor({ query: savedAssets });

    await clickTab('GraphQL');

    expect(onChange).toHaveBeenCalled();
    expect(lastSaved().queryType).toBe('graphql');
    expect(lastSaved().assetsQuery).toBe('assets{name="x"}');
  });

  it('restores the assets query when the tab comes back', async () => {
    const first = await mountEditor({ query: savedAssets });
    await first.clickTab('GraphQL');
    const parked = first.lastSaved();
    first.unmount();

    // Reopening the variable from what was saved is what a dashboard reload does.
    const reopened = await mountEditor({ query: parked });
    await reopened.clickTab('Assets');

    expect(reopened.lastSaved().queryType).toBe('assets');
    expect(reopened.lastSaved().query).toBe('assets{name="x"}');
  });

  it('replaces a value type the destination tab cannot offer', async () => {
    const { lastSaved, clickTab } = await mountEditor({
      query: { ...savedAssets, valueType: { value: 'id', label: 'Id' } },
    });

    await clickTab('GraphQL');

    expect(lastSaved().valueType.value).not.toBe('id');
  });
});

describe('CogniteVariableQueryEditor tab gating', () => {
  it('offers both tabs when both features are enabled', async () => {
    await mountEditor({ query: '' });
    expect(tab('Assets')).not.toBeNull();
    expect(tab('GraphQL')).not.toBeNull();
  });

  it('hides the Assets tab entirely for a new variable when classic features are off', async () => {
    await mountEditor({ legacyEnabled: false, query: '' });
    // With one option there is no choice to present, so the tab bar goes too.
    expect(tab('Assets')).toBeNull();
    expect(tab('GraphQL')).toBeNull();
    expect(screen.getByLabelText('Data model')).toBeTruthy();
  });

  it('keeps the Assets tab for a variable already saved as an assets query', async () => {
    await mountEditor({ legacyEnabled: false, query: { query: 'assets{name="x"}', queryType: 'assets' } });
    expect(tab('Assets')).not.toBeNull();
    expect(tab('GraphQL')).not.toBeNull();
  });

  it('keeps the Assets tab for a legacy string query', async () => {
    await mountEditor({ legacyEnabled: false, query: 'assets{name="x"}' });
    expect(tab('Assets')).not.toBeNull();
  });

  it('does not treat an empty saved query as an assets variable', async () => {
    await mountEditor({ legacyEnabled: false, query: { query: '   ' } });
    expect(tab('Assets')).toBeNull();
  });

  it('hides the GraphQL tab for a new variable when the GraphQL feature is off', async () => {
    await mountEditor({ graphqlEnabled: false, query: '' });
    expect(tab('GraphQL')).toBeNull();
    expect(screen.queryByLabelText('Data model')).toBeNull();
    expect(screen.getByText('assets/list')).toBeTruthy();
  });

  it('keeps the GraphQL tab for a variable already saved as GraphQL', async () => {
    await mountEditor({ graphqlEnabled: false, query: graphqlQuery });
    expect(tab('GraphQL')).not.toBeNull();
    expect(tab('Assets')).not.toBeNull();
  });

  it('explains itself when neither feature is on', async () => {
    const { onChange } = await mountEditor({ legacyEnabled: false, graphqlEnabled: false, query: '' });
    expect(screen.getByText(/Enable GraphQL or asset-centric features/)).toBeTruthy();
    // Nothing to seed either: there is no editor to show the default in.
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('CogniteVariableQueryEditor GraphQL tab', () => {
  it('renders the shared editor and the variable fields, without a help wall', async () => {
    await mountEditor({ legacyEnabled: false, query: graphqlQuery });
    ['Data model', 'Version', 'Value', /Display text/].forEach((label) =>
      expect(screen.getByLabelText(label)).toBeTruthy()
    );
    expect(screen.getByRole('button', { name: /Examples/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Test query/ })).toBeTruthy();
    expect(screen.getByText('Test the query to inspect the raw response.')).toBeTruthy();
    // The former inline documentation block is gone.
    expect(screen.queryByText(/Variable interpolation is supported using/)).toBeNull();
  });

  it('describes the default display text as the value itself', async () => {
    await mountEditor({ legacyEnabled: false, query: graphqlQuery });
    expect(screen.getByText('Auto (same as value)')).toBeTruthy();
  });

  it('offers the Instance ID value once the query selects space and externalId', async () => {
    await mountEditor({ legacyEnabled: false, query: graphqlQuery });
    fireEvent.keyDown(screen.getByLabelText('Value'), { key: 'ArrowDown' });
    expect(await screen.findByText('Instance ID (space + externalId)')).toBeTruthy();
  });

  it('badges a query that emits instance references', async () => {
    await mountEditor({
      legacyEnabled: false,
      query: {
        ...graphqlQuery,
        valueType: { value: INSTANCE_ID_FIELD, label: 'Instance ID (space + externalId)' },
      },
    });
    expect(screen.getByText('Emits instance references')).toBeTruthy();
  });

  it('omits the badge for a plain scalar value field', async () => {
    await mountEditor({
      legacyEnabled: false,
      query: { ...graphqlQuery, valueType: { value: 'name', label: 'name' } },
    });
    expect(screen.queryByText('Emits instance references')).toBeNull();
  });

  it('loads the versions of the saved model as the editor opens', async () => {
    // Regression: the Version dropdown stayed empty until the model was re-picked.
    const listVersions = jest
      .fn()
      .mockResolvedValue({ graphQlDmlVersionsById: { items: [{ version: '1' }, { version: '2' }] } });
    const datasource = graphqlDatasourceStub({
      flexibleDataModellingDatasource: { listVersionByExternalIdAndSpace: listVersions },
    });
    await act(async () => {
      render(<CogniteVariableQueryEditor query={graphqlQuery} onChange={jest.fn()} datasource={datasource} />);
    });
    await waitFor(() => expect(listVersions).toHaveBeenCalledWith('variables', 'sp', 'model'));
    fireEvent.keyDown(screen.getByLabelText('Version'), { key: 'ArrowDown' });
    expect(await screen.findByText('2')).toBeTruthy();
  });
});
