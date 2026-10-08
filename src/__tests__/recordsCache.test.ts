import { RecordsDatasource } from '../datasources/RecordsDatasource';
import { Connector } from '../connector';
import { defaultRecordsQuery, RecordsQuery, Tab } from '../types';

jest.mock('../appEventHandler', () => ({ handleWarning: jest.fn(), handleError: jest.fn() }));

const view = {
  space: 'opcua_alarms',
  externalId: 'OpcUaArchivedAlarmConditionView',
  version: 'v1',
  streamId: 'historic_alarms',
};

const RANGE = { from: { valueOf: () => 1_700_000_000_000 }, to: { valueOf: () => 1_700_086_400_000 } };

const aggregateQuery = (metricFn: 'count' | 'avg' | 'max', name = 'm'): RecordsQuery => ({
  ...defaultRecordsQuery,
  view,
  mode: 'aggregate',
  buckets: [{ kind: 'timeHistogram', property: 'Time', interval: '1h' }],
  metrics: [
    metricFn === 'count'
      ? { name, function: 'count' }
      : { name, function: metricFn, property: 'ActiveDuration' },
  ],
});

/**
 * The request cache is keyed on the whole request body, so an edit to the query has
 * to miss it. A cache that ignored the aggregate spec would keep serving the
 * previous metric's numbers until the time range moved.
 */
describe('records request caching', () => {
  const run = async (ds: RecordsDatasource, recordsQuery: RecordsQuery) =>
    ds.query({
      targets: [{ refId: 'A', tab: Tab.Records, recordsQuery } as any],
      range: RANGE,
      maxDataPoints: 100,
    } as any);

  it('issues a fresh request when the metric function changes', async () => {
    const fetch = jest.fn().mockResolvedValue({ data: { items: [], aggregates: {} } });
    const connector = { fetchData: fetch, fetchItems: jest.fn().mockResolvedValue([]) } as unknown as Connector;
    const ds = new RecordsDatasource(connector);

    await run(ds, aggregateQuery('count'));
    await run(ds, aggregateQuery('avg'));

    const aggregateCalls = fetch.mock.calls.filter(([r]) => String(r.path).includes('/records/aggregate'));
    expect(aggregateCalls).toHaveLength(2);
    const [first, second] = aggregateCalls.map(([r]) => JSON.stringify(r.data));
    expect(first).not.toEqual(second);
  });

  it('issues a fresh request when only the metric name changes', async () => {
    const fetch = jest.fn().mockResolvedValue({ data: { items: [], aggregates: {} } });
    const connector = { fetchData: fetch, fetchItems: jest.fn().mockResolvedValue([]) } as unknown as Connector;
    const ds = new RecordsDatasource(connector);

    await run(ds, aggregateQuery('avg', 'count'));
    await run(ds, aggregateQuery('avg', 'duration'));

    const bodies = fetch.mock.calls
      .filter(([r]) => String(r.path).includes('/records/aggregate'))
      .map(([r]) => JSON.stringify(r.data));
    expect(bodies).toHaveLength(2);
    expect(bodies[0]).toContain('"count"');
    expect(bodies[1]).toContain('"duration"');
  });
});
