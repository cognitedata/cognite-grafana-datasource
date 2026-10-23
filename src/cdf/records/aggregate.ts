/** Builds /records/aggregate requests: buckets, metrics, intervals and the result shape they produce. */
import { RecordsBucket, RecordsMetric, RecordsQuery, Tuple } from '../../types';
import {
  RecordsAggregateDefinition,
  RecordsAggregateRequest,
  RecordsAggregateTree,
  RecordsFilterDefinition,
} from '../../types/records';
import { RecordsBuildOptions, buildFilter, buildTargetUnits, resolveTimeWindow } from './request';
import { viewPropertyRef } from './schema';
import {
  autoStepFactor,
  autoBucketInterval,
  formatFixedInterval,
  isAutoInterval,
} from '../granularity';

/** Aggregate identifiers the API reserves or rejects. */
const RESERVED_METRIC_NAMES = ['_count', '_bucket_count'];

export function validateMetricName(
  name: string,
  otherNames: string[] = []
): string | null {
  const trimmed = (name ?? '').trim();
  if (!trimmed) {
    return 'Name is required';
  }
  if (/[.[\]>]/.test(trimmed)) {
    return 'Name cannot contain . [ ] or >';
  }
  if (RESERVED_METRIC_NAMES.includes(trimmed)) {
    return `"${trimmed}" is reserved by the API`;
  }
  // The response walker treats every `bucket_*` key as a nesting level, so a metric
  // named this way is accepted, sent, and then silently dropped from the frame.
  if (trimmed.startsWith('bucket_')) {
    return '"bucket_" is a reserved prefix';
  }
  if (otherNames.filter((n) => n === trimmed).length > 0) {
    return 'Names must be unique';
  }
  return null;
}

/**
 * The records API accepts exactly `[1-9][0-9]*(ms|s|m|h|d)` for fixedInterval —
 * verified against the API, which rejects `5w`/`5M`/`5y` outright. Grafana's
 * `$__interval` happily produces values outside that set, so everything is
 * normalised through here before it reaches a request.
 */
const FIXED_INTERVAL_PATTERN = /^(\d+)(ms|s|m|h|d|w|M|y)$/;

/** The API rejects a histogram that would produce more buckets than this. */
export const MAX_HISTOGRAM_BUCKETS = 10000;

/** The API rejects a uniqueValues size above this ("Size is too large"). */
export const MAX_UNIQUE_VALUES_SIZE = 10000;

/** A uniqueValues size the API accepts: a whole number from 1 to the maximum. */
export function clampBucketSize(size: number): number {
  const whole = Math.floor(Number(size));
  if (!Number.isFinite(whole) || whole < 1) {
    return 10;
  }
  return Math.min(whole, MAX_UNIQUE_VALUES_SIZE);
}

/**
 * Picks a bucket size for an auto interval (see `autoBucketInterval` in
 * granularity.ts), kept under the API's bucket ceiling.
 */
export function computeAutoInterval(
  spanMs: number,
  maxDataPoints?: number,
  factor = 1
): string {
  return autoBucketInterval(spanMs, maxDataPoints, MAX_HISTOGRAM_BUCKETS, factor);
}

export { formatFixedInterval, isAutoInterval };

/**
 * Grafana's `$__interval` resolves to values the records API does not all accept
 * (it takes ms/s/m/h/d only). Normalise what we can and reject the rest.
 */
export function normalizeInterval(
  interval: string
): { interval?: string; warning?: string } {
  const value = (interval ?? '').trim();
  if (!value) {
    return { warning: 'A time bucket interval is required.' };
  }
  const match = FIXED_INTERVAL_PATTERN.exec(value);
  if (!match) {
    return { warning: `Interval "${value}" is not a valid fixed interval.` };
  }
  const [, amountRaw, unit] = match;
  const amount = Number(amountRaw);
  if (amount <= 0) {
    return { warning: `Interval "${value}" must be greater than zero.` };
  }
  // w/M/y are valid Grafana units but the API rejects them, so fold to days.
  if (unit === 'w') {
    return { interval: `${amount * 7}d` };
  }
  if (unit === 'M') {
    return { interval: `${amount * 30}d` };
  }
  if (unit === 'y') {
    return { interval: `${amount * 365}d` };
  }
  return { interval: `${amount}${unit}` };
}

/** Deterministic node names so the response walker can find its way back down. */
export const bucketNodeName = (index: number) => `bucket_${index}`;

function metricDefinition(
  metric: RecordsMetric,
  view: { space: string; externalId: string; version: string }
): RecordsAggregateDefinition | null {
  if (metric.function === 'count') {
    return { count: {} };
  }
  if (!metric.property) {
    return null;
  }
  const property = viewPropertyRef(view, metric.property);
  switch (metric.function) {
    case 'avg':
      return { avg: { property } };
    case 'min':
      return { min: { property } };
    case 'max':
      return { max: { property } };
    case 'sum':
      return { sum: { property } };
    default:
      return null;
  }
}

