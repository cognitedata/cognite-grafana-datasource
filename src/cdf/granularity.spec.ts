import {
  autoStepFactor,
  autoBucketInterval,
  isAutoInterval,
  resolveDatapointsGranularity,
} from './granularity';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('autoStepFactor', () => {
  it('reads plain auto, written any of the ways it always could be, as 1', () => {
    for (const value of [undefined, '', ' ', 'auto', 'AUTO', '$__interval']) {
      expect(autoStepFactor(value)).toBe(1);
    }
  });

  it('reads the coarser step', () => {
    expect(autoStepFactor('auto:fewer')).toBe(4);
  });

  it('leaves fixed values alone', () => {
    expect(autoStepFactor('1h')).toBeUndefined();
    expect(autoStepFactor('auto:bogus')).toBeUndefined();
    expect(autoStepFactor('auto:overview')).toBeUndefined();
    expect(isAutoInterval('15m')).toBe(false);
    expect(isAutoInterval('auto:fewer')).toBe(true);
  });
});

describe('resolveDatapointsGranularity', () => {
  it('keeps plain auto exactly as it was: the panel interval, at least a second', () => {
    expect(resolveDatapointsGranularity('', 2000)).toBe('2s');
    expect(resolveDatapointsGranularity(undefined, 90 * MINUTE)).toBe('2h');
    expect(resolveDatapointsGranularity('', 200)).toBe('1s');
  });

  it('scales the interval for the coarser step and snaps it to a round value', () => {
    // 10m × 4 = 40m, snapped up to 1h; 2d × 4 = 8d, snapped up to 14d.
    expect(resolveDatapointsGranularity('auto:fewer', 10 * MINUTE)).toBe('1h');
    expect(resolveDatapointsGranularity('auto:fewer', 48 * HOUR)).toBe('14d');
  });

  it('never goes below a second, which the datapoints API needs', () => {
    expect(resolveDatapointsGranularity('auto:fewer', 50)).toBe('5s');
  });

  it('sends a fixed granularity as typed', () => {
    expect(resolveDatapointsGranularity('12h', 1000)).toBe('12h');
    expect(resolveDatapointsGranularity(' 1d ', 1000)).toBe('1d');
  });
});

describe('autoBucketInterval with a coarser step', () => {
  it('asks for proportionally wider buckets', () => {
    // 7 days over 1000 points ≈ 10m → 15m; ×4 ≈ 40m → 1h.
    expect(autoBucketInterval(7 * DAY, 1000)).toBe('15m');
    expect(autoBucketInterval(7 * DAY, 1000, Infinity, 4)).toBe('1h');
  });

  it('still respects the bucket ceiling', () => {
    expect(autoBucketInterval(DAY, 1_000_000, 100, 4)).toBe('15m');
  });
});
