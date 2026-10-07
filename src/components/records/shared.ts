import { SelectableValue } from '@grafana/data';
import { RecordsFilterOperator } from '../../types';
import { RecordViewDefinition } from '../../types/records';
import { TOP_LEVEL_PROPERTIES, topLevelProperty } from '../../cdf/records';

export const OPERATOR_LABELS: Record<RecordsFilterOperator, string> = {
  equals: 'equals',
  in: 'is any of',
  range: 'between',
  prefix: 'starts with',
  exists: 'exists',
  containsAll: 'contains all',
  containsAny: 'contains any',
};

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
 * marked so it is clear they come from the record rather than the view.
 */
export function propertyOptions(viewDef: RecordViewDefinition | null): PropertyOption[] {
  const viewProps = Object.entries(viewDef?.properties ?? {}).map(([name, def]) => ({
    label: name,
    value: name,
    description: def.type?.list ? `${def.type?.type}[]` : def.type?.type,
    // Carried structurally as well as in the description, so the type badge does
    // not have to parse the text back out of a string meant for humans.
    propertyType: { type: def.type?.type, isList: !!def.type?.list },
  }));

  const topLevel = TOP_LEVEL_PROPERTIES.map((p) => ({
    label: p.name,
    value: p.name,
    description: `${p.type} · record property`,
    propertyType: { type: p.type, isList: false },
  }));

  return [...viewProps, ...topLevel];
}
