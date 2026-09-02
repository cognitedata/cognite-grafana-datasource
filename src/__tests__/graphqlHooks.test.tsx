import { act, renderHook, waitFor } from '@testing-library/react';
import { useGraphqlDataModels } from '../components/graphql/useGraphqlDataModels';
import { useGraphqlSchema } from '../components/graphql/useGraphqlSchema';
import { useGraphqlPreview } from '../components/graphql/useGraphqlPreview';
import { graphqlDatasourceStub } from '../test_utils';

const MODEL = { space: 'sp', externalId: 'model', version: '1' };

describe('useGraphqlDataModels', () => {
  it('lists the models, and the versions of the selected one', async () => {
    const datasource = graphqlDatasourceStub({
      flexibleDataModellingDatasource: {
        listFlexibleDataModelling: jest.fn().mockResolvedValue({
          listGraphQlDmlVersions: {
            items: [{ space: 'sp', externalId: 'model', version: '2', name: 'Model' }],
          },
        }),
        listVersionByExternalIdAndSpace: jest.fn().mockResolvedValue({
          graphQlDmlVersionsById: { items: [{ version: '1' }, { version: '2' }] },
        }),
      },
    });
    const { result } = renderHook(() => useGraphqlDataModels(datasource, 'A', 'sp', 'model'));

    await waitFor(() => expect(result.current.loadingDataModels).toBe(false));
    await waitFor(() => expect(result.current.loadingVersions).toBe(false));
    expect(result.current.dataModelOptions.map((o) => o.label)).toEqual(['Model (model) <sp>']);
    expect(result.current.versions.map((o) => o.label)).toEqual(['1', '2']);
    expect(result.current.metadataError).toBeUndefined();
  });

  it('keeps reporting a failed model list after the versions load fine', async () => {
    // The two fetches are independent; one succeeding must not hide the other's failure.
    const datasource = graphqlDatasourceStub({
      flexibleDataModellingDatasource: {
        listFlexibleDataModelling: jest.fn().mockRejectedValue(new Error('403')),
      },
    });
    const { result } = renderHook(() => useGraphqlDataModels(datasource, 'A', 'sp', 'model'));

    await waitFor(() => expect(result.current.loadingDataModels).toBe(false));
    await waitFor(() => expect(result.current.loadingVersions).toBe(false));
    expect(result.current.metadataError).toBe('Failed to load data models.');
  });

  it('asks for no versions until a model is selected', () => {
    const datasource = graphqlDatasourceStub();
    renderHook(() => useGraphqlDataModels(datasource, 'A'));
    expect(
      datasource.flexibleDataModellingDatasource.listVersionByExternalIdAndSpace
    ).not.toHaveBeenCalled();
  });
});

describe('useGraphqlSchema', () => {
  it('leaves the editor without a schema when introspection fails', async () => {
    // Regression: a model that could not be introspected threw while building
    // autocomplete.
    const datasource = graphqlDatasourceStub({
      flexibleDataModellingDatasource: {
        runIntrospectionQuery: jest.fn().mockRejectedValue(new Error('unreachable')),
      },
    });
    const { result } = renderHook(() =>
      useGraphqlSchema(datasource, 'A', MODEL.space, MODEL.externalId, MODEL.version)
    );
    await waitFor(() =>
      expect(datasource.flexibleDataModellingDatasource.runIntrospectionQuery).toHaveBeenCalled()
    );
    expect(result.current).toBeUndefined();
  });

  it('does not introspect until the version is known', () => {
    const datasource = graphqlDatasourceStub();
    renderHook(() => useGraphqlSchema(datasource, 'A', 'sp', 'model'));
    expect(datasource.flexibleDataModellingDatasource.runIntrospectionQuery).not.toHaveBeenCalled();
  });
});

describe('useGraphqlPreview', () => {
  it('shows the response body of a successful run', async () => {
    const datasource = graphqlDatasourceStub({
      runGraphqlQuery: jest.fn().mockResolvedValue({ data: { items: [] } }),
    });
    const { result } = renderHook(() => useGraphqlPreview(datasource, '{ x }', MODEL));

    await act(() => result.current.run());

    expect(result.current.response).toEqual({ body: JSON.stringify({ items: [] }, null, 2) });
    expect(result.current.isRunning).toBe(false);
  });

  it('reads GraphQL errors out of a 200 response', async () => {
    const datasource = graphqlDatasourceStub({
      runGraphqlQuery: jest.fn().mockResolvedValue({
        errors: [{ message: 'Cannot query field "nope"' }, { message: 'Second' }],
      }),
    });
    const { result } = renderHook(() => useGraphqlPreview(datasource, '{ x }', MODEL));

    await act(() => result.current.run());

    expect(result.current.response).toEqual({ error: 'Cannot query field "nope"; Second' });
  });

  it('cannot run without a complete data model', () => {
    const datasource = graphqlDatasourceStub();
    const { result } = renderHook(() => useGraphqlPreview(datasource, '{ x }', { space: 'sp' }));
    expect(result.current.canRun).toBe(false);
  });

  it('drops the response of a run that a later run has overtaken', async () => {
    let resolveFirst: (value: unknown) => void = () => {};
    const runGraphqlQuery = jest
      .fn()
      .mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)))
      .mockResolvedValueOnce({ data: { second: true } });
    const datasource = graphqlDatasourceStub({ runGraphqlQuery });
    const { result } = renderHook(() => useGraphqlPreview(datasource, '{ x }', MODEL));

    let first: Promise<void> = Promise.resolve();
    act(() => {
      first = result.current.run();
    });
    await act(() => result.current.run());
    await act(async () => {
      resolveFirst({ data: { first: true } });
      await first;
    });

    expect(result.current.response?.body).toContain('"second": true');
    expect(result.current.isRunning).toBe(false);
  });
});
