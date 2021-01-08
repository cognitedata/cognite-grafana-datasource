import { Connector } from '../connector';
import { defaultQuery, CogniteQuery } from '../types';
import { getDataQueryRequestItems } from '../datasource';

describe('getDataQueryRequestItems: generate cdf data points request items', () => {
  const connector: Connector = ({
    fetchData: jest.fn(),
    fetchItems: jest.fn(),
    fetchAndPaginate: jest.fn(),
  } as unknown) as Connector;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('simple data points query', async () => {
    const res = await getDataQueryRequestItems(
      {
        ...(defaultQuery as CogniteQuery),
        targetRefType: 'externalId',
        target: 'ext',
      },
      connector,
      1000
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
        ...(defaultQuery as CogniteQuery),
        latestValue: true,
        before: 'now',
        targetRefType: 'id',
        target: 1,
      },
      connector,
      1000
    );

    expect(res.items).toEqual([
      {
        before: 'now',
        id: 1,
      },
    ]);
  });

  it('latest data point query with default "before"', async () => {
    const { items } = await getDataQueryRequestItems(
      {
        ...(defaultQuery as CogniteQuery),
        latestValue: true,
        targetRefType: 'externalId',
        target: 'ext',
      },
      connector,
      1000
    );

    expect(items.length).toEqual(1);
    expect(items[0].externalId).toEqual('ext');
    expect(items[0].before).toBeLessThanOrEqual(Date.now());
  });
});
