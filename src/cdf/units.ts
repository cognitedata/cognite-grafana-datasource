import { CogniteUnit } from '../types/dms';
import { RecordsTargetUnit } from '../types';

/** How the Records unit controls are presented, derived from the query. */
export type UnitsMode = 'none' | 'system' | 'properties';

/**
 * How a CDF unit reads in the query editor, e.g. "second (s)". Shared by the Time
 * Series and Records tabs so the same unit never appears under two different names.
 * Falls back to the externalId when the catalog has not loaded.
 */
export function unitDisplayName(
  unitExternalId?: string,
  unitIndex?: Map<string, CogniteUnit>
): string {
  if (!unitExternalId) {
    return 'no unit';
  }
  const unit = unitIndex?.get(unitExternalId);
  if (!unit) {
    return unitExternalId;
  }
  const name = unit.description || unit.name || unit.externalId;
  return unit.symbol ? `${name} (${unit.symbol})` : name;
}

/** Badge text for the unit a property is stored in, before any conversion. */
export const storageUnitLabel = (
  unitExternalId?: string,
  unitIndex?: Map<string, CogniteUnit>
) => `Storage unit: ${unitDisplayName(unitExternalId, unitIndex)}`;

/**
 * Short symbol for a unit ("psi"), falling back to the externalId's suffix when the
 * catalog is unavailable.
 */
export function unitSymbol(
  unitExternalId?: string,
  unitIndex?: Map<string, CogniteUnit>
): string | undefined {
  if (!unitExternalId) {
    return undefined;
  }
  return unitIndex?.get(unitExternalId)?.symbol ?? unitExternalId.split(':').pop();
}

/**
 * Appends the unit to a field name, e.g. "ActiveDuration (day)".
 *
 * The unit rides on the column/series label rather than `field.config.unit` so the
 * values stay bare numbers, matching how the Time Series tab labels its series.
 */
export function withUnitSuffix(
  name: string,
  unitExternalId?: string,
  unitIndex?: Map<string, CogniteUnit>
): string {
  const symbol = unitSymbol(unitExternalId, unitIndex);
  return symbol ? `${name} (${symbol})` : name;
}

/**
 * Properties still selectable in row `index`. A property another row already claimed
 * is hidden, since the API accepts a duplicate and silently applies the last one --
 * leaving the earlier row showing a target unit that is not the one in effect.
 */
export const availableUnitProperties = (
  convertible: string[],
  targetUnits: RecordsTargetUnit[],
  index: number
): string[] => {
  const taken = new Set(
    targetUnits.filter((_, i) => i !== index).map((row) => row.property).filter(Boolean)
  );
  return convertible.filter((property) => !taken.has(property));
};

/**
 * Whether another conversion row can be offered: some property must still be
 * unclaimed, and no blank row may already be waiting to be filled in.
 */
export const canAddUnitRow = (
  convertibleCount: number,
  targetUnits: RecordsTargetUnit[]
): boolean =>
  targetUnits.filter((row) => row.property).length < convertibleCount &&
  targetUnits.every((row) => row.property);

/** The mode is derived from the query rather than stored, so there is one source of truth. */
export const unitsModeOf = (
  unitSystem?: string,
  targetUnits?: RecordsTargetUnit[]
): UnitsMode => {
  if (unitSystem) {
    return 'system';
  }
  return targetUnits?.length ? 'properties' : 'none';
};