export function buildRecordsAggregateRequest(
  query: RecordsQuery,
  range: Tuple<number> | null,
  options: RecordsBuildOptions = {}
): { request: RecordsAggregateRequest; warnings: string[] } {
  const { view } = query;
  if (!view) {
    throw new Error('A record view must be selected before building a request.');
  }
  const warnings: string[] = [];

  // Metrics form the innermost level of the tree.
  const metricTree: RecordsAggregateTree = {};
  const usedNames: string[] = [];
  (query.metrics ?? []).forEach((metric) => {
    const nameError = validateMetricName(metric.name, usedNames);
    if (nameError) {
      warnings.push(`Metric "${metric.name}" was skipped: ${nameError.toLowerCase()}.`);
      return;
    }
    const definition = metricDefinition(metric, view);
    if (!definition) {
      warnings.push(
        `Metric "${metric.name}" was skipped: ${metric.function} requires a property.`
      );
      return;
    }
    usedNames.push(metric.name.trim());
    metricTree[metric.name.trim()] = definition;
  });

  if (!Object.keys(metricTree).length) {
    // Every bucket already reports `count`, so an empty Compute list still returns
    // something useful rather than a rejected request.
    metricTree.count = { count: {} };
  }

  // The resolved window, a custom one included, also bounds every time bucket.
  const { window: boundsWindow, warnings: timeWarnings } = resolveTimeWindow(
    query,
    range,
    options
  );

  // Fold buckets right-to-left so buckets[0] ends up outermost.
  const buckets = (query.buckets ?? []).filter((b) => b?.property);
  let aggregates: RecordsAggregateTree = metricTree;
  // Each time bucket is bounded to the window by a range filter on its axis, so
  // only buckets inside the panel come back and the bucket count stays bounded.
  // Not hardBounds: on a view property the API answers 500 when no record falls
  // inside them, where a range filter returns no buckets. The filter also takes
  // ISO-8601 only for a view timestamp, so the bounds are sent in that form.
  const axisFilters: RecordsFilterDefinition[] = [];
  for (let i = buckets.length - 1; i >= 0; i -= 1) {
    const bucket = buckets[i];
    const property = viewPropertyRef(view, bucket.property);
    let definition: RecordsAggregateDefinition | null = null;

    if (bucket.kind === 'timeHistogram') {
      if (boundsWindow) {
        axisFilters.push({
          range: {
            property,
            gte: new Date(boundsWindow.gte).toISOString(),
            lte: new Date(boundsWindow.lte).toISOString(),
          },
        });
      }
      const spanMs = boundsWindow
        ? boundsWindow.lte - boundsWindow.gte
        : range
          ? range[1] - range[0]
          : 0;
      // "auto" is resolved here rather than by Grafana, because $__interval can
      // land on units the API rejects and on bucket counts it refuses to serve.
      const autoInterval = () =>
        computeAutoInterval(spanMs, options.maxDataPoints, autoStepFactor(bucket.interval) ?? 1);
      const resolved = isAutoInterval(bucket.interval)
        ? { interval: autoInterval() }
        : normalizeInterval(bucket.interval);
      // Every level must stay in the tree: the response walker finds levels by
      // index, so dropping one would misalign it and lose all the levels below.
      let fixedInterval = resolved.interval;
      if (resolved.warning || !fixedInterval) {
        fixedInterval = autoInterval();
        warnings.push(`${resolved.warning} Using ${fixedInterval} (auto) instead.`);
      }
      definition = {
        timeHistogram: {
          property,
          fixedInterval,
          aggregates,
        },
      };
    } else {
      definition = {
        uniqueValues: {
          property,
          size: clampBucketSize(bucket.size),
          aggregates,
        },
      };
    }

    if (definition) {
      aggregates = { [bucketNodeName(i)]: definition };
    }
  }

  warnings.push(...timeWarnings);
  const leaves = [buildFilter(query), ...axisFilters].filter(
    (leaf): leaf is RecordsFilterDefinition => !!leaf
  );
  const filter = leaves.length > 1 ? { and: leaves } : leaves[0];
  const targetUnits = buildTargetUnits(query);

  return {
    request: {
      ...(boundsWindow && { lastUpdatedTime: boundsWindow }),
      ...(filter && { filter }),
      aggregates,
      ...(targetUnits && { targetUnits }),
      includeTyping: true,
    },
    warnings,
  };
}

/**
 * The frame shape recordsAggregateToDataFrames will produce for this bucket
 * configuration — mirrors its exact filtering and grouping rules so the
 * editor's shape hint can never disagree with the actual result.
 */
export type RecordsResultShape =
  | { kind: 'timeseries'; seriesBy: string[] }
  | { kind: 'table'; groupBy: string[] }
  | { kind: 'single' };

export function deriveResultShape(buckets: RecordsBucket[]): RecordsResultShape {
  const complete = (buckets ?? []).filter((b) => b?.property);
  if (!complete.length) {
    return { kind: 'single' };
  }
  const hasTimeBucket = complete.some((b) => b.kind === 'timeHistogram');
  const labelKeys = complete
    .filter((b) => b.kind === 'uniqueValues')
    .map((b) => b.property);
  return hasTimeBucket
    ? { kind: 'timeseries', seriesBy: labelKeys }
    : { kind: 'table', groupBy: labelKeys };
}
