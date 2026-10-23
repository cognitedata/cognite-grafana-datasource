import {
  aggregateGroupsFor,
  aggregateOptionsFor,
  defaultAggregationFor,
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

  it('describes every aggregate', () => {
    for (const kind of ['numeric', 'string', 'state'] as const) {
      expect(aggregateOptionsFor(kind).filter((option) => !option.description)).toEqual([]);
    }
  });
});
