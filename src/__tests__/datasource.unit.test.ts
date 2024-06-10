import { dateTime } from '@grafana/data';
import { formQueryForItems } from '../cdf/client';
import { Connector } from '../connector';
import { defaultQuery, CogniteQuery, QueryOptions } from '../types';
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
    timezone: 'UTC',
  } as QueryOptions;

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
