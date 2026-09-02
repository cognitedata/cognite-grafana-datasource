import {
  buildDisplayFieldOptions,
  buildPersistedVariableQuery,
  buildValueFieldOptions,
  canEmitInstanceRef,
} from '../components/variables/graphqlFields';
import { extractFieldNamesFromQuery } from '../components/graphql/graphqlFields';
import { INSTANCE_ID_FIELD } from '../cdf/instanceRef';
import {
  DEFAULT_GRAPHQL_DATA_MODEL,
  DEFAULT_GRAPHQL_PANEL_QUERY,
  DEFAULT_GRAPHQL_VARIABLE_QUERY,
} from '../types';

describe('the default queries', () => {
  it('cap their result sets, so a first open cannot pull a whole project', () => {
    expect(DEFAULT_GRAPHQL_PANEL_QUERY).toContain('first: 10');
    expect(DEFAULT_GRAPHQL_VARIABLE_QUERY).toContain('first: 10');
  });

  it('the panel starts on time series, whose `type` marks the rows it plots', () => {
    const fields = extractFieldNamesFromQuery(DEFAULT_GRAPHQL_PANEL_QUERY, 'test');
    expect(DEFAULT_GRAPHQL_PANEL_QUERY).toContain('listCogniteTimeSeries');
    expect(fields).toEqual(expect.arrayContaining(['space', 'externalId', 'name', 'type']));
  });

  it('the variable editor starts on assets, ready to emit instance references', () => {
    // A dashboard variable usually picks assets; space and externalId unlock the
    // Instance ID value field, and name gives the picker a readable label.
    const fields = extractFieldNamesFromQuery(DEFAULT_GRAPHQL_VARIABLE_QUERY, 'test');
    expect(DEFAULT_GRAPHQL_VARIABLE_QUERY).toContain('listCogniteAsset');
    expect(fields).toEqual(expect.arrayContaining(['space', 'externalId', 'name']));
    expect(canEmitInstanceRef(fields)).toBe(true);
  });

  it('defaults to the core data model, which every CDM project has', () => {
    expect(DEFAULT_GRAPHQL_DATA_MODEL).toEqual({
      space: 'cdf_cdm',
      externalId: 'CogniteCore',
      version: 'v1',
    });
  });
});

describe('canEmitInstanceRef', () => {
  it('requires both identifiers', () => {
    expect(canEmitInstanceRef(['space', 'externalId'])).toBe(true);
    expect(canEmitInstanceRef(['space', 'name'])).toBe(false);
    expect(canEmitInstanceRef([])).toBe(false);
  });

  it('accepts identifiers nested under a parent field', () => {
    expect(canEmitInstanceRef(['instanceId.space', 'instanceId.externalId'])).toBe(true);
  });

  it('requires both identifiers on the same object', () => {
    expect(canEmitInstanceRef(['asset.space', 'unit.externalId'])).toBe(false);
  });

  it('refuses two nested candidates, which the variable could not choose between', () => {
    expect(
      canEmitInstanceRef(['asset.space', 'asset.externalId', 'unit.space', 'unit.externalId'])
    ).toBe(false);
    // Top-level identifiers always win, so nested ones beside them are no problem.
    expect(
      canEmitInstanceRef(['space', 'externalId', 'asset.space', 'asset.externalId'])
    ).toBe(true);
  });
});

describe('buildValueFieldOptions', () => {
  it('puts the instance reference first once it is unlocked', () => {
    const options = buildValueFieldOptions(['space', 'externalId', 'name']);
    expect(options[0].value).toBe(INSTANCE_ID_FIELD);
    expect(options.slice(1).map((o) => o.value)).toEqual(['space', 'externalId', 'name']);
  });

  it('omits the instance reference until both identifiers are selected', () => {
    const options = buildValueFieldOptions(['name', 'externalId']);
    expect(options.map((o) => o.value)).toEqual(['name', 'externalId']);
  });

  it('labels options with the raw field path, so they read as they do in the query', () => {
    const options = buildValueFieldOptions(['externalId', 'metadata.owner']);
    expect(options.map((o) => o.label)).toEqual(['externalId', 'metadata.owner']);
  });

  it('falls back to common fields when the query yields none', () => {
    expect(buildValueFieldOptions([]).map((o) => o.value)).toEqual([
      'name',
      'externalId',
      'id',
    ]);
  });
});

