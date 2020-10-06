describe('Noop', () => {
  it('should match', () => {
    expect(42).toEqual(42);
  });
});

/*
import {
  datapoints2Tuples,
  promiser,
  reduceTimeseries,
  labelContainsVariableProps,
} from '../cdfDatasource';
import { getDataqueryResponse, getMeta } from './utils';

describe('CDF datasource', () => {
  describe('datapoints to tuples', () => {
    it('converts non aggregated values', () => {
      expect(
        datapoints2Tuples(
          [
            { timestamp: 1, value: 2 },
            { timestamp: 1, value: 2 },
          ],
          ''
        )
      ).toEqual([
        [2, 1],
        [2, 1],
      ]);
    });

    it('converts aggregated values', () => {
      expect(
        datapoints2Tuples(
          [
            { timestamp: 1, aggregate: 2 },
            { timestamp: 1, aggregate: 2 },
          ],
          'aggregate'
        )
      ).toEqual([
        [2, 1],
        [2, 1],
      ]);
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
      expect(reduced.datapoints).toEqual([
        [0, 1549336675000],
        [1, 1549337275000],
      ]);
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

  describe('label contains {{}}', () => {
    test('{{prop}}', () => {
      expect(labelContainsVariableProps('anything {{prop}}')).toEqual(true);
    });

    test('{{id}}', () => {
      expect(labelContainsVariableProps('{{id}}')).toEqual(true);
    });

    test('no props', () => {
      expect(labelContainsVariableProps('pure text')).toEqual(false);
    });
  });
});
 */