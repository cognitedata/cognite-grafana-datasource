import React from 'react';
import { Select } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { SyntheticVariable } from '../../types';
import { CogniteUnit } from '../../types/dms';
import { UnitSystem } from '../../types/records';
import { unitDisplayName } from '../../cdf/units';

/** The value one Select carries for either of the two exclusive unit fields. */
export const unitSelectValue = (
  row: Pick<SyntheticVariable, 'targetUnit' | 'targetUnitSystem'>
): string | null =>
  row.targetUnit
    ? `unit:${row.targetUnit}`
    : row.targetUnitSystem
      ? `system:${row.targetUnitSystem}`
      : null;

/** Units of the same quantity as the storage unit; all units when the catalog cannot place it. */
export const sameQuantityUnits = (
  storageUnit: string,
  unitIndex: Map<string, CogniteUnit>
): CogniteUnit[] => {
  const quantity = unitIndex.get(storageUnit)?.quantity;
  const units = [...unitIndex.values()];
  return quantity ? units.filter((unit) => unit.quantity === quantity) : units;
};

export const unitSelectOptions = (
  mode: SyntheticVariable['mode'],
  storageUnit: string | undefined,
  unitIndex: Map<string, CogniteUnit>,
  unitSystems: UnitSystem[]
): Array<SelectableValue<string>> => [
  ...(unitSystems.length
    ? [
        {
          label: 'Unit system',
          options: unitSystems.map((system) => ({
            label: system.name,
            value: `system:${system.name}`,
          })),
        },
      ]
    : []),
  ...(mode === 'instance' && storageUnit
    ? [
        {
          label: 'Unit',
          options: sameQuantityUnits(storageUnit, unitIndex).map((unit) => ({
            label: unitDisplayName(unit.externalId, unitIndex),
            value: `unit:${unit.externalId}`,
            description: unit.quantity,
          })),
        },
      ]
    : []),
];

/** The patch a selection writes: exactly one of the two fields, or neither. */
export const unitSelectPatch = (
  value?: string | null
): Pick<SyntheticVariable, 'targetUnit' | 'targetUnitSystem'> => {
  if (!value) {
    return { targetUnit: undefined, targetUnitSystem: undefined };
  }
  const [kind, ...rest] = value.split(':');
  const id = rest.join(':');
  return kind === 'unit'
    ? { targetUnit: id, targetUnitSystem: undefined }
    : { targetUnit: undefined, targetUnitSystem: id };
};

interface UnitSelectProps {
  row: SyntheticVariable;
  /** The picked series' storage unit, once known; lists the units it converts to. */
  storageUnit?: string;
  unitIndex: Map<string, CogniteUnit>;
  unitSystems: UnitSystem[];
  inputId: string;
  width?: number;
  onChange: (patch: Pick<SyntheticVariable, 'targetUnit' | 'targetUnitSystem'>) => void;
}

/**
 * One control for the two exclusive conversions a reference accepts: a unit
 * system (any row) or a target unit (a picked series, in its storage unit's
 * quantity). The synthetic API rejects both on one reference.
 */
export const UnitSelect = ({
  row,
  storageUnit,
  unitIndex,
  unitSystems,
  inputId,
  width,
  onChange,
}: UnitSelectProps) => (
  <Select
    inputId={inputId}
    width={width}
    isClearable
    placeholder="unit"
    menuPosition="fixed"
    aria-label={`Unit for variable ${row.name}`}
    options={unitSelectOptions(row.mode, storageUnit, unitIndex, unitSystems)}
    value={unitSelectValue(row)}
    onChange={(option) => onChange(unitSelectPatch(option?.value))}
  />
);
