import { SelectableValue } from '@grafana/data';
import { toGranularityWithLowerBound } from '../utils';
import { DAY, HOUR, MINUTE, SECOND } from './timeExpression';

/**
 * Automatic bucket sizes, shared by the datapoints granularity and the Records
 * time-histogram interval.
 *
 * "Auto" sizes buckets from the panel: roughly one per pixel. "Auto · fewer points"
 * asks for buckets four times wider: fewer points to fetch and draw, which speeds
 * up dashboards with many series, where per-pixel detail is mostly noise.
 */
const AUTO_STEPS = [
  {
    value: 'auto',
    label: 'Auto',
    factor: 1,
    description: 'Sized from the panel width and time range',
  },
  {
    value: 'auto:fewer',
    label: 'Auto · fewer points',
    factor: 4,
    description: 'About a quarter as many points as Auto: faster with many series',
  },
] as const;

export const AUTO_STEP_OPTIONS: Array<SelectableValue<string>> = AUTO_STEPS.map(
  ({ value, label, description }) => ({ value, label, description })
);

/**
 * How much coarser than plain auto an interval asks to be: 1 for auto (empty,
 * `auto` or `$__interval`), 4 for Auto · fewer points, undefined for a fixed
 * interval.
 */
export function autoStepFactor(interval?: string): number | undefined {
  const value = (interval ?? '').trim().toLowerCase();
  if (value === '' || value === '$__interval') {
    return 1;
  }
  return AUTO_STEPS.find((step) => step.value === value)?.factor;
}

/** True when the interval field is asking us to derive the value. */
export const isAutoInterval = (interval?: string) => autoStepFactor(interval) !== undefined;

/**
 * Candidate auto intervals, ascending. Every entry reads as a "round" number on a
 * time axis and fits both the Records fixedInterval grammar and, from one second
 * up, the datapoints granularity grammar.
 */
const AUTO_INTERVAL_LADDER_MS = [
  10, 20, 50, 100, 200, 500,
  SECOND, 2 * SECOND, 5 * SECOND, 10 * SECOND, 15 * SECOND, 30 * SECOND,
  MINUTE, 2 * MINUTE, 5 * MINUTE, 10 * MINUTE, 15 * MINUTE, 30 * MINUTE,
  HOUR, 2 * HOUR, 3 * HOUR, 6 * HOUR, 12 * HOUR,
  DAY, 2 * DAY, 7 * DAY, 14 * DAY, 30 * DAY, 90 * DAY, 180 * DAY, 365 * DAY,
];

const LONGEST_STEP = AUTO_INTERVAL_LADDER_MS[AUTO_INTERVAL_LADDER_MS.length - 1];

/** The smallest ladder step at or above `ms` (and above `floor`), or the longest step. */
function snapToLadder(ms: number, floor = 0): number {
  return AUTO_INTERVAL_LADDER_MS.find((step) => step >= ms && step > floor) ?? LONGEST_STEP;
}

/** Renders a duration using the largest unit that divides it evenly. */
export function formatFixedInterval(ms: number): string {
  const amount = Math.max(1, Math.round(ms));
  for (const [unitMs, suffix] of [
    [DAY, 'd'],
    [HOUR, 'h'],
    [MINUTE, 'm'],
    [SECOND, 's'],
  ] as Array<[number, string]>) {
    if (amount % unitMs === 0) {
      return `${amount / unitMs}${suffix}`;
    }
  }
  return `${amount}ms`;
}

/**
 * Picks a bucket size for an auto interval: the smallest ladder step that hits the
 * panel's resolution target (divided by the step's factor) and stays under the
 * bucket ceiling. Because it derives from the time range, it re-resolves whenever
 * the range changes.
 */
export function autoBucketInterval(
  spanMs: number,
  maxDataPoints?: number,
  maxBuckets = Infinity,
  factor = 1
): string {
  const span = Math.max(spanMs || 0, 1);
  const points = Math.max(maxDataPoints || 0, 1);
  return formatFixedInterval(snapToLadder((span / points) * factor, span / maxBuckets));
}

/**
 * The granularity a datapoints aggregate query is sent with. Plain auto keeps the
 * long-standing behaviour (Grafana's interval, at least a second); the coarser
 * steps scale that interval and snap it to a round step; anything else is sent
 * as typed.
 */
export function resolveDatapointsGranularity(
  granularity: string | undefined,
  intervalMs: number
): string {
  const factor = autoStepFactor(granularity);
  if (factor === undefined) {
    return (granularity ?? '').trim();
  }
  if (factor === 1) {
    return toGranularityWithLowerBound(intervalMs);
  }
  return formatFixedInterval(snapToLadder(Math.max(intervalMs, SECOND) * factor));
}
