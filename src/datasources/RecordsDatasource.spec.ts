import { RecordsDatasource } from './RecordsDatasource';
import { Connector } from '../connector';
import { RecordsQuery } from '../types';
import { handleError, handleWarning } from '../appEventHandler';

jest.mock('../appEventHandler', () => ({
  handleWarning: jest.fn(),
  handleError: jest.fn(),
}));

const view = {
  space: 'alarm_schema',
  externalId: 'AlarmEvent',
  version: 'v1',
  streamId: 'alarms_live',
};

const baseQuery = (overrides: Partial<RecordsQuery> = {}): RecordsQuery => ({
  view,
  filters: [],
  sort: [],
  limit: 1000,
  columns: [],
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

  const warnSpy = handleWarning as jest.Mock;
  const errorSpy = handleError as jest.Mock;

  beforeEach(() => jest.clearAllMocks());

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
    return { connector: { fetchData } as unknown as Connector, fetchData };
  };

  it('skips targets with no record view selected', async () => {
    const { connector, fetchData } = connectorWith(null, null);
    const ds = new RecordsDatasource(connector);
    const result = await ds.query(
      options(baseQuery({ view: undefined }))
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
    await ds.query(options(baseQuery()));

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
    await ds.query(options(baseQuery({ limit: 5 })));

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('maximum number of items'), 'A');
  });

  it('forces the time range on immutable streams and says so', async () => {
    const { connector, fetchData } = connectorWith(
      { externalId: 'archive', type: 'Immutable', settings: { limits: {} } },
      { items: [] }
    );
    const ds = new RecordsDatasource(connector);
    await ds.query(options(baseQuery({ timeFilterMode: 'none' })));

    const post = fetchData.mock.calls.find(([r]) => r.method === 'POST')![0];
    expect(post.data.lastUpdatedTime).toEqual({ gte: RANGE[0], lte: RANGE[1] });
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('immutable'), 'A');
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
    await ds.query(options(baseQuery()));

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('accepts at most'),
      'A'
    );
  });

  it('still queries when the stream metadata cannot be read', async () => {
    const fetchData = jest.fn((request: any) =>
      request.method === 'GET'
        ? Promise.reject(new Error('403'))
        : Promise.resolve({ data: { items: [] } })
    );
    const ds = new RecordsDatasource({ fetchData } as unknown as Connector);
    const result = await ds.query(options(baseQuery()));

    expect(result.data).toHaveLength(1);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('reports a query failure exactly once, through the response', async () => {
    const fetchData = jest.fn((request: any) =>
      request.method === 'GET'
        ? Promise.resolve({ data: { externalId: 'alarms_live', type: 'Mutable' } })
        : Promise.reject(new Error('boom'))
    );
    const ds = new RecordsDatasource({ fetchData } as unknown as Connector);
    const result = await ds.query(options(baseQuery()));

    expect(result.data).toEqual([]);
    expect(result.errors).toEqual([{ refId: 'A', message: 'boom' }]);
    // Also pushing it to the editor banner would show the same failure twice
    expect(errorSpy).not.toHaveBeenCalled();
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
    const ds = new RecordsDatasource({ fetchData } as unknown as Connector);
    const result = await ds.query(options(baseQuery()));

    expect(result.data).toEqual([]);
    expect(result.errors).toEqual([{ refId: 'A', message: 'Size is too large' }]);
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
    const ds = new RecordsDatasource({ fetchData } as unknown as Connector);
    const result = await ds.query({
      range: { from: { valueOf: () => RANGE[0] }, to: { valueOf: () => RANGE[1] } },
      targets: [
        { refId: 'A', tab: 'Records', recordsQuery: baseQuery() },
        { refId: 'B', tab: 'Records', recordsQuery: baseQuery({ limit: 7 }) },
      ],
    } as any);

    expect(result.data).toHaveLength(1);
    expect(result.errors).toEqual([{ refId: 'B', message: 'nope' }]);
  });

  it('tolerates a partially saved recordsQuery', async () => {
    const { connector, fetchData } = connectorWith(
      { externalId: 'alarms_live', type: 'Mutable' },
      { items: [] }
    );
    // Only the fields an older dashboard might carry
    const partial = { view } as unknown as RecordsQuery;
    const result = await new RecordsDatasource(connector).query(options(partial));

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
    await new RecordsDatasource(connector).query(options(baseQuery()));
    const post = fetchData.mock.calls.find(([r]) => r.method === 'POST')![0];
    expect(post.headers?.['cdf-version']).toBeUndefined();
  });

});
