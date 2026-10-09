import { GapFill } from '../types';
import { DAY, HOUR, MINUTE, SECOND } from './timeExpression';

/**
 * Gap filling for aggregate datapoints queries (`fill: { limit }` on each item).
 *
 * CDF interpolates and extrapolates across gaps up to `limit`, measured between raw
 * data points. The rules below were checked against the API:
 * - `limit` must be at least the granularity, or the request fails with a 400. For a
 *   calendar granularity (`mo`) the bar is 31 days.
 * - `limit` takes s/m/h/d (or second/minute/hour/day), never ms, w, mo or a fraction,
 *   and at most 120 seconds or minutes, or 100,000 hours or days.
 * - `fill` is rejected on raw queries and together with `totalVariation`.
 */

/** Longest calendar month: the API measures a `mo` granularity's fill bar in 31-day steps. */
const MONTH = 31 * DAY;

const UNIT_MS: Record<string, number> = {
  s: SECOND,
  second: SECOND,
  m: MINUTE,
  minute: MINUTE,
  h: HOUR,
  hour: HOUR,
  d: DAY,
  day: DAY,
};

const GRANULARITY_UNIT_MS: Record<string, number> = { ...UNIT_MS, mo: MONTH, month: MONTH };

const DURATION = /^(\d*)([a-z]+)$/;

function parse(text: string, units: Record<string, number>): number | undefined {
  const match = DURATION.exec(text.trim());
  if (!match || !(match[2] in units)) {
    return undefined;
  }
  const count = match[1] === '' ? 1 : Number(match[1]);
  return count > 0 ? count * units[match[2]] : undefined;
}

/** A datapoints granularity in milliseconds (a month counted as 31 days), or undefined if CDF would reject it. */
export const granularityToMs = (granularity: string): number | undefined =>
  parse(granularity, GRANULARITY_UNIT_MS);

/** A fill limit in milliseconds, or undefined unless it is a whole number of s/m/h/d. */
export const fillLimitToMs = (limit: string): number | undefined => parse(limit, UNIT_MS);

/** Fill limit units, largest first, with the largest count the API takes in each. */
const FILL_UNITS: Array<[unit: string, size: number, max: number]> = [
  ['d', DAY, 100_000],
  ['h', HOUR, 100_000],
  ['m', MINUTE, 120],
  ['s', SECOND, 120],
];

/**
 * Formats milliseconds as a fill limit the API accepts: exactly, in the largest unit
 * that divides it within that unit's cap, or else rounded up to the smallest unit
 * that can hold it. 200 minutes, say, is past the 120-minute cap and no whole number
 * of hours, so it becomes 4h.
 */
export function formatFillLimit(milliseconds: number): string {
  const ms = Math.max(milliseconds, 1);
  const exact = FILL_UNITS.find(([, size, max]) => ms % size === 0 && ms / size <= max);
  if (exact) {
    return `${ms / exact[1]}${exact[0]}`;
  }
  for (const [unit, size, max] of [...FILL_UNITS].reverse()) {
    const count = Math.ceil(ms / size);
    if (count <= max) {
      return `${count}${unit}`;
    }
  }
  return `${FILL_UNITS[0][2]}${FILL_UNITS[0][0]}`;
}

export const DEFAULT_FILL_MULTIPLE = 4;

/** Aggregates the API refuses to combine with `fill`. */
const UNFILLABLE_AGGREGATES = new Set(['totalVariation']);

export type FillResolution = {
  /** The `fill.limit` to send, or undefined to send no `fill`. */
  limit?: string;
  warning?: string;
};

export const isGapFillActive = (gapFill?: GapFill): gapFill is GapFill =>
  !!gapFill && (gapFill.mode === 'granularity' || gapFill.mode === 'duration');

/**
 * The fill limit for one query, given the granularity it is sent with.
 *
 * A fixed limit below the granularity, which is common with auto granularity once a
 * panel zooms out, is raised to the granularity with a warning instead of failing
 * the query.
 */
export function resolveFillLimit(
  gapFill: GapFill | undefined,
  granularity: string,
  aggregation: string
): FillResolution {
  if (!isGapFillActive(gapFill)) {
    return {};
  }
  if (UNFILLABLE_AGGREGATES.has(aggregation)) {
    return { warning: `Gap filling is not available for ${aggregation}, so it was not applied.` };
  }
  const granularityMs = granularityToMs(granularity);
  if (granularityMs === undefined) {
    return { warning: `Gap filling was not applied: granularity '${granularity}' is not recognised.` };
  }

  if (gapFill.mode === 'granularity') {
    const multiple = gapFill.multiple ?? DEFAULT_FILL_MULTIPLE;
    if (!Number.isInteger(multiple) || multiple < 1) {
      return { warning: `Gap filling was not applied: the multiple must be a whole number of 1 or more, not '${multiple}'.` };
    }
    return { limit: formatFillLimit(multiple * granularityMs) };
  }

  const limit = gapFill.limit?.trim() ?? '';
  const limitMs = fillLimitToMs(limit);
  if (limitMs === undefined) {
    return {
      warning: `Gap filling was not applied: '${limit}' is not a fill limit. Use a whole number of s, m, h or d, for example 4h.`,
    };
  }
  if (limitMs < granularityMs) {
    const raised = formatFillLimit(granularityMs);
    return {
      limit: raised,
      warning: `Fill limit ${limit} is shorter than the granularity (${granularity}), so ${raised} was used.`,
    };
  }
  if (withinUnitCap(limit)) {
    return { limit };
  }
  // Past its unit's cap (200m, say): written in a larger unit, rounded up if need be.
  const rewritten = formatFillLimit(limitMs);
  return fillLimitToMs(rewritten) === limitMs
    ? { limit: rewritten }
    : {
        limit: rewritten,
        warning: `Fill limit ${limit} cannot be sent as is (at most 120 seconds or minutes), so ${rewritten} was used.`,
      };
}

function withinUnitCap(limit: string): boolean {
  const [, count, unit] = DURATION.exec(limit)!;
  const max = FILL_UNITS.find(([short]) => short === unit[0])![2];
  return (count === '' ? 1 : Number(count)) <= max;
}
