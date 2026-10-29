import { dateTime } from '@grafana/data';
import { formQueryForItems, resolveTargetFill } from '../cdf/client';
import { Connector } from '../connector';
import { defaultQuery, CogniteQuery, QueryOptions, Tab } from '../types';
import { getDataQueryRequestItems } from '../datasources/TimeseriesDatasource';

const defaultCogniteQuery = defaultQuery as CogniteQuery;

describe('getDataQueryRequestItems: generate cdf data points request items', () => {
  const connector: Connector = {
    fetchData: jest.fn(),
    fetchItems: jest.fn(),
    fetchAndPaginate: jest.fn(),
  } as unknown as Connector;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('simple data points query', async () => {
    const res = await getDataQueryRequestItems(
      {
        ...defaultCogniteQuery,
        targetRefType: 'externalId',
        target: 'ext',
      },
      connector,
      1000,
      []
    );

    expect(res.items).toEqual([
      {
        externalId: 'ext',
      },
    ]);
  });

  it('latest data point query', async () => {
    const res = await getDataQueryRequestItems(
      {
        ...defaultCogniteQuery,
        latestValue: true,
        targetRefType: 'id',
        target: 1,
      },
      connector,
      1000,
      []
    );

    expect(res.items).toEqual([
      {
        id: 1,
      },
    ]);
  });
});

describe('formQueryForItems: enrich items with additional props for request', () => {
  const queryOptions = {
    range: { from: dateTime(0), to: dateTime(3000) },
    intervalMs: 2000,
    timeZone: 'UTC',
  } as any;

  it('for timeseries/data request', () => {
    const queryItems = formQueryForItems(
      {
        items: [{ externalId: 'ext' }],
        type: 'data',
        target: defaultCogniteQuery,
      },
      queryOptions
    );

    expect(queryItems).toEqual({
      aggregates: ['average'],
      end: 3000,
      granularity: '2s',
      items: [
        {
          externalId: 'ext',
        },
      ],
      limit: 10000,
      start: 0,
      timeZone: 'UTC'
    });
  });

  it('for timeseries/data/latest request', () => {
    const queryItems = formQueryForItems(
      {
        items: [{ externalId: 'ext' }],
        type: 'latest',
        target: defaultCogniteQuery,
      },
      queryOptions
    );

    expect(queryItems).toEqual({
      items: [
        {
          externalId: 'ext',
          before: 3000,
        },
      ],
    });
  });
});

describe('formQueryForItems: gap filling', () => {
  const queryOptions = {
    range: { from: dateTime(0), to: dateTime(3000) },
    intervalMs: 60_000,
    timeZone: 'UTC',
  } as any;
  const instanceItem = { instanceId: { space: 'sp', externalId: 'ts' } };
  const cdmTarget = (patch: Partial<CogniteQuery> = {}) =>
    ({
      ...defaultCogniteQuery,
      tab: Tab.CogniteTimeSeriesSearch,
      gapFill: { mode: 'granularity', multiple: 4 },
      ...patch,
    }) as CogniteQuery;

  it('adds fill to every item, scaled from the auto granularity', () => {
    const request = formQueryForItems(
      { items: [instanceItem, instanceItem], type: 'data', target: cdmTarget() },
      queryOptions
    );
    expect(request.granularity).toBe('1m');
    expect(request.items).toEqual([
      { ...instanceItem, fill: { limit: '4m' } },
      { ...instanceItem, fill: { limit: '4m' } },
    ]);
  });

  it('scales from an explicit granularity', () => {
    const request = formQueryForItems(
      { items: [instanceItem], type: 'data', target: cdmTarget({ granularity: '2h' }) },
      queryOptions
    );
    expect(request.items[0].fill).toEqual({ limit: '8h' });
  });

  it('sends a fixed limit, raised to the granularity when shorter', () => {
    const fixed = (limit: string, granularity: string) =>
      formQueryForItems(
        {
          items: [instanceItem],
          type: 'data',
          target: cdmTarget({ granularity, gapFill: { mode: 'duration', limit } }),
        },
        queryOptions
      ).items[0].fill;
    expect(fixed('6h', '1h')).toEqual({ limit: '6h' });
    expect(fixed('30m', '1h')).toEqual({ limit: '1h' });
  });

  it('fills GraphQL series too', () => {
    const request = formQueryForItems(
      {
        items: [instanceItem],
        type: 'data',
        target: cdmTarget({ tab: Tab.FlexibleDataModelling }),
      },
      queryOptions
    );
    expect(request.items[0].fill).toEqual({ limit: '4m' });
  });

  it.each([
    ['legacy time series tab', { tab: Tab.Timeseries }, 'data'],
    ['raw data points', { aggregation: 'none' }, 'data'],
    ['totalVariation', { aggregation: 'totalVariation' }, 'data'],
    ['gap filling off', { gapFill: undefined }, 'data'],
    ['latest value', {}, 'latest'],
  ] as const)('sends no fill for %s', (_, patch, type) => {
    const request = formQueryForItems(
      { items: [instanceItem], type, target: cdmTarget(patch as Partial<CogniteQuery>) },
      queryOptions
    );
    expect(request.items[0]).not.toHaveProperty('fill');
  });
});

