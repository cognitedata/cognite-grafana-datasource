import { fillLimitToMs, formatFillLimit, granularityToMs, resolveFillLimit } from './gapFill';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

describe('granularityToMs', () => {
  it.each([
    ['30s', 30_000],
    ['30second', 30_000],
    ['5m', 300_000],
    ['2minute', 120_000],
    ['h', HOUR],
    ['12hour', 12 * HOUR],
    ['1d', DAY],
    ['1day', DAY],
    ['1mo', 31 * DAY],
    ['3month', 93 * DAY],
  ])('reads %s', (granularity, expected) => {
    expect(granularityToMs(granularity)).toBe(expected);
  });

  // Spellings the datapoints API rejects.
  it.each(['', '0h', '1.5h', '1w', '1y', '1q', '2hours', '5min', '1H', '500ms', 'auto'])(
    'rejects %s',
    (granularity) => {
      expect(granularityToMs(granularity)).toBeUndefined();
    }
  );
});

describe('fillLimitToMs', () => {
  it('takes seconds to days', () => {
    expect(fillLimitToMs('90s')).toBe(90_000);
    expect(fillLimitToMs('4h')).toBe(4 * HOUR);
    expect(fillLimitToMs('10minute')).toBe(600_000);
  });

  it('rejects what the API rejects as a fill limit, months included', () => {
    for (const limit of ['1mo', '1w', '600000ms', '600000', '1.5h', '0d']) {
      expect(fillLimitToMs(limit)).toBeUndefined();
    }
  });
});

describe('formatFillLimit', () => {
  it('uses the largest unit that divides the duration', () => {
    expect(formatFillLimit(2 * DAY)).toBe('2d');
    expect(formatFillLimit(36 * HOUR)).toBe('36h');
    expect(formatFillLimit(90 * 60_000)).toBe('90m');
    expect(formatFillLimit(45_000)).toBe('45s');
  });

  it('keeps within each unit\'s cap: 120 seconds or minutes, 100,000 hours or days', () => {
    expect(formatFillLimit(120_000)).toBe('2m');
    expect(formatFillLimit(150_000)).toBe('3m');
    expect(formatFillLimit(200 * 60_000)).toBe('4h');
    expect(formatFillLimit(121 * 60_000)).toBe('3h');
    expect(formatFillLimit(100 * 60_000)).toBe('100m');
    expect(formatFillLimit(100_001 * HOUR)).toBe('4167d');
  });

  it('rounds sub-second durations up to whole seconds', () => {
    expect(formatFillLimit(1500)).toBe('2s');
    expect(formatFillLimit(1)).toBe('1s');
  });
});

describe('resolveFillLimit', () => {
  it('sends nothing when gap filling is off', () => {
    expect(resolveFillLimit(undefined, '1h', 'average')).toEqual({});
  });

  it('multiplies the granularity', () => {
    expect(resolveFillLimit({ mode: 'granularity', multiple: 4 }, '15m', 'average')).toEqual({
      limit: '1h',
    });
    expect(resolveFillLimit({ mode: 'granularity', multiple: 3 }, '1d', 'average')).toEqual({
      limit: '3d',
    });
  });

  it('defaults the multiple to 4', () => {
    expect(resolveFillLimit({ mode: 'granularity' }, '1h', 'average').limit).toBe('4h');
  });

  it('measures a month granularity as 31 days, the bar the API sets', () => {
    expect(resolveFillLimit({ mode: 'granularity', multiple: 1 }, '1mo', 'average').limit).toBe('31d');
  });

  it('refuses a multiple that is not a whole number of at least 1', () => {
    for (const multiple of [0, -2, 1.5, NaN]) {
      const res = resolveFillLimit({ mode: 'granularity', multiple }, '1h', 'average');
      expect(res.limit).toBeUndefined();
      expect(res.warning).toMatch(/whole number/);
    }
  });

  it('sends a fixed limit as typed', () => {
    expect(resolveFillLimit({ mode: 'duration', limit: '6h' }, '1h', 'average')).toEqual({
      limit: '6h',
    });
    expect(resolveFillLimit({ mode: 'duration', limit: ' 1hour ' }, '1h', 'average')).toEqual({
      limit: '1hour',
    });
  });

  it('raises a fixed limit below the granularity to the granularity, with a warning', () => {
    const res = resolveFillLimit({ mode: 'duration', limit: '30m' }, '2h', 'average');
    expect(res.limit).toBe('2h');
    expect(res.warning).toMatch(/shorter than the granularity/);
  });

  it('rewrites a fixed limit past its unit\'s cap, warning only when it had to round', () => {
    expect(resolveFillLimit({ mode: 'duration', limit: '180m' }, '1m', 'average')).toEqual({
      limit: '3h',
    });
    const rounded = resolveFillLimit({ mode: 'duration', limit: '200m' }, '1m', 'average');
    expect(rounded.limit).toBe('4h');
    expect(rounded.warning).toMatch(/200m cannot be sent as is/);
  });

  it('keeps a multiple within the caps', () => {
    expect(resolveFillLimit({ mode: 'granularity', multiple: 20 }, '10m', 'average').limit).toBe('4h');
  });

  it('warns about a fixed limit the API would reject', () => {
    const res = resolveFillLimit({ mode: 'duration', limit: '1w' }, '1h', 'average');
    expect(res.limit).toBeUndefined();
    expect(res.warning).toMatch(/'1w' is not a fill limit/);
  });

  it('does not fill totalVariation, which the API refuses to combine with fill', () => {
    const res = resolveFillLimit({ mode: 'granularity', multiple: 2 }, '1h', 'totalVariation');
    expect(res.limit).toBeUndefined();
    expect(res.warning).toMatch(/totalVariation/);
  });

  it('does not fill with a granularity it cannot read', () => {
    const res = resolveFillLimit({ mode: 'granularity', multiple: 2 }, '1w', 'average');
    expect(res.limit).toBeUndefined();
    expect(res.warning).toMatch(/granularity '1w'/);
  });
});
