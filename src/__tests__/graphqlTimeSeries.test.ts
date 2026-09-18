import { buildSchema } from 'graphql';
import {
  NUMERIC_TYPE_KEY,
  TIME_SERIES_ROOT_KEY,
  timeSeriesKeysFromSchema,
} from '../cdf/graphqlTimeSeries';
import { FlexibleDataModellingDatasource } from '../datasources/FlexibleDataModellingDatasource';

const CORE = buildSchema(`
  type CogniteTimeSeries { space: String, externalId: String, name: String, type: String }
  type CogniteAsset {
    space: String
    externalId: String
    name: String
    parent: CogniteAsset
    timeSeries: [CogniteTimeSeries]
  }
  type TimeSeriesEdge { node: CogniteTimeSeries }
  type TimeSeriesConnection { items: [CogniteTimeSeries], edges: [TimeSeriesEdge] }
  type CogniteActivity { name: String, timeSeries: TimeSeriesConnection, assets: AssetConnection }
  type ActivityConnection { items: [CogniteActivity] }
  type AssetConnection { items: [CogniteAsset] }
  type Query {
    listCogniteTimeSeries: TimeSeriesConnection
    listCogniteAsset: AssetConnection
    getCogniteAssetById: AssetConnection
    listCogniteActivity: ActivityConnection
  }
`);

// A model whose own type extends the core one, as `implements` produces.
const EXTENDED = buildSchema(`
  interface CogniteTimeSeries { space: String, externalId: String }
  type PumpSensor implements CogniteTimeSeries { space: String, externalId: String, rpm: Int }
  type PumpSensorConnection { items: [PumpSensor] }
  type Query { listPumpSensor: PumpSensorConnection }
`);

describe('timeSeriesKeysFromSchema', () => {
  it('marks the rows themselves when the query lists time series', () => {
    const keys = timeSeriesKeysFromSchema(
      CORE,
      'query { listCogniteTimeSeries { items { space externalId name description } } }'
    );
    expect(keys).toEqual([TIME_SERIES_ROOT_KEY]);
  });

  it('reads rows out of the edges/node envelope too', () => {
    expect(
      timeSeriesKeysFromSchema(CORE, '{ listCogniteTimeSeries { edges { node { space externalId } } } }')
    ).toEqual([TIME_SERIES_ROOT_KEY]);
  });

  it('names the row fields that are time series, and nothing else', () => {
    const keys = timeSeriesKeysFromSchema(
      CORE,
      `query {
        getCogniteAssetById {
          items {
            name
            parent { name }
            timeSeries { space externalId name }
          }
        }
      }`
    );
    expect(keys).toEqual(['timeSeries']);
  });

  it('recognises a model type that extends the core time series', () => {
    expect(
      timeSeriesKeysFromSchema(EXTENDED, '{ listPumpSensor { items { space externalId rpm } } }')
    ).toEqual([TIME_SERIES_ROOT_KEY]);
  });

  it('finds nothing for rows that are not time series', () => {
    expect(
      timeSeriesKeysFromSchema(CORE, '{ listCogniteAsset { items { space externalId name } } }')
    ).toEqual([]);
  });

  it('finds nothing in a query the parser rejects', () => {
    expect(timeSeriesKeysFromSchema(CORE, '{ listCogniteAsset { items {')).toEqual([]);
  });

  it('names a relation typed as a connection of time series, as the API types to-many relations', () => {
    const items = timeSeriesKeysFromSchema(
      CORE,
      '{ listCogniteActivity { items { name assets { items { name } } timeSeries { items { space externalId } } } } }'
    );
    expect(items).toEqual(['timeSeries']);
    const edges = timeSeriesKeysFromSchema(
      CORE,
      '{ listCogniteActivity { items { timeSeries { edges { node { space externalId } } } } } }'
    );
    expect(edges).toEqual(['timeSeries']);
  });

  it('names an aliased field by its alias, which is how the response is keyed', () => {
    const keys = timeSeriesKeysFromSchema(
      CORE,
      '{ getCogniteAssetById { items { ts: timeSeries { space externalId } } } }'
    );
    expect(keys).toEqual(['ts']);
  });
});

