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

  it('offers string series only what CDF accepts for them', () => {
    expect(values('string')).toEqual([
      'none', 'interpolation', 'stepInterpolation', 'count',
      'countGood', 'countUncertain', 'countBad', 'durationGood', 'durationUncertain', 'durationBad',
    ]);
    expect(isAggregateAllowed('string', 'average')).toBe(false);
    expect(isAggregateAllowed('string', 'interpolation')).toBe(true);
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

  it('explains a refused aggregate with the choices that work', () => {
    expect(unavailableAggregateMessage('string', 'average')).toBe(
      'Average is not available for string time series. Choose None (raw data points) or one of: ' +
        'Interpolation, Step Interpolation, Count, Count (good), Count (uncertain), Count (bad), ' +
        'Duration (good), Duration (uncertain), Duration (bad).'
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

  it('gives string series no group of their own', () => {
    expect(shape('string').map((entry) => entry.split(':')[0])).toEqual(['none', 'Common']);
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
    expect(datapointsModePatch('aggregate', { aggregation: 'none' }, 'string')).toEqual({ aggregation: 'interpolation' });
    expect(datapointsModePatch('aggregate', {}, undefined)).toEqual({ aggregation: 'average' });
    // An aggregation the type refuses gives way too.
    expect(datapointsModePatch('aggregate', { aggregation: 'average', latestValue: true }, 'string')).toEqual({
      latestValue: false,
      aggregation: 'interpolation',
    });
  });

  it('Aggregate comes back to the aggregate the query had before Raw', () => {
    expect(datapointsModePatch('aggregate', { aggregation: 'none' }, 'numeric', 'max')).toEqual({ aggregation: 'max' });
    // Unless the type refuses it.
    expect(datapointsModePatch('aggregate', { aggregation: 'none' }, 'string', 'max')).toEqual({
      aggregation: 'interpolation',
    });
  });

  it('starts each type on a sensible aggregate', () => {
    expect(firstAggregateFor('numeric')).toBe('average');
    expect(firstAggregateFor('string')).toBe('interpolation');
  });

  it('has nothing to aggregate a state series with, which is read raw only', () => {
    expect(canAggregate('state')).toBe(false);
    expect(firstAggregateFor('state')).toBe('none');
  });
});
