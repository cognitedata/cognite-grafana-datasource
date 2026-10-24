import {
  buildExpressionPreview,
  buildVariableLookupPreview,
  SYNTHETIC_PATH,
} from '../components/syntheticTimeSeries/preview';
import { chunkSyntheticItems, countSyntheticReferences } from '../cdf/client';
import { CdmSyntheticQuery } from '../types';

const view = { space: 'cdf_cdm', externalId: 'CogniteTimeSeries', version: 'v1' };
const viewRef = { type: 'view', ...view };

describe('buildVariableLookupPreview', () => {
  it('reports a dashboard variable left in the filter', () => {
    const parts = buildVariableLookupPreview(view, { name: 'A', mode: 'filter', filter: 'name=$tag' });
    expect(parts.error).toEqual('Dashboard variable $tag is not defined.');
  });

  it('compiles against the properties it is given, as the query does', () => {
    const parts = buildVariableLookupPreview(
      view,
      { name: 'A', mode: 'filter', filter: "isStep='true'" },
      new Map([['isStep', { type: 'boolean', list: false }]])
    );
    expect(JSON.parse(parts.bodies![0]).filter).toEqual({
      equals: { property: ['cdf_cdm', 'CogniteTimeSeries/v1', 'isStep'], value: true },
    });
  });

  it('compiles a filter variable to its instance lookup', () => {
    const parts = buildVariableLookupPreview(view, {
      name: 'A',
      mode: 'filter',
      filter: "name^='PT', isStep=false",
    });
    expect(parts.path).toMatch(/models\/instances\/list$/);
    expect(parts.bodies).toHaveLength(1);
    expect(JSON.parse(parts.bodies![0])).toEqual({
      sources: [{ source: viewRef }],
      instanceType: 'node',
      filter: {
        and: [
          { prefix: { property: ['cdf_cdm', 'CogniteTimeSeries/v1', 'name'], value: 'PT' } },
          { equals: { property: ['cdf_cdm', 'CogniteTimeSeries/v1', 'isStep'], value: false } },
        ],
      },
      // The cap of 100 time series per variable, as the docs state it.
      limit: 100,
    });
  });

  it('explains an empty filter instead of showing a body', () => {
    const parts = buildVariableLookupPreview(view, { name: 'B', mode: 'filter', filter: ' ' });
    expect(parts.bodies).toBeUndefined();
    expect(parts.note).toEqual('Variable B has an empty filter, so no request is sent.');
  });

  it('explains a fixed time series instead of showing a body', () => {
    const parts = buildVariableLookupPreview(view, {
      name: 'A',
      mode: 'instance',
      instance: { space: 's', externalId: 'x' },
    });
    expect(parts.bodies).toBeUndefined();
    expect(parts.note).toMatch(/fixed time series, so no request is needed/);
  });

  it('surfaces parse errors and misplaced options', () => {
    expect(
      buildVariableLookupPreview(view, { name: 'A', mode: 'filter', filter: 'name~~' }).error
    ).toMatch(/Syntax error/);
    expect(
      buildVariableLookupPreview(view, { name: 'A', mode: 'filter', filter: "aggregate='max'" })
        .error
    ).toMatch(/row's options/);
  });
});

describe('buildExpressionPreview', () => {
  const query: CdmSyntheticQuery = {
    version: 2,
    view,
    variables: [
      { name: 'A', mode: 'instance', instance: { space: 'pumps', externalId: 'e1' } },
      { name: 'B', mode: 'filter', filter: "name^='PT'" },
    ],
    expression: 'A - B',
  };
  const instances = ['b1', 'b2'].map((externalId) => ({
    instanceType: 'node',
    space: 'pumps',
    externalId,
    version: 1,
    createdTime: 0,
    lastUpdatedTime: 0,
    properties: { cdf_cdm: { 'CogniteTimeSeries/v1': { name: externalId } } },
  }));

  const context = { range: [1000, 2000] as [number, number], timezone: 'utc' };

  it('shows the synthetic request body as sent, with the range, limit and time zone', async () => {
    const connector = { fetchAndPaginate: jest.fn().mockResolvedValue(instances) } as any;
    const parts = await buildExpressionPreview(
      query,
      { datapoints: 'raw', granularity: '1h' },
      connector,
      context
    );
    expect(parts.path).toEqual(SYNTHETIC_PATH);
    expect(parts.bodies!.map((body) => JSON.parse(body))).toEqual([
      {
        items: ['b1', 'b2'].map((b) => ({
          expression: `ts{space='pumps', externalId='e1'} - ts{space='pumps', externalId='${b}'}`,
          start: 1000,
          end: 2000,
          limit: 5000,
          timeZone: 'UTC',
        })),
      },
    ]);
    expect(parts.note).toEqual('A: 1 time series · B: 2 time series → 2 expressions.');
  });

  it('splits the items into requests of ten, as the datasource sends them', async () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ ...instances[0], externalId: `b${i}` }));
    const connector = { fetchAndPaginate: jest.fn().mockResolvedValue(many) } as any;
    const parts = await buildExpressionPreview(
      query,
      { datapoints: 'raw', granularity: '1h' },
      connector,
      context
    );
    const bodies = parts.bodies!.map((body) => JSON.parse(body));
    expect(bodies.map(({ items }) => items.length)).toEqual([10, 2]);
    // The limit is shared out within a request, not over every expression.
    expect(bodies[1].items[0]).toEqual(expect.objectContaining({ limit: 1000 }));
    // The requests themselves are listed below the note, so it only counts the expressions.
    expect(parts.note).toMatch(/→ 12 expressions\.$/);
  });

  it('reports resolution errors', async () => {
    const connector = { fetchAndPaginate: jest.fn().mockResolvedValue([]) } as any;
    const parts = await buildExpressionPreview(
      query,
      { datapoints: 'raw', granularity: '1h' },
      connector,
      context
    );
    expect(parts.error).toMatch(/Variable B matches no time series/);
  });
});

describe('chunkSyntheticItems', () => {
  const ref = (id: string) => `ts{space='s', externalId="${id}"}`;
  it('counts references outside quoted strings only', () => {
    expect(countSyntheticReferences(`${ref('a')} + TS{externalId='ts{x}'}`)).toEqual(2);
  });

  it('splits at ten expressions and at a hundred references per request', () => {
    const single = Array.from({ length: 12 }, (_, i) => ({ expression: ref(`a${i}`) }));
    expect(chunkSyntheticItems(single).map((chunk) => chunk.length)).toEqual([10, 2]);
    const wide = (n: number) => ({
      expression: `avg(${Array.from({ length: n }, (_, i) => ref(`b${i}`)).join(', ')})`,
    });
    expect(
      chunkSyntheticItems([wide(60), wide(30), wide(20)]).map((chunk) => chunk.length)
    ).toEqual([2, 1]);
  });
});
