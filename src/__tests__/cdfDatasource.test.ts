import { Err, Ok } from '../types';
import {
  datapoints2Tuples,
  reduceTimeseries,
  labelContainsVariableProps,
  concurrent,
} from '../cdf/client';
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

  describe('concurrent', () => {
    it('should return failures and successes', async () => {
      const queries = [0, 1, 2, 3];
      const results = await concurrent(queries, async (number) => {
        if (number % 2) {
          return new Err(number);
        }
        return new Ok(number);
      });
      expect(results).toEqual({
        succeded: [0, 2],
        failed: [1, 3],
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