describe('resolveTargetFill', () => {
  it('reports why a fill was adjusted', () => {
    const target = {
      ...defaultCogniteQuery,
      tab: Tab.CogniteTimeSeriesSearch,
      granularity: '1d',
      gapFill: { mode: 'duration', limit: '1h' },
    } as CogniteQuery;
    expect(resolveTargetFill(target, 'data', 1000)).toEqual({
      limit: '1d',
      warning: expect.stringMatching(/shorter than the granularity/),
    });
  });

  it('stays silent outside the data modeling tabs', () => {
    const target = {
      ...defaultCogniteQuery,
      tab: Tab.Timeseries,
      gapFill: { mode: 'duration', limit: 'bogus' },
    } as CogniteQuery;
    expect(resolveTargetFill(target, 'data', 1000)).toEqual({});
  });
});

describe('formQueryForItems: auto granularity steps', () => {
  const queryOptions = {
    range: { from: dateTime(0), to: dateTime(3000) },
    intervalMs: 10 * 60_000,
    timeZone: 'UTC',
  } as any;
  const granularityFor = (granularity: string) =>
    formQueryForItems(
      {
        items: [{ externalId: 'ext' }],
        type: 'data',
        target: { ...defaultCogniteQuery, granularity },
      },
      queryOptions
    ).granularity;

  it('resolves the coarser step from the panel interval', () => {
    expect(granularityFor('')).toBe('10m');
    expect(granularityFor('auto:fewer')).toBe('1h');
  });

  it('scales a fill multiple from the resolved step', () => {
    const request = formQueryForItems(
      {
        items: [{ instanceId: { space: 'sp', externalId: 'ts' } }],
        type: 'data',
        target: {
          ...defaultCogniteQuery,
          tab: Tab.CogniteTimeSeriesSearch,
          granularity: 'auto:fewer',
          gapFill: { mode: 'granularity', multiple: 2 },
        } as CogniteQuery,
      },
      queryOptions
    );
    expect(request.granularity).toBe('1h');
    expect(request.items[0].fill).toEqual({ limit: '2h' });
  });
});

describe('formQueryForItems: unit conversion by series type', () => {
  const queryOptions = { range: { from: dateTime(0), to: dateTime(3000) }, intervalMs: 1000, timeZone: 'UTC' } as any;
  const target = {
    ...defaultCogniteQuery,
    tab: Tab.CogniteTimeSeriesSearch,
    aggregation: 'none',
    cogniteTimeSeries: { space: 'cdf_cdm', externalId: 'CogniteTimeSeries', version: 'v1', targetUnit: 'temperature:deg_f' },
  } as CogniteQuery;
  const item = { instanceId: { space: 'sp', externalId: 'ts' } };

  it('converts numeric series', () => {
    const request = formQueryForItems({ items: [item], type: 'data', target, kind: 'numeric' }, queryOptions);
    expect(request.items[0].targetUnit).toBe('temperature:deg_f');
  });

  it('leaves a target unit saved on a string or state query out of the request', () => {
    for (const kind of ['string', 'state'] as const) {
      const request = formQueryForItems({ items: [item], type: 'data', target, kind }, queryOptions);
      expect(request.items[0]).not.toHaveProperty('targetUnit');
    }
  });
});

