import { datapoints2Tuples, promiser, reduceTimeseries } from '../cdfDatasource';
import { filterEmptyQueryTargets } from '../datasource';
import { getDataqueryResponse, getMeta } from './utils';
import { Tab, QueryTarget } from '../types';

const { Asset, Custom, Timeseries } = Tab;

describe('CDF datasource', () => {
  describe('filterQueryTargets', () => {
    const normalTargets = [
      {
        tab: Asset,
        assetQuery: {
          target: 'some id',
        },
      },
      {
        target: 1,
      },
    ] as QueryTarget[];
    const normalTargetsResponse = normalTargets.map((target: any) => ({
      ...target,
      warning: '',
      error: '',
    }));

    it('should return empty if empty', () => {
      expect(filterEmptyQueryTargets([])).toEqual([]);
    });

    it('should filter if target is empty', () => {
      expect(filterEmptyQueryTargets([null])).toEqual([]);
    });

    it('should filter if hide == true', () => {
      expect(filterEmptyQueryTargets([{ hide: true } as QueryTarget])).toEqual([]);
    });

    it('should filter out empty asset targets', () => {
      const targets = [
        {
          target: '',
          tab: Custom,
        },
        {
          target: '',
          tab: Asset,
          assetQuery: {
            target: '',
          },
        },
        ...normalTargets,
      ] as QueryTarget[];
      expect(filterEmptyQueryTargets(targets)).toEqual(normalTargetsResponse);
    });

    it('should filter out empty timeseries targets', () => {
      const targets = [
        {
          tab: 'Timeseries',
        },
        {},
        ...normalTargets,
      ] as QueryTarget[];
      expect(filterEmptyQueryTargets(targets)).toEqual(normalTargetsResponse);
    });

    it('should not filter valid targets', () => {
      expect(filterEmptyQueryTargets(normalTargets)).toEqual(normalTargetsResponse);
    });

    it('should filter out all empty (different types)', async () => {
      const emptyTimeseries: Partial<QueryTarget> = {
        tab: Timeseries,
        assetQuery: {
          target: '',
          timeseries: [],
          includeSubtrees: false,
          func: '',
        },
      };
      const emptyAsset: Partial<QueryTarget> = {
        ...emptyTimeseries,
        target: 1,
        tab: Asset,
      };
      const emptyCustom: Partial<QueryTarget> = {
        ...emptyTimeseries,
        tab: Custom,
        target: undefined,
      };
      const result = await filterEmptyQueryTargets([
        emptyTimeseries,
        emptyAsset,
        emptyCustom,
      ] as QueryTarget[]);
      expect(result).toEqual([]);
    });
  });

  describe('datapoints to tuples', () => {
    it('converts non aggregated values', () => {
      expect(
        datapoints2Tuples([{ timestamp: 1, value: 2 }, { timestamp: 1, value: 2 }], '')
      ).toEqual([[2, 1], [2, 1]]);
    });

    it('converts aggregated values', () => {
      expect(
        datapoints2Tuples(
          [{ timestamp: 1, aggregate: 2 }, { timestamp: 1, aggregate: 2 }],
          'aggregate'
        )
      ).toEqual([[2, 1], [2, 1]]);
    });
  });

  describe('reduce timeseries', () => {
    it('should return datapoints and the default label', () => {
      const id = 2;
      const externalIdPrefix = 'Timeseries';
      const metaResponses: any[] = [
        {
          result: getDataqueryResponse(
            {
              items: [{ id }],
              aggregates: ['average'],
            },
            externalIdPrefix
          ),
          metadata: getMeta(id, 'average', ['']),
        },
      ];
      const [reduced] = reduceTimeseries(metaResponses, [1549336675000, 1549337275000]);
      expect(reduced.datapoints).toEqual([[0, 1549336675000], [1, 1549337275000]]);
      expect(reduced.target).toEqual(`average ${externalIdPrefix}${id}`);
    });
  });

  describe('promiser', () => {
    it('should return failures and successes', async () => {
      const queries = [0, 1, 2, 3];
      const metadatas = ['a', 'b', 'c', 'd'];
      const results = await promiser(queries, metadatas, async (query, metadata) => {
        if (query % 2) {
          throw new Error(metadata);
        }
        return query;
      });
      expect(results).toEqual({
        failed: [
          {
            error: new Error('b'),
            metadata: 'b',
          },
          {
            error: new Error('d'),
            metadata: 'd',
          },
        ],
        succeded: [
          {
            result: 0,
            metadata: 'a',
          },
          {
            result: 2,
            metadata: 'c',
          },
        ],
      });
    });
  });
});