describe('plotting the series a GraphQL query returns', () => {
  /** The per-series datapoint requests a query produces. */
  const runRequests = async (
    keys: { tsKeys?: string[]; schemaTsKeys?: string[]; label?: string },
    items: any[],
    graphQlQuery: string
  ) => {
    const connector = {
      fetchQuery: jest.fn().mockResolvedValue({ data: { listCogniteTimeSeries: { items } } }),
    } as any;
    const timeseries = { query: jest.fn().mockResolvedValue({ data: [] }) } as any;
    const ds = new FlexibleDataModellingDatasource(connector, timeseries);
    const query = {
      space: 's',
      externalId: 'm',
      version: '1',
      graphQlQuery,
      tsKeys: keys.tsKeys ?? [],
      schemaTsKeys: keys.schemaTsKeys,
      label: keys.label,
    };
    await ds.runQuery(query, {}, { refId: 'A', flexibleDataModellingQuery: query });
    return timeseries.query.mock.calls.map(
      ([request]: any[]) => request.targets[0].flexibleDataModellingQuery
    );
  };
  const run = async (
    keys: { tsKeys?: string[]; schemaTsKeys?: string[] },
    items: any[],
    graphQlQuery: string
  ) => (await runRequests(keys, items, graphQlQuery)).map((q) => q.instanceIds[0]);
  const labelsOf = async (label: string | undefined, items: any[], graphQlQuery: string) =>
    (await runRequests({ schemaTsKeys: [TIME_SERIES_ROOT_KEY, 'timeSeries'], label }, items, graphQlQuery)).map(
      (q) => q.labels[0]
    );
  const rowsQuery = '{ listCogniteTimeSeries { items { space externalId name } } }';
  const vouchedRows = { schemaTsKeys: [TIME_SERIES_ROOT_KEY] };

  it('fetches datapoints for rows the schema vouched for, without a type field', async () => {
    const fetched = await run(
      vouchedRows,
      [
        { space: 'paper_mill', externalId: 'TS_30_LT_101_PV', name: '30-LT-101-PV' },
        { space: 'paper_mill', externalId: 'TS_30_TT_101_PV', name: '30-TT-101-PV' },
      ],
      rowsQuery
    );
    expect(fetched).toEqual([
      { space: 'paper_mill', externalId: 'TS_30_LT_101_PV' },
      { space: 'paper_mill', externalId: 'TS_30_TT_101_PV' },
    ]);
  });

  it('skips rows whose selected type is not numeric', async () => {
    const fetched = await run(
      vouchedRows,
      [
        { space: 's', externalId: 'numeric', type: 'numeric' },
        { space: 's', externalId: 'text', type: 'string' },
      ],
      rowsQuery
    );
    expect(fetched).toEqual([{ space: 's', externalId: 'numeric' }]);
  });

  it('lets the schema decide when the selected type is not populated', async () => {
    // `type: null` means the field was selected but is empty, not that the row is
    // something other than numeric.
    const fetched = await run(
      vouchedRows,
      [{ space: 's', externalId: 'untyped', type: null }],
      rowsQuery
    );
    expect(fetched).toEqual([{ space: 's', externalId: 'untyped' }]);
  });

  it('fetches datapoints for a nested field the schema vouched for', async () => {
    const fetched = await run(
      { schemaTsKeys: ['timeSeries'] },
      [
        {
          name: 'Pump',
          parent: { space: 's', externalId: 'PARENT' },
          timeSeries: { space: 's', externalId: 'PUMP_RPM' },
        },
      ],
      '{ listCogniteTimeSeries { items { name parent { space externalId } timeSeries { space externalId } } } }'
    );
    expect(fetched).toEqual([{ space: 's', externalId: 'PUMP_RPM' }]);
  });

  it('fetches datapoints for every series of a nested connection or list', async () => {
    const a = { space: 's', externalId: 'A' };
    const b = { space: 's', externalId: 'B' };
    const query =
      '{ listCogniteTimeSeries { items { name timeSeries { items { space externalId } } } } }';
    const keys = { schemaTsKeys: ['timeSeries'] };
    expect(await run(keys, [{ name: 'Act', timeSeries: { items: [a, b] } }], query)).toEqual([a, b]);
    expect(
      await run(keys, [{ name: 'Act', timeSeries: { edges: [{ node: a }, { node: b }] } }], query)
    ).toEqual([a, b]);
    expect(await run(keys, [{ name: 'Act', timeSeries: [a, b] }], query)).toEqual([a, b]);
    // Still only what the schema vouched for: an unvouched connection stays a table.
    expect(await run({}, [{ name: 'Act', assets: { items: [a] } }], query)).toEqual([]);
  });

  it('still plots numeric rows found by the type heuristic', async () => {
    const fetched = await run(
      { tsKeys: [NUMERIC_TYPE_KEY] },
      [{ space: 's', externalId: 'e', type: 'numeric' }],
      rowsQuery
    );
    expect(fetched).toEqual([{ space: 's', externalId: 'e' }]);
  });

  it('does not let a legacy __typename key vouch for an untyped object', async () => {
    // typeNameList names any field selecting __typename, whatever its type. Only
    // the legacy TimeSeries shape is honoured on that evidence alone.
    const fetched = await run(
      { tsKeys: ['relation'] },
      [
        { relation: { __typename: 'CogniteAsset', space: 's', externalId: 'ASSET' } },
        { relation: { __typename: 'TimeSeries', externalId: 'LEGACY_TS' } },
      ],
      '{ listCogniteTimeSeries { items { relation { __typename space externalId } } } }'
    );
    expect(fetched).toEqual([undefined]);
  });

  it('plots nothing when neither the schema nor a type field says so', async () => {
    // Asset rows carry space and externalId too; without a vouch they stay a table.
    const fetched = await run({}, [{ space: 's', externalId: 'ASSET' }], rowsQuery);
    expect(fetched).toEqual([]);
  });

  describe('labels each series', () => {
    const query = '{ listCogniteTimeSeries { items { space externalId name } } }';

    it('with its name when no label is set', async () => {
      expect(
        await labelsOf(undefined, [{ space: 's', externalId: 'e', name: '30-LT-101-PV' }], query)
      ).toEqual(['30-LT-101-PV']);
    });

    it('from the template, against the series', async () => {
      expect(
        await labelsOf('{{name}} @ {{space}}', [{ space: 's', externalId: 'e', name: 'LT' }], query)
      ).toEqual(['LT @ s']);
    });

    it('falls back to the row a nested series hangs off', async () => {
      const labels = await labelsOf(
        '{{name}} / {{assetName}}',
        [{ assetName: 'Pump', timeSeries: { space: 's', externalId: 'RPM', name: 'rpm' } }],
        '{ listCogniteTimeSeries { items { assetName timeSeries { space externalId name } } } }'
      );
      expect(labels).toEqual(['rpm / Pump']);
    });
  });
});
