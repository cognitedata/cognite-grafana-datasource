import {
  aggregateGroupsFor,
  aggregateOptionsFor,
  canAggregate,
  datapointsModeOf,
  datapointsModePatch,
  defaultAggregationFor,
  firstAggregateFor,
  isAggregateAllowed,
  isDurationAggregate,
  returnsSeriesValues,
  unavailableAggregateMessage,
} from './aggregates';

const values = (kind?: 'numeric' | 'string' | 'state') => aggregateOptionsFor(kind).map((o) => o.value);

describe('aggregate catalog', () => {
  it('keeps the numeric list the editor always offered, then adds the status aggregates', () => {
    expect(values('numeric')).toEqual([
      'none', 'average', 'max', 'min', 'count', 'sum', 'interpolation', 'stepInterpolation',
      'continuousVariance', 'discreteVariance', 'totalVariation',
      'countGood', 'countUncertain', 'countBad', 'durationGood', 'durationUncertain', 'durationBad',
    ]);
    expect(values()).toEqual(values('numeric'));
  });

  it('offers string series their raw values only, while their aggregates are in preview', () => {
    expect(values('string')).toEqual(['none']);
    expect(isAggregateAllowed('string', 'average')).toBe(false);
    expect(isAggregateAllowed('string', 'interpolation')).toBe(false);
  });

  it('treats a missing aggregation as allowed', () => {
    expect(isAggregateAllowed('string', undefined)).toBe(true);
    expect(isAggregateAllowed('string', '')).toBe(true);
  });

  it('defaults string series to raw values and numeric ones to average', () => {
    expect(defaultAggregationFor('string')).toBe('none');
    expect(defaultAggregationFor('numeric')).toBe('average');
  });

  it('knows which aggregates are durations and which return the series own values', () => {
    expect(isDurationAggregate('durationBad')).toBe(true);
    expect(isDurationAggregate('countBad')).toBe(false);
    expect(returnsSeriesValues('none')).toBe(true);
    expect(returnsSeriesValues('stepInterpolation')).toBe(true);
    expect(returnsSeriesValues('count')).toBe(false);
  });

  it('explains a refused aggregate', () => {
    expect(unavailableAggregateMessage('string', 'average')).toBe(
      'Average is not available for string time series. Choose None (raw data points).'
    );
    expect(unavailableAggregateMessage('numeric', 'stateCount')).toMatch(
      /^stateCount is not available for numeric time series\. Choose None \(raw data points\) or one of: Average, /
    );
  });
});

describe('aggregateGroupsFor', () => {
  const shape = (kind?: 'numeric' | 'string' | 'state') =>
    aggregateGroupsFor(kind).map((entry) =>
      entry.options ? `${entry.label}: ${entry.options.map((o: any) => o.value).join(',')}` : entry.value
    );

  it('lists None, then the aggregates of the type, then the common ones', () => {
    expect(shape('numeric')).toEqual([
      'none',
      'Numeric: average,max,min,sum,continuousVariance,discreteVariance,totalVariation',
      'Common: count,interpolation,stepInterpolation,countGood,countUncertain,countBad,durationGood,durationUncertain,durationBad',
    ]);
    expect(shape()).toEqual(shape('numeric'));
  });

  it('lists only None for string series, leaving out empty groups', () => {
    expect(shape('string')).toEqual(['none']);
  });

  it('leaves None out for an editor that offers raw data points as a mode', () => {
    expect(shape('numeric')[0]).toBe('none');
    expect(
      aggregateGroupsFor('numeric', { withNone: false }).map((entry) => entry.label)
    ).toEqual(['Numeric', 'Common']);
  });

  it('describes every aggregate', () => {
    for (const kind of ['numeric', 'string', 'state'] as const) {
      expect(aggregateOptionsFor(kind).filter((option) => !option.description)).toEqual([]);
    }
  });
});

describe('data points mode', () => {
  it('reads Latest, Raw or Aggregate off the saved query', () => {
    expect(datapointsModeOf({ aggregation: 'average', latestValue: true })).toBe('latest');
    expect(datapointsModeOf({ aggregation: 'none' })).toBe('raw');
    expect(datapointsModeOf({})).toBe('raw');
    expect(datapointsModeOf({ aggregation: 'count', latestValue: false })).toBe('aggregate');
  });

  it('Latest leaves the aggregation alone, so switching back finds it', () => {
    expect(datapointsModePatch('latest', { aggregation: 'max' }, 'numeric')).toEqual({ latestValue: true });
    expect(datapointsModePatch('aggregate', { aggregation: 'max', latestValue: true }, 'numeric')).toEqual({
      latestValue: false,
      aggregation: 'max',
    });
  });

  it('Raw sets None, and Aggregate starts on the first aggregate of the type', () => {
    expect(datapointsModePatch('raw', { aggregation: 'max' }, 'numeric')).toEqual({ aggregation: 'none' });
    expect(datapointsModePatch('aggregate', { aggregation: 'none' }, 'numeric')).toEqual({ aggregation: 'average' });
    expect(datapointsModePatch('aggregate', {}, undefined)).toEqual({ aggregation: 'average' });
    // An aggregation the type refuses gives way too.
    expect(datapointsModePatch('aggregate', { aggregation: 'stateCount', latestValue: true }, 'numeric')).toEqual({
      latestValue: false,
      aggregation: 'average',
    });
  });

  it('Aggregate comes back to the aggregate the query had before Raw', () => {
    expect(datapointsModePatch('aggregate', { aggregation: 'none' }, 'numeric', 'max')).toEqual({ aggregation: 'max' });
    // Unless the type refuses it.
    expect(datapointsModePatch('aggregate', { aggregation: 'none' }, 'numeric', 'stateCount')).toEqual({
      aggregation: 'average',
    });
  });

  it('starts numeric series on Average', () => {
    expect(firstAggregateFor('numeric')).toBe('average');
  });

  it('has nothing to aggregate string and state series with, which are read raw only', () => {
    for (const kind of ['string', 'state'] as const) {
      expect(canAggregate(kind)).toBe(false);
      expect(firstAggregateFor(kind)).toBe('none');
    }
  });
});
