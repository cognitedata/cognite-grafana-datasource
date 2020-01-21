import { filterEmptyQueryTargets, datapoints2Tuples } from '../cdfDatasource';

describe('CDF datasource', () => {
  describe('filterQueryTargets', () => {
    const normalTargets = [
      {
        target: '',
        tab: 'Asset',
        assetQuery: {
          target: 'some id',
        },
      },
      {
        target: 'timeseriesID',
      },
    ];
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
      expect(filterEmptyQueryTargets([{ hide: true }])).toEqual([]);
    });

    it('should filter out empty asset targets', () => {
      const targets = [
        {
          target: '',
          tab: 'Custom',
        },
        {
          target: '',
          tab: 'Asset',
          assetQuery: {
            target: '',
          },
        },
        ...normalTargets,
      ];
      expect(filterEmptyQueryTargets(targets)).toEqual(normalTargetsResponse);
    });

    it('should filter out empty timeseries targets', () => {
      const targets = [
        {
          target: 'Start typing tag id here',
          tab: 'Timeseries',
        },
        {
          target: '',
        },
        ...normalTargets,
      ];
      expect(filterEmptyQueryTargets(targets)).toEqual(normalTargetsResponse);
    });

    it('should not filter valid targets', () => {
      expect(filterEmptyQueryTargets(normalTargets)).toEqual(normalTargetsResponse);
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
});
