import { RecordsDatasource } from './RecordsDatasource';
import { Connector } from '../connector';
import { RecordsQuery } from '../types';
import { QueryMessages } from '../queryMessages';

const view = {
  space: 'alarm_schema',
  externalId: 'AlarmEvent',
  version: 'v1',
  streamId: 'alarms_live',
};

const baseQuery = (overrides: Partial<RecordsQuery> = {}): RecordsQuery => ({
  view,
  mode: 'list',
  filters: [],
  sort: [],
  limit: 1000,
  columns: [],
  buckets: [],
  metrics: [],
  timeFilterMode: 'dashboard',
  ...overrides,
});

const RANGE: [number, number] = [1756112400000, 1756198800000];

describe('RecordsDatasource', () => {
  const options = (query: RecordsQuery, refId = 'A') =>
    ({
      range: { from: { valueOf: () => RANGE[0] }, to: { valueOf: () => RANGE[1] } },
      targets: [{ refId, tab: 'Records', recordsQuery: query }],
    }) as any;

  // The collector each run records its warnings in, as CogniteDatasource passes it.
  let messages: QueryMessages;
  /** The warnings the run left on a query row. */
  const warnings = (refId = 'A') =>
    messages
      .attachTo({ data: [] })
      .data.filter((frame) => frame.refId === refId)
      .flatMap((frame) => frame.meta?.notices ?? [])
      .map(({ text }) => text);

  beforeEach(() => {
    jest.clearAllMocks();
    messages = new QueryMessages();
  });

  // The unit catalog the frames prettify units with; empty is a successful load.
  const emptyUnitCatalog = () => jest.fn().mockResolvedValue([]);

  const connectorWith = (
    stream: any,
    response: any
  ): { connector: Connector; fetchData: jest.Mock } => {
    const fetchData = jest.fn((request: any) => {
      if (request.method === 'GET') {
        return Promise.resolve({ data: stream });
      }
      return Promise.resolve({ data: response });
    });
    return { connector: { fetchData, fetchAndPaginate: emptyUnitCatalog() } as unknown as Connector, fetchData };
  };

  it('skips targets with no record view selected', async () => {
    const { connector, fetchData } = connectorWith(null, null);
    const ds = new RecordsDatasource(connector);
    const result = await ds.query(
      options(baseQuery({ view: undefined })),
      messages
    );
    expect(result.data).toEqual([]);
    expect(fetchData).not.toHaveBeenCalled();
  });

  it('posts to the stream filter endpoint and returns a frame', async () => {
    const { connector, fetchData } = connectorWith(
      { externalId: 'alarms_live', type: 'Mutable' },
      { items: [], typing: undefined }
    );
    const ds = new RecordsDatasource(connector);
    await ds.query(options(baseQuery()), messages);

    const post = fetchData.mock.calls.find(([r]) => r.method === 'POST')![0];
    expect(post.path).toBe('/streams/alarms_live/records/filter');
    expect(post.data.limit).toBe(1000);
  });

  it('warns when the result hits the record cap', async () => {
    const items = Array.from({ length: 5 }, (_, i) => ({
      space: 's',
      externalId: `r${i}`,
      createdTime: 1,
      lastUpdatedTime: 2,
      properties: {},
    }));
    const { connector } = connectorWith(
      { externalId: 'alarms_live', type: 'Mutable' },
      { items }
    );
    const ds = new RecordsDatasource(connector);
    await ds.query(options(baseQuery({ limit: 5 })), messages);

    expect(warnings()).toEqual([expect.stringContaining('maximum number of items')]);
  });

  it('forces the time range on immutable streams and says so', async () => {
    const { connector, fetchData } = connectorWith(
      { externalId: 'archive', type: 'Immutable', settings: { limits: {} } },
      { items: [] }
    );
    const ds = new RecordsDatasource(connector);
    await ds.query(options(baseQuery({ timeFilterMode: 'none' })), messages);

    const post = fetchData.mock.calls.find(([r]) => r.method === 'POST')![0];
    expect(post.data.lastUpdatedTime).toEqual({ gte: RANGE[0], lte: RANGE[1] });
    expect(warnings()).toEqual([expect.stringContaining('immutable')]);
  });

  it('falls back to the dashboard range when a custom window does not resolve', async () => {
    const { connector, fetchData } = connectorWith(
      { externalId: 'live', type: 'Mutable', settings: { limits: {} } },
      { items: [] }
    );
    const ds = new RecordsDatasource(connector);
    await ds.query(
      options(
        baseQuery({ timeFilterMode: 'custom', timeFilterFrom: 'yesterday', timeFilterTo: '{{endTime}}' })
      ),
      messages
    );

    // A mutable stream would otherwise be read in full, which is not what was asked
    const post = fetchData.mock.calls.find(([r]) => r.method === 'POST')![0];
    expect(post.data.lastUpdatedTime).toEqual({ gte: RANGE[0], lte: RANGE[1] });
    expect(warnings()).toEqual([
      expect.stringContaining('Time filter "from" is invalid'),
      expect.stringContaining('the dashboard time range was used instead'),
    ]);
  });

  it('falls back when the window needs a stream limit that cannot be read', async () => {
    const fetchData = jest.fn((request: any) =>
      request.method === 'GET'
        ? Promise.reject(new Error('403'))
        : Promise.resolve({ data: { items: [] } })
    );
    const ds = new RecordsDatasource({ fetchData, fetchAndPaginate: emptyUnitCatalog() } as unknown as Connector);
    await ds.query(
      options(
        baseQuery({
          timeFilterMode: 'custom',
          timeFilterFrom: '{{endTime}} - {{maxFilteringInterval}}',
          timeFilterTo: '{{endTime}}',
        })
      ),
      messages
    );

    const post = fetchData.mock.calls.find(([r]) => r.method === 'POST')![0];
    expect(post.data.lastUpdatedTime).toEqual({ gte: RANGE[0], lte: RANGE[1] });
    expect(warnings()).toEqual([
      expect.stringMatching(/^Couldn't read the stream's limits, so the time window isn't checked against them: .*403/),
      expect.stringContaining('maxFilteringInterval'),
      expect.stringContaining('the dashboard time range was used instead'),
    ]);
  });

  it('defaults a custom window to the latest slice a limited stream accepts', async () => {
    const { connector, fetchData } = connectorWith(
      { externalId: 'archive', type: 'Immutable', settings: { limits: { maxFilteringInterval: 'PT1H' } } },
      { items: [] }
    );
    const ds = new RecordsDatasource(connector);
    await ds.query(options(baseQuery({ timeFilterMode: 'custom' })), messages);

    const post = fetchData.mock.calls.find(([r]) => r.method === 'POST')![0];
    expect(post.data.lastUpdatedTime).toEqual({ gte: RANGE[1] - 3_600_000, lte: RANGE[1] });
    expect(warnings()).toEqual([]);
  });

  it('defaults a custom window to the dashboard range on a stream without a limit', async () => {
    const { connector, fetchData } = connectorWith(
      { externalId: 'live', type: 'Mutable', settings: { limits: {} } },
      { items: [] }
    );
    const ds = new RecordsDatasource(connector);
    await ds.query(options(baseQuery({ timeFilterMode: 'custom' })), messages);

    const post = fetchData.mock.calls.find(([r]) => r.method === 'POST')![0];
    expect(post.data.lastUpdatedTime).toEqual({ gte: RANGE[0], lte: RANGE[1] });
    expect(warnings()).toEqual([]);
  });

  it('sends a custom window that resolves, without a warning', async () => {
    const { connector, fetchData } = connectorWith(
      { externalId: 'live', type: 'Mutable', settings: { limits: {} } },
      { items: [] }
    );
    const ds = new RecordsDatasource(connector);
    await ds.query(
      options(baseQuery({ timeFilterMode: 'custom', timeFilterFrom: '{{endTime}} - 1h', timeFilterTo: '{{endTime}}' })),
      messages
    );

    const post = fetchData.mock.calls.find(([r]) => r.method === 'POST')![0];
    expect(post.data.lastUpdatedTime).toEqual({ gte: RANGE[1] - 3_600_000, lte: RANGE[1] });
    expect(warnings()).toEqual([]);
  });

  it('warns when the range exceeds the stream maxFilteringInterval', async () => {
    const { connector } = connectorWith(
      {
        externalId: 'archive',
        type: 'Immutable',
        settings: { limits: { maxFilteringInterval: 'PT1H' } },
      },
      { items: [] }
    );
    const ds = new RecordsDatasource(connector);
    await ds.query(options(baseQuery()), messages);

    expect(warnings()).toEqual([expect.stringContaining('accepts at most')]);
  });

  it('still queries when the stream metadata cannot be read, and warns', async () => {
    const fetchData = jest.fn((request: any) =>
      request.method === 'GET'
        ? Promise.reject(new Error('403'))
        : Promise.resolve({ data: { items: [] } })
    );
    const ds = new RecordsDatasource({ fetchData, fetchAndPaginate: emptyUnitCatalog() } as unknown as Connector);
    const result = await ds.query(options(baseQuery()), messages);

    expect(result.data).toHaveLength(1);
    expect(result.errors).toBeUndefined();
    expect(warnings()).toEqual([
      expect.stringMatching(/^Couldn't read the stream's limits, so the time window isn't checked against them: .*403/),
    ]);
  });

  it('still queries when the unit catalog cannot be loaded, and warns', async () => {
    const { connector } = connectorWith({ externalId: 'alarms_live', type: 'Mutable' }, { items: [] });
    (connector as any).fetchAndPaginate = jest.fn().mockRejectedValue(new Error('401'));
    const result = await new RecordsDatasource(connector).query(options(baseQuery()), messages);

    expect(result.data).toHaveLength(1);
    expect(result.errors).toBeUndefined();
    expect(warnings()).toEqual([expect.stringMatching(/^Couldn't load the unit catalog, so units show their IDs: .*401/)]);
  });

  it('reports a query failure exactly once, on its row', async () => {
    const fetchData = jest.fn((request: any) =>
      request.method === 'GET'
        ? Promise.resolve({ data: { externalId: 'alarms_live', type: 'Mutable' } })
        : Promise.reject(new Error('boom'))
    );
    const ds = new RecordsDatasource({ fetchData, fetchAndPaginate: emptyUnitCatalog() } as unknown as Connector);
    const result = await ds.query(options(baseQuery()), messages);

    expect(result.data).toEqual([]);
    expect(result.errors).toBeUndefined();
    expect(messages.attachTo(result).errors).toEqual([{ refId: 'A', message: 'boom' }]);
  });

  it('returns the failure in the response so the panel can render it', async () => {
    // A 400 from the API must not look like "no data": the message has to reach
    // Grafana's response, since the editor's own banner sits below the fold.
    const apiError = {
      data: { error: { message: 'Size is too large', code: 400 } },
      status: 400,
    };
    const fetchData = jest.fn((request: any) =>
      request.method === 'GET'
        ? Promise.resolve({ data: { externalId: 'alarms_live', type: 'Mutable' } })
        : Promise.reject(apiError)
    );
    const ds = new RecordsDatasource({ fetchData, fetchAndPaginate: emptyUnitCatalog() } as unknown as Connector);
    const result = await ds.query(
      options(baseQuery({ mode: 'aggregate', metrics: [{ name: 'c', function: 'count' }] })),
      messages
    );

    expect(result.data).toEqual([]);
    expect(messages.attachTo(result).errors).toEqual([{ refId: 'A', message: 'Size is too large', status: 400 }]);
  });

  it('keeps frames from healthy targets when a sibling target fails', async () => {
    const fetchData = jest.fn((request: any) => {
      if (request.method === 'GET') {
        return Promise.resolve({ data: { externalId: 'alarms_live', type: 'Mutable' } });
      }
      return request.data?.limit === 7
        ? Promise.reject({ data: { error: { message: 'nope' } } })
        : Promise.resolve({ data: { items: [] } });
    });
    const ds = new RecordsDatasource({ fetchData, fetchAndPaginate: emptyUnitCatalog() } as unknown as Connector);
    const result = await ds.query({
      range: { from: { valueOf: () => RANGE[0] }, to: { valueOf: () => RANGE[1] } },
      targets: [
        { refId: 'A', tab: 'Records', recordsQuery: baseQuery() },
        { refId: 'B', tab: 'Records', recordsQuery: baseQuery({ limit: 7 }) },
      ],
    } as any, messages);

    expect(result.data).toHaveLength(1);
    expect(messages.attachTo(result).errors).toEqual([{ refId: 'B', message: 'nope' }]);
  });

  it('tolerates a partially saved recordsQuery', async () => {
    const { connector, fetchData } = connectorWith(
      { externalId: 'alarms_live', type: 'Mutable' },
      { items: [] }
    );
    // Only the fields an older dashboard might carry
    const partial = { view, mode: 'list' } as unknown as RecordsQuery;
    const result = await new RecordsDatasource(connector).query(options(partial), messages);

    expect(result.data).toHaveLength(1);
    const post = fetchData.mock.calls.find(([r]) => r.method === 'POST')![0];
    expect(post.data.limit).toBe(1000);
    expect(post.data.sources[0].properties).toEqual(['*']);
  });

  // Record views left alpha: the API now accepts view sources without the
  // cdf-version header, so sending one would be dead weight.
  it('sends no alpha version header', async () => {
    const { connector, fetchData } = connectorWith(
      { externalId: 'alarms_live', type: 'Mutable' },
      { items: [] }
    );
    await new RecordsDatasource(connector).query(options(baseQuery()), messages);
    const post = fetchData.mock.calls.find(([r]) => r.method === 'POST')![0];
    expect(post.headers?.['cdf-version']).toBeUndefined();
  });

  it('routes aggregate mode to the aggregate endpoint', async () => {
    const { connector, fetchData } = connectorWith(
      { externalId: 'alarms_live', type: 'Mutable' },
      { aggregates: { count: { count: 42 } } }
    );
    const ds = new RecordsDatasource(connector);
    await ds.query(
      options(
        baseQuery({ mode: 'aggregate', metrics: [{ name: 'count', function: 'count' }] })
      ),
      messages
    );

    const post = fetchData.mock.calls.find(([r]) => r.method === 'POST')![0];
    expect(post.path).toBe('/streams/alarms_live/records/aggregate');
  });
});
