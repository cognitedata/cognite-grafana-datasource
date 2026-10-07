import { css } from '@emotion/css';
import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import {
  RecordsFilterOperator,
  RecordsMetricFunction,
  RecordsQueryMode,
} from '../../types';
import { RecordViewDefinition } from '../../types/records';
import { TOP_LEVEL_PROPERTIES, TopLevelProperty, topLevelProperty } from '../../cdf/records';

export const MODE_OPTIONS: Array<SelectableValue<RecordsQueryMode>> = [
  { label: 'List', value: 'list' },
  { label: 'Aggregate', value: 'aggregate' },
];

export const OPERATOR_LABELS: Record<RecordsFilterOperator, string> = {
  equals: 'equals',
  in: 'is any of',
  range: 'between',
  prefix: 'starts with',
  exists: 'exists',
  containsAll: 'contains all',
  containsAny: 'contains any',
};

export const METRIC_OPTIONS: Array<SelectableValue<RecordsMetricFunction>> = [
  { label: 'Count', value: 'count' },
  { label: 'Average', value: 'avg' },
  { label: 'Min', value: 'min' },
  { label: 'Max', value: 'max' },
  { label: 'Sum', value: 'sum' },
];

// Only units the records API accepts: [1-9][0-9]*(ms|s|m|h|d).
export const INTERVAL_OPTIONS: Array<SelectableValue<string>> = [
  { label: 'auto', value: 'auto' },
  ...['1s', '10s', '30s', '1m', '5m', '15m', '30m', '1h', '6h', '12h', '1d', '7d'].map(
    (value) => ({ label: value, value })
  ),
];

export const viewLabel = (view: RecordViewDefinition) =>
  `${view.name ?? view.externalId} (${view.space}) ${view.version}`;

export const propertyTypeOf = (
  viewDef: RecordViewDefinition | null,
  property: string
) => topLevelProperty(property)?.type ?? viewDef?.properties?.[property]?.type?.type;

/** Enum values are declared on the view, so the value picker needs no extra request. */
export const enumValuesOf = (
  viewDef: RecordViewDefinition | null,
  property: string
): string[] => Object.keys(viewDef?.properties?.[property]?.type?.values ?? {});

/** A property option, carrying its type for the badge renderer. */
export type PropertyOption = SelectableValue<string> & {
  propertyType?: { type?: string; isList: boolean };
};

/**
 * Options for a property picker. Top-level record properties (space, externalId,
 * createdTime, lastUpdatedTime) are offered alongside the view's own properties,
 * grouped separately so it is clear they come from the record rather than the view.
 * `topLevelFilter` decides which of them the current position accepts, since the
 * API allows them in different places.
 */
export function propertyOptions(
  viewDef: RecordViewDefinition | null,
  predicate: (type?: string, isList?: boolean) => boolean = () => true,
  topLevelFilter: (p: TopLevelProperty) => boolean = () => true
): PropertyOption[] {
  const viewProps = Object.entries(viewDef?.properties ?? {})
    .filter(([, def]) => predicate(def.type?.type, def.type?.list))
    .map(([name, def]) => ({
      label: name,
      value: name,
      description: def.type?.list ? `${def.type?.type}[]` : def.type?.type,
      // Carried structurally as well as in the description, so the type badge does
      // not have to parse the text back out of a string meant for humans.
      propertyType: { type: def.type?.type, isList: !!def.type?.list },
    }));

  const topLevel = TOP_LEVEL_PROPERTIES.filter(topLevelFilter).map((p) => ({
    label: p.name,
    value: p.name,
    description: `${p.type} · record property`,
    propertyType: { type: p.type, isList: false },
  }));

  return [...viewProps, ...topLevel];
}

/** Adjacent swap used by the bucket reorder buttons; no-op at the boundaries. */
export function moveItem<T>(items: T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) {
    return items;
  }
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/**
 * The dim monospace token at the right edge of bucket/metric rows naming the API
 * primitive the row compiles to (timeHistogram, uniqueValues, avg, …) — plain
 * language in the controls, API vocabulary for whoever debugs in the network tab.
 */
export const getGutterHintStyles = (theme: GrafanaTheme2) => css({
  fontFamily: theme.typography.fontFamilyMonospace,
  fontSize: theme.typography.bodySmall.fontSize,
  color: theme.colors.text.secondary,
  whiteSpace: 'nowrap',
  alignSelf: 'center',
});