describe('getDataQueryRequestItems: GraphQL series types', () => {
  const instanceId = { space: 'sp', externalId: 'ts' };
  const fdmTarget = (instanceKinds: Array<'numeric' | 'string' | 'state' | undefined>) =>
    ({
      ...defaultCogniteQuery,
      tab: Tab.FlexibleDataModelling,
      aggregation: 'none',
      flexibleDataModellingQuery: { instanceIds: [instanceId], instanceKinds },
    }) as unknown as CogniteQuery;

  it('trusts the type the query selected, without a lookup', async () => {
    const connector = { fetchItems: jest.fn() } as unknown as Connector;
    const res = await getDataQueryRequestItems(fdmTarget(['string']), connector, 1000, undefined);
    expect(res.kind).toBe('string');
    expect(connector.fetchItems).not.toHaveBeenCalled();
  });

  it('fails a query whose aggregation the selected type does not have, without a lookup', async () => {
    const connector = { fetchItems: jest.fn() } as unknown as Connector;
    const target = { ...fdmTarget(['string']), aggregation: 'average' } as CogniteQuery;
    await expect(getDataQueryRequestItems(target, connector, 1000, undefined)).rejects.toThrow(
      'Average is not available for string time series.'
    );
    expect(connector.fetchItems).not.toHaveBeenCalled();
  });

  it('reads only the state set of a state series the tab already looked up', async () => {
    const fetchItems = jest
      .fn()
      .mockResolvedValue([{ properties: { cdf_cdm: { 'CogniteStateSet/v1': { states: [{ numericValue: 0, stringValue: 'OFF' }] } } } }]);
    const connector = { fetchItems } as unknown as Connector;
    const target = fdmTarget(['state']) as any;
    target.flexibleDataModellingQuery.instanceStateSets = [{ space: 'sp', externalId: 'set' }];
    const res = await getDataQueryRequestItems(target, connector, 1000, undefined);
    expect(res.kind).toBe('state');
    expect(res.stateSet).toEqual([{ numericValue: 0, stringValue: 'OFF' }]);
    expect(fetchItems).toHaveBeenCalledTimes(1);
    expect(fetchItems.mock.calls[0][0].data.sources[0].source.externalId).toBe('CogniteStateSet');
  });

  it('makes no lookup for a state series the tab found without a state set', async () => {
    const connector = { fetchItems: jest.fn() } as unknown as Connector;
    const target = fdmTarget(['state']) as any;
    target.flexibleDataModellingQuery.instanceStateSets = [null];
    const res = await getDataQueryRequestItems(target, connector, 1000, undefined);
    expect(res.kind).toBe('state');
    expect(res.stateSet).toBeUndefined();
    expect(connector.fetchItems).not.toHaveBeenCalled();
  });

  it('looks up a series whose type was not selected, and a state series state set', async () => {
    const fetchItems = jest.fn().mockImplementation(async ({ data }) =>
      data.sources[0].source.externalId === 'CogniteStateSet'
        ? [{ properties: { cdf_cdm: { 'CogniteStateSet/v1': { states: [{ numericValue: 0, stringValue: 'OFF' }] } } } }]
        : [{ properties: { cdf_cdm: { 'CogniteTimeSeries/v1': { type: 'state', stateSet: { space: 'sp', externalId: 'set' } } } } }]
    );
    const connector = { fetchItems } as unknown as Connector;
    for (const hint of [undefined, 'state'] as const) {
      const res = await getDataQueryRequestItems(fdmTarget([hint]), connector, 1000, undefined);
      expect(res.kind).toBe('state');
      expect(res.stateSet).toEqual([{ numericValue: 0, stringValue: 'OFF' }]);
    }
  });
});
