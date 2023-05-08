import { Err, Ok } from '../types';
import {
  datapoints2Tuples,
  reduceTimeseries,
  labelContainsVariableProps,
  concurrent,
  convertItemsToTable,
} from '../cdf/client';
import { getDataqueryResponse, getMeta } from '../test_utils';

describe('CDF client', () => {
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

    it('should return latest data point even if outside the time range with a correct label', () => {
      const id = 1;
      const metaResponses: any[] = [
        {
          result: getDataqueryResponse(
            {
              items: [{ id }],
              aggregates: ['average'],
            },
            '',
            1
          ),
          metadata: getMeta(id, 'average', [''], 'latest'),
        },
      ];
      const [reduced] = reduceTimeseries(metaResponses, [1549337270000, 1549337275000]);
      expect(reduced.datapoints).toEqual([[0, 1549336675000]]);
      expect(reduced.target).toEqual(`${id}`);
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

  describe('convert items to table', () => {
    test('date and null values', () => {
      const items = [
        { id: 1, name: 'name1', metadata: { prop: 1 }, startTime: 100 },
        { id: 2, name: 'name2' },
      ];
      const columns = ['name', 'metadata.prop', 'startTime'];
      const table = convertItemsToTable(items, columns, "table");
      expect(table).toEqual({
        rows: [
          ['name1', 1, new Date(100)],
          ['name2', undefined, undefined],
        ],
        type: 'table',
        name: "table",
        columns: [
          {
            text: 'name',
          },
          {
            text: 'metadata.prop',
          },
          {
            text: 'startTime',
          },
        ],
      });
    });
  });
});
