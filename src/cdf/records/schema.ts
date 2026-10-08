/** Record view schema: property references, record properties and the operators each type supports. */
import { RecordsFilterOperator } from '../../types';
import { RecordsPropertyRef, RecordViewDefinition } from '../../types/records';

// ---------------------------------------------------------------------------
// View schema helpers
// ---------------------------------------------------------------------------

/** The unit a view property's container declares, if any. */
export const propertyUnitExternalId = (
  viewDef: RecordViewDefinition | null | undefined,
  property: string
): string | undefined => viewDef?.properties?.[property]?.type?.unit?.externalId;

/** View properties whose container declares a unit — the convertible ones. */
export function unitBearingProperties(
  viewDef: RecordViewDefinition | null | undefined
): Array<{ property: string; unitExternalId: string }> {
  return Object.entries(viewDef?.properties ?? {})
    .filter(([, def]) => !!def.type?.unit?.externalId)
    .map(([property, def]) => ({
      property,
      unitExternalId: def.type!.unit!.externalId,
    }));
}

export const viewSourceKey = (view: { externalId: string; version: string }) =>
  `${view.externalId}/${view.version}`;

/**
 * Property reference as the records API expects it. Top-level properties use a
 * single segment; everything else is resolved through the selected view.
 */
export function viewPropertyRef(
  view: { space: string; externalId: string; version: string },
  property: string
): RecordsPropertyRef {
  return isTopLevelProperty(property)
    ? [property]
    : [view.space, viewSourceKey(view), property];
}

/**
 * Every record carries these regardless of the view. They are reserved identifiers
 * in data modeling, so a view property can never shadow one, and they are referenced
 * with a single-segment path instead of a view path.
 *
 * The API accepts them in different places depending on the property, so each entry
 * states exactly where it is allowed rather than assuming they behave like view
 * properties (notably: exists/containsAll/containsAny are container-only).
 */
export interface TopLevelProperty {
  name: string;
  type: string;
  operators: RecordsFilterOperator[];
  /** Valid as a timeHistogram axis. */
  timeBucket?: boolean;
  /** Valid as a uniqueValues bucket. */
  valuesBucket?: boolean;
  /** Valid as a min/max metric property. */
  minMax?: boolean;
}

export const TOP_LEVEL_PROPERTIES: TopLevelProperty[] = [
  { name: 'space', type: 'text', operators: ['equals', 'in', 'prefix'], valuesBucket: true },
  { name: 'externalId', type: 'text', operators: ['equals', 'in', 'prefix'] },
  {
    name: 'createdTime',
    type: 'timestamp',
    operators: ['range', 'equals', 'in'],
    timeBucket: true,
    minMax: true,
  },
  {
    name: 'lastUpdatedTime',
    type: 'timestamp',
    operators: ['range', 'equals', 'in'],
    timeBucket: true,
    minMax: true,
  },
];

const TOP_LEVEL_BY_NAME = new Map(TOP_LEVEL_PROPERTIES.map((p) => [p.name, p]));

export const topLevelProperty = (name?: string): TopLevelProperty | undefined =>
  name ? TOP_LEVEL_BY_NAME.get(name) : undefined;

export const isTopLevelProperty = (name?: string) => !!topLevelProperty(name);

const NUMERIC_TYPES = ['float32', 'float64', 'int32', 'int64'];
const TIME_TYPES = ['timestamp', 'date'];

export const isNumericType = (type?: string) =>
  !!type && NUMERIC_TYPES.includes(type);
export const isTimeType = (type?: string) => !!type && TIME_TYPES.includes(type);

/**
 * Operators that make sense for a property, so the operator dropdown never offers
 * a combination the API would reject.
 */
export function operatorsForType(
  type?: string,
  isList?: boolean,
  property?: string
): RecordsFilterOperator[] {
  const topLevel = topLevelProperty(property);
  if (topLevel) {
    return topLevel.operators;
  }
  if (isList) {
    return ['containsAny', 'containsAll', 'exists'];
  }
  if (!type) {
    return ['equals', 'in', 'range', 'prefix', 'exists'];
  }
  if (type === 'enum') {
    return ['in', 'equals', 'exists'];
  }
  if (type === 'boolean') {
    return ['equals', 'exists'];
  }
  if (type === 'direct') {
    return ['equals', 'in', 'exists'];
  }
  if (isNumericType(type) || isTimeType(type)) {
    return ['range', 'equals', 'in', 'exists'];
  }
  // text and anything else
  return ['equals', 'in', 'prefix', 'exists'];
}
