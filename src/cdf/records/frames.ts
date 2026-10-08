/** Turns /records/filter and /records/aggregate responses into data frames. */
import { DataFrame, FieldType, MutableDataFrame } from '@grafana/data';
import { RecordsBucket, RecordsQuery } from '../../types';
import { CogniteUnit } from '../../types/dms';
import { withUnitSuffix } from '../units';
import {
  RecordsAggregateResponse,
  RecordsAggregateResultNode,
  RecordsItem,
  RecordsTyping,
  RecordViewProperty,
} from '../../types/records';
import { bucketNodeName } from './aggregate';
import { hasText } from './request';
import { isNumericType, topLevelProperty, viewSourceKey } from './schema';

// ---------------------------------------------------------------------------
// Response → DataFrame
// ---------------------------------------------------------------------------

/**
 * Effective unit of a view property, as reported by the response's typing block --
 * which already reflects any conversion applied by targetUnits, so this is the unit
 * the values are actually in rather than the storage one.
 */
const effectiveUnitOf = (
  viewTyping: Record<string, RecordViewProperty> | undefined,
  property?: string
): string | undefined =>
  property ? viewTyping?.[property]?.type?.unit?.externalId : undefined;

function fieldTypeFor(property?: RecordViewProperty): FieldType {
  const type = property?.type?.type;
  if (property?.type?.list) {
    return FieldType.other;
  }
  // `timestamp` is a real instant, so it becomes epoch ms and Grafana renders it in
  // the dashboard timezone. `date` is a calendar date with no instant behind it --
  // typing it as time would make Grafana shift it and show the previous day west of
  // UTC, so it is passed through as the string the API stored.
  if (type === 'timestamp') {
    return FieldType.time;
  }
  if (isNumericType(type)) {
    return FieldType.number;
  }
  if (type === 'boolean') {
    return FieldType.boolean;
  }
  if (type === 'json') {
    return FieldType.other;
  }
  return FieldType.string;
}

/**
 * How a non-scalar property value reads in a frame. Direct relations come back as
 * `{ space, externalId }` -- both as record properties and as uniqueValues bucket
 * values -- and would otherwise stringify to "[object Object]".
 */
export function formatComplexValue(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value !== 'object') {
    return String(value);
  }
  if (value.space && value.externalId) {
    return `${value.space}:${value.externalId}`;
  }
  return JSON.stringify(value);
}

