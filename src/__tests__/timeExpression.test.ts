import {
  evaluateTimeExpression,
  parseDurationMs,
  TimeExpressionContext,
} from '../cdf/timeExpression';

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

const END = Date.parse('2026-08-27T12:00:00.000Z');
const START = END - 6 * HOUR;

const ctx: TimeExpressionContext = {
  startTime: START,
  endTime: END,
  now: END,
  maxFilteringIntervalMs: 7 * DAY, // PT168H
};

const at = (iso: string) => Date.parse(iso);

describe('parseDurationMs', () => {
  it('parses simple durations', () => {
    expect(parseDurationMs('30m')).toBe(30 * 60 * 1000);
    expect(parseDurationMs('12h')).toBe(12 * HOUR);
    expect(parseDurationMs('7d')).toBe(7 * DAY);
    expect(parseDurationMs('2w')).toBe(14 * DAY);
    expect(parseDurationMs('500ms')).toBe(500);
  });

  it('parses ISO-8601 durations as the API reports them', () => {
    expect(parseDurationMs('PT168H')).toBe(7 * DAY);
    expect(parseDurationMs('P1Y')).toBe(365 * DAY);
    expect(parseDurationMs('P7D')).toBe(7 * DAY);
  });

  it('rejects nonsense', () => {
    expect(parseDurationMs('P')).toBeNull();
    expect(parseDurationMs('banana')).toBeNull();
  });
});

describe('evaluateTimeExpression', () => {
  it('resolves the dashboard anchors', () => {
    expect(evaluateTimeExpression('{{startTime}}', ctx).ms).toBe(START);
    expect(evaluateTimeExpression('{{endTime}}', ctx).ms).toBe(END);
    expect(evaluateTimeExpression('{{now}}', ctx).ms).toBe(END);
  });

  it('supports the stacked-window pattern the stream limit forces', () => {
    // Panel A covers the most recent slice, panel B the one before it.
    const aFrom = evaluateTimeExpression('{{endTime}} - {{maxFilteringInterval}}', ctx);
    const bFrom = evaluateTimeExpression('{{endTime}} - 2 * {{maxFilteringInterval}}', ctx);
    const bTo = evaluateTimeExpression('{{endTime}} - {{maxFilteringInterval}}', ctx);

    expect(aFrom.ms).toBe(END - 7 * DAY);
    expect(bFrom.ms).toBe(END - 14 * DAY);
    expect(bTo.ms).toBe(END - 7 * DAY);
    // The two windows meet exactly, no gap and no overlap
    expect(bTo.ms).toBe(aFrom.ms);
  });

  it('renders an ISO string alongside the epoch value', () => {
    expect(evaluateTimeExpression('{{endTime}}', ctx).iso).toBe(
      '2026-08-27T12:00:00.000Z'
    );
  });

  it('accepts hardcoded ISO instants', () => {
    expect(evaluateTimeExpression('2026-08-01T00:00:00Z', ctx).ms).toBe(
      at('2026-08-01T00:00:00Z')
    );
    expect(evaluateTimeExpression('2026-08-01T00:00:00Z + 12h', ctx).ms).toBe(
      at('2026-08-01T12:00:00Z')
    );
    // A bare date is still an instant, and its dashes are not subtraction
    expect(evaluateTimeExpression('2026-08-01', ctx).ms).toBe(at('2026-08-01T00:00:00Z'));
  });

  it('honours operator precedence and parentheses', () => {
    expect(evaluateTimeExpression('{{endTime}} - 2 * 1d', ctx).ms).toBe(END - 2 * DAY);
    expect(evaluateTimeExpression('{{endTime}} - (1d + 12h)', ctx).ms).toBe(
      END - DAY - 12 * HOUR
    );
    expect(evaluateTimeExpression('{{endTime}} - {{maxFilteringInterval}} / 7', ctx).ms).toBe(
      END - DAY
    );
  });

  it('allows durations on either side of a sum', () => {
    expect(evaluateTimeExpression('1d + {{startTime}}', ctx).ms).toBe(START + DAY);
  });

  it('understands ISO durations inside expressions', () => {
    expect(evaluateTimeExpression('{{endTime}} - PT168H', ctx).ms).toBe(END - 7 * DAY);
  });

  it('rejects expressions that do not resolve to a point in time', () => {
    expect(evaluateTimeExpression('1d + 2h', ctx).error).toMatch(/duration/);
    expect(evaluateTimeExpression('5', ctx).error).toMatch(/number/);
    // instant - instant is a duration, which is not a valid window bound
    expect(evaluateTimeExpression('{{endTime}} - {{startTime}}', ctx).error).toMatch(
      /duration/
    );
  });

  it('rejects meaningless arithmetic', () => {
    expect(evaluateTimeExpression('{{endTime}} * 2', ctx).error).toBeDefined();
    expect(evaluateTimeExpression('{{endTime}} + {{startTime}}', ctx).error).toBeDefined();
  });

  it('reports unknown or unavailable anchors clearly', () => {
    expect(evaluateTimeExpression('{{bogus}}', ctx).error).toMatch(/Unknown variable/);
    expect(
      evaluateTimeExpression('{{endTime}} - {{maxFilteringInterval}}', {
        endTime: END,
      }).error
    ).toMatch(/only available on streams/);
    expect(evaluateTimeExpression('{{startTime}}', {}).error).toMatch(
      /dashboard time range/
    );
  });

  it('reports syntax problems instead of throwing', () => {
    expect(evaluateTimeExpression('', ctx).error).toBeDefined();
    expect(evaluateTimeExpression('{{endTime}} -', ctx).error).toBeDefined();
    expect(evaluateTimeExpression('({{endTime}}', ctx).error).toMatch(/parenthesis/);
    expect(evaluateTimeExpression('{{endTime}} $ 1d', ctx).error).toMatch(/Unexpected character/);
    expect(evaluateTimeExpression('1d / 0', ctx).error).toMatch(/zero/);
  });
});

describe('offset-less date-times', () => {
  // Everything CDF stores is UTC. jest pins TZ=UTC, so this compares the two forms
  // against each other rather than against a fixed instant.
  it('reads a date-time without an offset as UTC', () => {
    const withoutOffset = evaluateTimeExpression('2026-08-01T06:00:00', {});
    const explicitUtc = evaluateTimeExpression('2026-08-01T06:00:00Z', {});
    expect(withoutOffset.ms).toBe(explicitUtc.ms);
  });

  it('still honours an explicit offset', () => {
    const plusTwo = evaluateTimeExpression('2026-08-01T06:00:00+02:00', {});
    const utc = evaluateTimeExpression('2026-08-01T04:00:00Z', {});
    expect(plusTwo.ms).toBe(utc.ms);
  });

  it('keeps a bare date as UTC midnight', () => {
    const bare = evaluateTimeExpression('2026-08-01', {});
    const explicit = evaluateTimeExpression('2026-08-01T00:00:00Z', {});
    expect(bare.ms).toBe(explicit.ms);
  });
});