describe('buildDisplayFieldOptions', () => {
  it('drops object parents, which have no readable text', () => {
    const options = buildDisplayFieldOptions([
      'instanceId',
      'instanceId.space',
      'instanceId.externalId',
      'name',
    ]);
    expect(options.map((o) => o.value)).toEqual([
      'instanceId.space',
      'instanceId.externalId',
      'name',
    ]);
  });
});

describe('buildPersistedVariableQuery', () => {
  const dataModel = { space: 'sp', externalId: 'model', version: '1' };
  const valueType = { value: 'externalId', label: 'externalId' };

  it('persists an assets query as the definition Grafana will show', () => {
    const result = buildPersistedVariableQuery({
      query: 'assets{name="x"}',
      queryType: 'assets',
      valueType,
    });
    expect(result.problem).toBeUndefined();
    expect(result.value!.queryType).toBe('assets');
    expect(result.value!.query).toBe('assets{name="x"}');
  });

  it('carries GraphQL state through an assets save so switching tabs loses nothing', () => {
    const result = buildPersistedVariableQuery({
      query: 'assets{}',
      queryType: 'assets',
      valueType,
      graphqlQuery: 'query MyQuery { listCogniteAsset { items { name } } }',
      dataModel,
    });
    expect(result.value!.graphqlQuery).toBeDefined();
    expect(result.value!.dataModel).toEqual(dataModel);
  });

  it('puts the GraphQL text in `query`, which is what Grafana shows', () => {
    const graphqlQuery = 'query MyQuery { listCogniteAsset { items { name } } }';
    const result = buildPersistedVariableQuery({
      query: '',
      queryType: 'graphql',
      valueType,
      graphqlQuery,
      dataModel,
    });
    expect(result.value!.query).toBe(graphqlQuery);
    expect(result.value!.graphqlQuery).toBe(graphqlQuery);
  });

  it('parks the assets query when the GraphQL tab takes over `query`', () => {
    // Clicking the GraphQL tab used to overwrite `query` outright, losing the
    // asset expression the other tab owned.
    const result = buildPersistedVariableQuery({
      query: '',
      assetsQuery: 'assets{name="x"}',
      queryType: 'graphql',
      valueType,
      graphqlQuery: 'query MyQuery { listCogniteAsset { items { name } } }',
      dataModel,
    });
    expect(result.value!.assetsQuery).toBe('assets{name="x"}');
  });

  it('refuses an assets query the parser rejects, wherever the save came from', () => {
    const result = buildPersistedVariableQuery(
      { query: 'not an assets query', queryType: 'assets', valueType },
      () => {
        throw new Error('Expected "assets{"');
      }
    );
    expect(result.problem).toEqual({
      reason: 'invalid-assets',
      message: 'Expected "assets{"',
    });
  });

  it('omits displayField entirely when unset', () => {
    const result = buildPersistedVariableQuery({
      query: '',
      queryType: 'graphql',
      valueType,
      graphqlQuery: 'query MyQuery { listCogniteAsset { items { name } } }',
      dataModel,
    });
    expect('displayField' in result.value!).toBe(false);
  });

  it('refuses to persist an empty assets query, which is just an opened tab', () => {
    expect(
      buildPersistedVariableQuery({ query: '   ', queryType: 'assets', valueType }).problem
    ).toEqual({ reason: 'empty-assets' });
  });

  it('refuses to persist GraphQL the parser rejects, and says why', () => {
    const result = buildPersistedVariableQuery({
      query: '',
      queryType: 'graphql',
      valueType,
      graphqlQuery: 'query MyQuery { listCogniteAsset {',
      dataModel,
    });
    expect(result.problem?.reason).toBe('invalid-graphql');
    expect((result.problem as { message: string }).message).toMatch(/Syntax Error/);
  });

  it('refuses to persist an incomplete GraphQL query, so a working variable survives', () => {
    const incomplete = [
      { graphqlQuery: '', dataModel },
      { graphqlQuery: 'query MyQuery { x }', dataModel: { space: 'sp', externalId: 'm' } },
      { graphqlQuery: 'query MyQuery { x }', dataModel: undefined },
    ];
    incomplete.forEach((patch) => {
      expect(
        buildPersistedVariableQuery({
          query: '',
          queryType: 'graphql',
          valueType,
          ...patch,
        }).problem
      ).toEqual({ reason: 'incomplete-graphql' });
    });
  });
});