function normalizeValue(value: any, fieldType: FieldType): any {
  if (value === null || value === undefined) {
    return null;
  }
  if (fieldType === FieldType.time) {
    if (typeof value === 'number') {
      return value;
    }
    // Everything CDF stores is UTC. A string without an offset would otherwise be
    // parsed as browser-local time, silently skewing the frame by the viewer's offset.
    const iso = /(Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : `${value}Z`;
    const parsed = new Date(iso).getTime();
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (fieldType === FieldType.string && typeof value === 'object') {
    return formatComplexValue(value);
  }
  return value;
}

/** Flattens `properties[space][view/version]` into one row per record. */
export function recordsToDataFrame(
  items: RecordsItem[],
  typing: RecordsTyping | undefined,
  query: RecordsQuery,
  refId?: string,
  unitIndex?: Map<string, CogniteUnit>
): DataFrame {
  const { view } = query;
  const sourceKey = view ? viewSourceKey(view) : '';
  const space = view?.space ?? '';
  const viewTyping = typing?.[space]?.[sourceKey];

  const propsOf = (item: RecordsItem) =>
    item.properties?.[space]?.[sourceKey] ?? {};

  // The selection drives the frame, mixing view properties with the record's own
  // top-level ones. Those never reach `sources[].properties` (the API 400s on
  // reserved identifiers) but they are on every record, so they are free to render.
  const selected = (query.columns ?? []).filter(hasText);
  const columnNames = selected.length
    ? selected
    : // Nothing selected means everything: the record's identity, whatever view
      // properties the records carry, then the record's timestamps.
      [
        'externalId',
        'space',
        ...Array.from(
          items.reduce((acc, item) => {
            Object.keys(propsOf(item)).forEach((k) => acc.add(k));
            return acc;
          }, new Set<string>(
            // A zero-row response carries no properties to learn from, so the
            // response typing supplies them instead. Without this an empty result
            // produced a differently-shaped frame from a non-empty one, breaking
            // panels and transformations keyed on the property fields.
            items.length ? [] : Object.keys(viewTyping ?? {})
          ))
        ),
        'lastUpdatedTime',
        'createdTime',
      ];

  const frame = new MutableDataFrame({
    refId,
    name: view ? `${view.externalId}/${view.version}` : 'records',
    fields: [],
  });

  const typeOf = (name: string): FieldType => {
    const topLevel = topLevelProperty(name);
    if (topLevel) {
      return topLevel.type === 'timestamp' ? FieldType.time : FieldType.string;
    }
    return fieldTypeFor(viewTyping?.[name]);
  };

  // The unit is appended to the column name rather than set as field.config.unit, so
  // the values stay bare numbers -- same convention as the Time Series tab's labels.
  const labelOf = (name: string): string =>
    topLevelProperty(name)
      ? name
      : query.hideUnitSuffix
        ? name
        : withUnitSuffix(name, effectiveUnitOf(viewTyping, name), unitIndex);

  columnNames.forEach((name) => {
    frame.addField({ name: labelOf(name), type: typeOf(name) });
  });

  items.forEach((item) => {
    const properties = propsOf(item);
    const row: Record<string, any> = {};
    columnNames.forEach((name) => {
      const raw = topLevelProperty(name)
        ? (item as Record<string, any>)[name]
        : properties[name];
      row[labelOf(name)] = normalizeValue(raw, typeOf(name));
    });
    frame.add(row);
  });

  return frame;
}

interface FlatAggregateRow {
  /** Bucket values keyed by the bucket's property name; time buckets use epoch ms. */
  keys: Record<string, any>;
  timestamp?: number;
  /** Numbers, or an ISO-8601 string for min/max over a timestamp. */
  metrics: Record<string, number | string | null>;
}

function metricValue(node: RecordsAggregateResultNode): number | string | null {
  const keys = ['avg', 'min', 'max', 'sum', 'count'] as const;
  for (const key of keys) {
    const value = node[key];
    if (typeof value === 'number' || typeof value === 'string') {
      return value;
    }
  }
  return null;
}

/**
 * Walks the nested bucket tree, emitting one flat row per innermost bucket.
 *
 * Only the metrics the user configured become columns. The API also reports a
 * record count on every bucket, but surfacing it unasked would add a duplicate
 * column whenever the user already has a Count metric — and in a time series
 * panel every numeric field is a series, so it would draw a phantom line too.
 * An empty Compute list already gets a count metric from the request builder.
 */
function flattenAggregates(
  node: Record<string, RecordsAggregateResultNode>,
  buckets: RecordsBucket[],
  depth: number,
  keys: Record<string, any>,
  timestamp: number | undefined,
  rows: FlatAggregateRow[]
): void {
  const bucket = buckets[depth];
  const bucketNode = bucket ? node?.[bucketNodeName(depth)] : undefined;

  if (bucket && bucketNode) {
    if (bucket.kind === 'timeHistogram') {
      (bucketNode.timeHistogramBuckets ?? []).forEach((b) => {
        flattenAggregates(
          b.aggregates ?? {},
          buckets,
          depth + 1,
          keys,
          new Date(b.intervalStart).getTime(),
          rows
        );
      });
      return;
    }
    (bucketNode.uniqueValueBuckets ?? []).forEach((b) => {
      flattenAggregates(
        b.aggregates ?? {},
        buckets,
        depth + 1,
        { ...keys, [bucket.property]: b.value },
        timestamp,
        rows
      );
    });
    return;
  }

  // Innermost level: collect the metric values.
  const metrics: Record<string, number | string | null> = {};
  Object.entries(node ?? {}).forEach(([name, value]) => {
    if (name.startsWith('bucket_')) {
      return;
    }
    metrics[name] = metricValue(value);
  });
  rows.push({ keys, timestamp, metrics });
}

/**
 * The metrics whose result is an instant: min or max over a timestamp property. The
 * API returns those as ISO-8601 strings, so they become time fields, not numbers.
 */
function timestampMetricNames(
  query: RecordsQuery,
  typing: RecordsTyping | undefined
): Set<string> {
  const viewTyping = query.view
    ? typing?.[query.view.space]?.[viewSourceKey(query.view)]
    : undefined;
  const typeOf = (property: string) =>
    topLevelProperty(property)?.type ?? viewTyping?.[property]?.type?.type;
  return new Set(
    (query.metrics ?? [])
      .filter((m) => m.function === 'min' || m.function === 'max')
      .filter((m) => !!m.property && typeOf(m.property) === 'timestamp')
      .map((m) => m.name.trim())
  );
}

/**
 * Aggregate results become labeled time series when a time bucket is present, so
 * time series panels render them without a transform; otherwise one table frame.
 */
export function recordsAggregateToDataFrames(
  response: RecordsAggregateResponse,
  query: RecordsQuery,
  refId?: string,
  unitIndex?: Map<string, CogniteUnit>
): DataFrame[] {
  // count has no source property, so it stays unitless; avg/min/max/sum inherit
  // the (already converted) unit of the property they aggregate.
  const viewTyping = query.view
    ? response.typing?.[query.view.space]?.[viewSourceKey(query.view)]
    : undefined;
  // The unit is appended to the series name rather than set as field.config.unit, so
  // the values stay bare numbers -- same convention as the Time Series tab's labels.
  const labelForMetric = (metricName: string): string => {
    const metric = (query.metrics ?? []).find((m) => m.name.trim() === metricName);
    if (!metric?.property || metric.function === 'count') {
      return metricName;
    }
    return query.hideUnitSuffix
      ? metricName
      : withUnitSuffix(
        metricName,
        effectiveUnitOf(viewTyping, metric.property),
        unitIndex,
      );
  };
  const buckets = (query.buckets ?? []).filter((b) => b?.property);
  const rows: FlatAggregateRow[] = [];
  flattenAggregates(response.aggregates ?? {}, buckets, 0, {}, undefined, rows);

  if (!rows.length) {
    return [new MutableDataFrame({ refId, fields: [] })];
  }

  const metricNames = Array.from(
    rows.reduce((acc, row) => {
      Object.keys(row.metrics).forEach((name) => acc.add(name));
      return acc;
    }, new Set<string>())
  );
  const timeMetrics = timestampMetricNames(query, response.typing);
  const metricType = (name: string) =>
    timeMetrics.has(name) ? FieldType.time : FieldType.number;
  // A bucket with no values for the property reports 0 rather than null, for a
  // timestamp too, where a real result is always a string. So only a string is read
  // as an instant, and the 0 becomes an empty cell instead of 1 January 1970.
  const metricCell = (row: FlatAggregateRow, name: string) => {
    const value = row.metrics[name];
    if (timeMetrics.has(name)) {
      return typeof value === 'string' ? normalizeValue(value, FieldType.time) : null;
    }
    return typeof value === 'number' ? value : null;
  };
  const hasTimeBucket = buckets.some((b) => b.kind === 'timeHistogram');
  const labelKeys = buckets
    .filter((b) => b.kind === 'uniqueValues')
    .map((b) => b.property);

  if (!hasTimeBucket) {
    const frame = new MutableDataFrame({ refId, name: 'aggregates', fields: [] });
    labelKeys.forEach((key) => frame.addField({ name: key, type: FieldType.string }));
    metricNames.forEach((name) => {
      frame.addField({ name: labelForMetric(name), type: metricType(name) });
    });
    rows.forEach((row) => {
      const out: Record<string, any> = {};
      labelKeys.forEach((key) => {
        // Bucket values are objects for direct relations, so they are rendered the
        // same way the property itself is rendered in a list frame.
        out[key] = key in row.keys ? formatComplexValue(row.keys[key]) : null;
      });
      metricNames.forEach((name) => {
        out[labelForMetric(name)] = metricCell(row, name);
      });
      frame.add(out);
    });
    return [frame];
  }

  // One frame per distinct combination of non-time bucket values.
  const groups = new Map<string, FlatAggregateRow[]>();
  rows.forEach((row) => {
    const key = labelKeys.map((k) => formatComplexValue(row.keys[k])).join(' · ');
    const existing = groups.get(key);
    if (existing) {
      existing.push(row);
    } else {
      groups.set(key, [row]);
    }
  });

  return Array.from(groups.entries()).map(([groupKey, groupRows]) => {
    const labels = labelKeys.reduce<Record<string, string>>((acc, key) => {
      acc[key] = formatComplexValue(groupRows[0].keys[key]);
      return acc;
    }, {});

    const sorted = [...groupRows].sort(
      (a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0)
    );
    const frame = new MutableDataFrame({
      refId,
      name: groupKey || 'aggregates',
      fields: [],
    });
    frame.addField({ name: 'time', type: FieldType.time });
    metricNames.forEach((name) => {
      const metricLabel = labelForMetric(name);
      frame.addField({
        name: metricLabel,
        type: metricType(name),
        // Labels are kept so "group by label" transformations and series overrides
        // can match on the bucket value...
        labels: labelKeys.length ? labels : undefined,
        config: {
          // ...but the series name is set explicitly, because Grafana would otherwise
          // compose it from the frame name, the field name and the labels, printing
          // the bucket value twice ("i=10523 duration (s) i=10523").
          displayNameFromDS: groupKey ? `${groupKey} · ${metricLabel}` : metricLabel,
        },
      });
    });
    sorted.forEach((row) => {
      const out: Record<string, any> = { time: row.timestamp ?? null };
      metricNames.forEach((name) => {
        out[labelForMetric(name)] = metricCell(row, name);
      });
      frame.add(out);
    });
    return frame;
  });
}
