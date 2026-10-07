import React from 'react';
import { EditorField, InputGroup, AccessoryButton } from '@grafana/plugin-ui';
import { Badge, Button, InlineSwitch, RadioButtonGroup, Select, Stack } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { RecordsTargetUnit } from '../../types';
import { RecordViewDefinition, UnitSystem } from '../../types/records';
import { CogniteUnit } from '../../types/dms';
import { unitBearingProperties, propertyUnitExternalId } from '../../cdf/records';
import {
  UnitsMode,
  availableUnitProperties,
  canAddUnitRow,
  storageUnitLabel,
  unitDisplayName,
  unitsModeOf,
} from '../../cdf/units';
import { formatPropertyOptionLabel } from './typeBadges';

interface UnitsEditorProps {
  viewDef: RecordViewDefinition | null;
  unitSystem?: string;
  targetUnits: RecordsTargetUnit[];
  hideUnitSuffix?: boolean;
  unitSystems: UnitSystem[];
  unitIndex: Map<string, CogniteUnit>;
  onChange: (patch: {
    unitSystem?: string;
    targetUnits?: RecordsTargetUnit[];
    hideUnitSuffix?: boolean;
  }) => void;
}

export const UnitsEditor = ({
  viewDef,
  unitSystem,
  targetUnits,
  hideUnitSuffix,
  unitSystems,
  unitIndex,
  onChange,
}: UnitsEditorProps) => {
  const convertible = unitBearingProperties(viewDef);
  // Nothing on this view declares a unit, so there is nothing to convert.
  if (!convertible.length) {
    return null;
  }

  const mode = unitsModeOf(unitSystem, targetUnits);

  const modeOptions: Array<SelectableValue<UnitsMode>> = [
    { label: 'Storage units', value: 'none' },
    ...(unitSystems.length ? [{ label: 'Unit system', value: 'system' as const }] : []),
    { label: 'Per property', value: 'properties' },
  ];

  const propertyOptionsFor = (index: number): Array<SelectableValue<string>> => {
    const available = new Set(
      availableUnitProperties(
        convertible.map((entry) => entry.property),
        targetUnits,
        index
      )
    );
    return convertible
      .filter(({ property }) => available.has(property))
      .map(({ property, unitExternalId }) => ({
        label: property,
        value: property,
        description: `${viewDef?.properties?.[property]?.type?.type} · ${unitDisplayName(
          unitExternalId,
          unitIndex
        )}`,
      }));
  };

  /**
   * Only units of the same quantity can be converted between, so the picker is
   * filtered by the storage unit's quantity rather than listing the whole catalog.
   */
  const unitOptionsFor = (property: string): Array<SelectableValue<string>> => {
    const storage = unitIndex.get(propertyUnitExternalId(viewDef, property) ?? '');
    const candidates = Array.from(unitIndex.values()).filter(
      (unit) => !storage?.quantity || unit.quantity === storage.quantity
    );
    return candidates.map((unit) => ({
      label: unitDisplayName(unit.externalId, unitIndex),
      value: unit.externalId,
      description: unit.quantity,
    }));
  };

  const onModeChange = (next: UnitsMode) => {
    // unitSystem and targetUnits are a oneOf in the API, so switching clears the other.
    if (next === 'none') {
      onChange({ unitSystem: undefined, targetUnits: [] });
    } else if (next === 'system') {
      onChange({ unitSystem: unitSystems[0]?.name, targetUnits: [] });
    } else {
      onChange({
        unitSystem: undefined,
        targetUnits: [{ property: '', unitExternalId: '' }],
      });
    }
  };

  const canAddRow = canAddUnitRow(convertible.length, targetUnits);

  const patchRow = (index: number, patch: Partial<RecordsTargetUnit>) =>
    onChange({
      targetUnits: targetUnits.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    });

  return (
    <>
      <EditorField
        label="Units"
        tooltip="Converts values between units of measurement. Conversion applies to the request as well, so filter and window values for a converted property must be entered in the target unit."
        optional
      >
        <Stack gap={1} alignItems="center">
          <RadioButtonGroup
            options={modeOptions}
            value={mode}
            onChange={(value) => onModeChange(value!)}
          />
          {mode === 'system' && (
            <Select
              width={22}
              options={unitSystems.map((system) => ({
                label: system.name,
                value: system.name,
              }))}
              value={unitSystem ?? null}
              placeholder="unit system"
              onChange={({ value }) => onChange({ unitSystem: value! })}
            />
          )}
        </Stack>
      </EditorField>

      {mode === 'properties' && (
        <EditorField
          label="Convert"
          tooltip="Only properties with a declared unit can be converted."
        >
          <Stack direction="column" gap={0.5} alignItems="flex-start">
            {targetUnits.map((row, index) => (
              <Stack key={index} gap={1} alignItems="center">
                <InputGroup>
                  <Select
                    width={40}
                    options={propertyOptionsFor(index)}
                    value={row.property || null}
                    placeholder="property"
                    formatOptionLabel={formatPropertyOptionLabel()}
                    onChange={({ value }) =>
                      patchRow(index, { property: value!, unitExternalId: '' })
                    }
                  />
                  <Select
                    width={28}
                    options={row.property ? unitOptionsFor(row.property) : []}
                    value={row.unitExternalId || null}
                    placeholder={row.property ? 'target unit' : 'pick a property first'}
                    disabled={!row.property}
                    onChange={({ value }) => patchRow(index, { unitExternalId: value! })}
                  />
                  <AccessoryButton
                    icon="times"
                    variant="secondary"
                    aria-label={`Remove unit conversion ${index + 1}`}
                    data-testid={`records-remove-unit-${index}`}
                    onClick={() =>
                      onChange({ targetUnits: targetUnits.filter((_, i) => i !== index) })
                    }
                  />
                </InputGroup>
                {row.property && (
                  <Badge
                    color="darkgrey"
                    text={storageUnitLabel(
                      propertyUnitExternalId(viewDef, row.property),
                      unitIndex
                    )}
                    tooltip="The unit declared for this property."
                  />
                )}
              </Stack>
            ))}
            {canAddRow && (
              <Button
                variant="secondary"
                size="sm"
                icon="plus"
                data-testid="records-add-unit"
                onClick={() =>
                  onChange({
                    targetUnits: [...targetUnits, { property: '', unitExternalId: '' }],
                  })
                }
              >
                Add conversion
              </Button>
            )}
          </Stack>
        </EditorField>
      )}
      <EditorField
        label="Unit in label"
        tooltip="Appends the unit symbol to each unit aware property label."
      >
        <InlineSwitch
          value={!hideUnitSuffix}
          data-testid="records-unit-suffix"
          aria-label="Append unit to labels"
          onChange={() => onChange({ hideUnitSuffix: !hideUnitSuffix || undefined })}
        />
      </EditorField>
    </>
  );
};
