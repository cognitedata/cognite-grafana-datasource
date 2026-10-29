import { buildSchema } from 'graphql';
import {
  NUMERIC_TYPE_KEY,
  graphqlSeriesRefId,
  isMessageForRow,
  TIME_SERIES_ROOT_KEY,
  timeSeriesKeysFromSchema,
} from '../cdf/graphqlTimeSeries';
import { FlexibleDataModellingDatasource } from '../datasources/FlexibleDataModellingDatasource';
import { eventBusService } from '../appEventHandler';

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
  let lastConnector: any;
  /** The per-series datapoint requests a query produces. */
  const runRequests = async (
    keys: { tsKeys?: string[]; schemaTsKeys?: string[]; label?: string; queryType?: string },
    items: any[],
    graphQlQuery: string,
    targetPatch: Record<string, unknown> = {},
    storedType?: string
  ) => {
    const connector = {
      fetchQuery: jest.fn().mockResolvedValue({ data: { listCogniteTimeSeries: { items } } }),
      // The type lookup for rows that do not select `type`: every instance asked for.
      fetchItems: jest.fn().mockImplementation(async ({ data }) =>
        storedType
          ? data.items.map(({ space, externalId }: any) => ({
              space,
              externalId,
              properties: {
                cdf_cdm: {
                  'CogniteTimeSeries/v1': {
                    type: storedType,
                    ...(storedType === 'state' ? { stateSet: { space, externalId: 'set' } } : {}),
                  },
                },
              },
            }))
          : []
      ),
    } as any;
    lastConnector = connector;
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
      queryType: keys.queryType as any,
    };
    await ds.runQuery(query, {}, { refId: 'A', flexibleDataModellingQuery: query, ...targetPatch });
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

  const mixedRows = [
    { space: 's', externalId: 'numeric', name: 'Level', type: 'numeric' },
    { space: 's', externalId: 'text', name: 'Phase', type: 'string' },
    { space: 's', externalId: 'pump', name: 'Pump', type: 'state' },
    { space: 's', externalId: 'other', type: 'notATimeSeriesType' },
  ];

  it('plots only the rows of the panel series type, numeric unless chosen', async () => {
    const ids = async (queryType?: string) =>
      (await runRequests({ ...vouchedRows, queryType }, mixedRows, rowsQuery)).map(
        (q) => q.instanceIds[0].externalId
      );
    expect(await ids(undefined)).toEqual(['numeric']);
    expect(await ids('string')).toEqual(['text']);
    expect(await ids('state')).toEqual(['pump']);
  });

  it('fetches no data points for Instances', async () => {
    expect(await runRequests({ ...vouchedRows, queryType: 'instances' }, mixedRows, rowsQuery)).toEqual([]);
  });

  it('passes the type on with each series, so it is not looked up again', async () => {
    const requests = await runRequests({ ...vouchedRows, queryType: 'state' }, mixedRows, rowsQuery);
    expect(requests.map((q) => q.instanceKinds)).toEqual([['state']]);
  });

  it('names the skipped series in a warning on the query row', async () => {
    const emit = jest.spyOn(eventBusService, 'emit').mockImplementation(() => undefined);
    await runRequests(vouchedRows, mixedRows.slice(0, 3), rowsQuery);
    expect(emit).toHaveBeenCalledWith(expect.anything(), {
      refId: 'A',
      warning: expect.stringMatching(/^Skipped 2 time series that are not numeric: Phase \(string\), Pump \(state\)\./),
    });
    emit.mockRestore();
  });

  it('looks up rows without a type for a string or state panel, not for a numeric one', async () => {
    const untyped = [{ space: 's', externalId: 'phase' }];
    const asState = await runRequests({ ...vouchedRows, queryType: 'state' }, untyped, rowsQuery, {}, 'state');
    expect(asState).toHaveLength(1);
    expect(lastConnector.fetchItems).toHaveBeenCalled();

    const asNumeric = await runRequests(vouchedRows, untyped, rowsQuery, {}, 'state');
    expect(asNumeric).toHaveLength(1);
    expect(lastConnector.fetchItems).not.toHaveBeenCalled();
  });

  it('looks up all the rows in one request, and passes a state series state set on', async () => {
    const untyped = [
      { space: 's', externalId: 'a' },
      { space: 's', externalId: 'b' },
      { space: 's', externalId: 'c' },
    ];
    const requests = await runRequests({ ...vouchedRows, queryType: 'state' }, untyped, rowsQuery, {}, 'state');
    expect(lastConnector.fetchItems).toHaveBeenCalledTimes(1);
    expect(lastConnector.fetchItems.mock.calls[0][0].data.items).toHaveLength(3);
    expect(requests.map((q) => q.instanceStateSets)).toEqual([
      [{ space: 's', externalId: 'set' }],
      [{ space: 's', externalId: 'set' }],
      [{ space: 's', externalId: 'set' }],
    ]);
  });

  it('looks up typed state rows on a state panel too, for their state sets', async () => {
    await runRequests({ ...vouchedRows, queryType: 'state' }, mixedRows, rowsQuery, {}, 'state');
    expect(lastConnector.fetchItems.mock.calls[0][0].data.items).toEqual([
      { instanceType: 'node', space: 's', externalId: 'pump' },
    ]);
  });

  it('takes a state set the row selected, without a lookup', async () => {
    const rows = [{ space: 's', externalId: 'pump', name: 'Pump', type: 'state', stateSet: { space: 's', externalId: 'set' } }];
    const requests = await runRequests({ ...vouchedRows, queryType: 'state' }, rows, rowsQuery, {}, 'state');
    expect(lastConnector.fetchItems).not.toHaveBeenCalled();
    expect(requests.map((q) => q.instanceStateSets)).toEqual([[{ space: 's', externalId: 'set' }]]);
  });

  it('names a row the lookup finds no time series for as of an unknown type', async () => {
    const emit = jest.spyOn(eventBusService, 'emit').mockImplementation(() => undefined);
    const requests = await runRequests({ ...vouchedRows, queryType: 'string' }, [{ space: 's', externalId: 'gone', name: 'Gone' }], rowsQuery);
    expect(requests).toEqual([]);
    expect(emit).toHaveBeenCalledWith(expect.anything(), {
      refId: 'A',
      warning: expect.stringContaining('Gone (unknown type)'),
    });
    emit.mockRestore();
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

describe('GraphQL series refIds', () => {
  it('routes a series message to the query row it came from', () => {
    expect(graphqlSeriesRefId('A', 3)).toBe('A_fdm_3');
    expect(isMessageForRow('A_fdm_3', 'A')).toBe(true);
    expect(isMessageForRow('A', 'A')).toBe(true);
    expect(isMessageForRow('AB_fdm_0', 'A')).toBe(false);
    expect(isMessageForRow('B', 'A')).toBe(false);
  });
});
