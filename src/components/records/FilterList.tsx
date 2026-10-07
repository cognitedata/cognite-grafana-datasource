import React from 'react';
import { EditorField, InputGroup, AccessoryButton } from '@grafana/plugin-ui';
import {
  Button,
  FieldValidationMessage,
  MultiSelect,
  Select,
  Stack,
} from '@grafana/ui';
import { RecordsFilterRow } from '../../types';
import { RecordViewDefinition } from '../../types/records';
import { operatorsForType } from '../../cdf/records';
import {
  INSTANCE_REF_HINT,
  isVariableToken,
  parseInstanceRef,
} from '../../cdf/instanceRef';
import { Connector } from '../../connector';
import { InstancePicker, PickedInstance } from '../common/InstancePicker';
import { enumValuesOf, OPERATOR_LABELS, propertyOptions, propertyTypeOf } from './shared';
import { formatPropertyOptionLabel } from './typeBadges';
import { BlurInput } from './BlurInput';

interface FilterListProps {
  filters: RecordsFilterRow[];
  viewDef: RecordViewDefinition | null;
  connector: Connector;
  onChange: (filters: RecordsFilterRow[]) => void;
}

/** The view a direct relation points at, when the property declares one. */
const relationTargetOf = (viewDef: RecordViewDefinition | null, property: string) => {
  const source = viewDef?.properties?.[property]?.type?.source;
  return source?.space && source?.externalId && source?.version
    ? { space: source.space, externalId: source.externalId, version: source.version }
    : undefined;
};

const MULTI_OPERATORS = ['in', 'containsAll', 'containsAny'];

/** A value is fine if it is a reference or a variable we cannot resolve until run time. */
const invalidRefs = (values: string[]): string[] =>
  values.filter((value) => !parseInstanceRef(value) && !isVariableToken(value));

const FilterValueEditor = ({
  row,
  viewDef,
  connector,
  onChange,
}: {
  row: RecordsFilterRow;
  viewDef: RecordViewDefinition | null;
  connector: Connector;
  onChange: (patch: Partial<RecordsFilterRow>) => void;
}) => {
  const type = row.propertyType;

  if (row.operator === 'exists') {
    return null;
  }

  // Direct relations are matched by instance reference, so offer the instances of the
  // view the property points at rather than making the user copy identifiers in from
  // elsewhere. This has to come before the multi-operator branch below, which would
  // otherwise swallow "is any of" before any type is considered.
  if (type === 'direct') {
    const target = relationTargetOf(viewDef, row.property);
    const multi = MULTI_OPERATORS.includes(row.operator);
    if (target) {
      const stored: PickedInstance[] = multi
        ? (row.values ?? []).map((value) => ({ value }))
        : row.value
        ? [{ value: row.value }]
        : [];
      return (
        <InstancePicker
          connector={connector}
          view={target}
          multi={multi}
          width={multi ? 40 : 34}
          value={stored}
          // A raw reference or a $variable stays typeable
          allowCustomValue
          placeholder={multi ? 'search or $variable' : 'search, reference or $variable'}
          onChange={(picked) =>
            multi
              ? onChange({ values: picked.map((entry) => entry.value) })
              : onChange({ value: picked[0]?.value ?? '' })
          }
        />
      );
    }
    // No target view means no searchable list -- the search endpoint requires one.
    const typed = multi ? row.values ?? [] : [row.value ?? ''].filter(Boolean);
    const bad = invalidRefs(typed);
    return (
      <Stack direction="column" gap={0}>
        {multi ? (
          <MultiSelect
            width={40}
            allowCustomValue
            placeholder={`${INSTANCE_REF_HINT} or $variable`}
            options={(row.values ?? []).map((value) => ({ label: value, value }))}
            value={row.values ?? []}
            onChange={(selected) =>
              onChange({ values: selected.map((item) => item.value!).filter(Boolean) })
            }
          />
        ) : (
          <BlurInput
            width={34}
            placeholder={`${INSTANCE_REF_HINT} or $variable`}
            value={row.value ?? ''}
            onCommit={(value) => onChange({ value })}
          />
        )}
        {bad.length > 0 && (
          <FieldValidationMessage>
            {`Needs an instance reference like ${INSTANCE_REF_HINT}`}
          </FieldValidationMessage>
        )}
      </Stack>
    );
  }

  if (row.operator === 'range') {
    return (
      <>
        <BlurInput
          width={14}
          placeholder="from"
          value={row.gte ?? ''}
          onCommit={(gte) => onChange({ gte })}
        />
        <BlurInput
          width={14}
          placeholder="to"
          value={row.lte ?? ''}
          onCommit={(lte) => onChange({ lte })}
        />
      </>
    );
  }

  if (MULTI_OPERATORS.includes(row.operator)) {
    const enumValues = enumValuesOf(viewDef, row.property);
    const values = row.values ?? [];
    const options = Array.from(new Set([...enumValues, ...values])).map((value) => ({
      label: value,
      value,
    }));
    return (
      <MultiSelect
        width={34}
        allowCustomValue
        placeholder="values or $variable"
        options={options}
        value={values}
        onChange={(selected) =>
          onChange({ values: selected.map((item) => item.value!).filter(Boolean) })
        }
      />
    );
  }

  if (type === 'boolean') {
    return (
      <Select
        width={16}
        options={[
          { label: 'true', value: 'true' },
          { label: 'false', value: 'false' },
        ]}
        value={row.value ?? ''}
        allowCustomValue
        onChange={({ value }) => onChange({ value })}
      />
    );
  }

  if (type === 'enum') {
    const options = enumValuesOf(viewDef, row.property).map((value) => ({
      label: value,
      value,
    }));
    return (
      <Select
        width={26}
        options={options}
        value={row.value ?? ''}
        allowCustomValue
        placeholder="value or $variable"
        onChange={({ value }) => onChange({ value })}
      />
    );
  }

  return (
    <BlurInput
      width={26}
      placeholder="value or $variable"
      value={row.value ?? ''}
      onCommit={(value) => onChange({ value })}
    />
  );
};

export const FilterList = ({ filters, viewDef, connector, onChange }: FilterListProps) => {
  const options = propertyOptions(viewDef);

  const patchRow = (index: number, patch: Partial<RecordsFilterRow>) =>
    onChange(filters.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  return (
    <EditorField
      label="Filters"
      tooltip="Conditions matched against the records inside the time window, combined with AND. Values accept dashboard variables."
      optional
    >
      <Stack direction="column" gap={0.5} alignItems="flex-start">
        {filters.map((row, index) => {
          const allowed = operatorsForType(
            row.propertyType,
            viewDef?.properties?.[row.property]?.type?.list,
            row.property
          );
          return (
            <InputGroup key={index}>
              <Select
                width={28}
                options={options}
                value={row.property || null}
                placeholder="property"
                formatOptionLabel={formatPropertyOptionLabel()}
                onChange={({ value }) => {
                  const nextType = propertyTypeOf(viewDef, value!);
                  const nextAllowed = operatorsForType(
                    nextType,
                    viewDef?.properties?.[value!]?.type?.list,
                    value!
                  );
                  patchRow(index, {
                    property: value!,
                    propertyType: nextType,
                    // Keep the operator only if it still applies to the new type
                    operator: nextAllowed.includes(row.operator)
                      ? row.operator
                      : nextAllowed[0],
                    // Cleared on any property change: a value entered for the old
                    // property is meaningless against the new one, even when the two
                    // share a type -- one enum's values are not another's.
                    value: undefined,
                    values: undefined,
                    gte: undefined,
                    lte: undefined,
                  });
                }}
              />
              {/* Inverts just this row; rows stay AND-joined. Off by default, so a
                  plain condition never pays for the feature visually. */}
              <AccessoryButton
                variant={row.negate ? 'primary' : 'secondary'}
                aria-label={`Negate filter ${index + 1}`}
                aria-pressed={!!row.negate}
                data-testid={`records-negate-filter-${index}`}
                tooltip={
                  row.negate
                    ? 'This condition is negated: records matching it are excluded.'
                    : 'Negate this condition, keeping only records that do not match it.'
                }
                onClick={() => patchRow(index, { negate: !row.negate || undefined })}
              >
                NOT
              </AccessoryButton>
              <Select
                width={16}
                options={allowed.map((value) => ({
                  label: OPERATOR_LABELS[value],
                  value,
                }))}
                value={row.operator}
                onChange={({ value }) => patchRow(index, { operator: value! })}
              />
              <FilterValueEditor
                row={row}
                viewDef={viewDef}
                connector={connector}
                onChange={(patch) => patchRow(index, patch)}
              />
              <AccessoryButton
                icon="times"
                variant="secondary"
                aria-label={`Remove filter ${index + 1}`}
                data-testid={`records-remove-filter-${index}`}
                onClick={() => onChange(filters.filter((_, i) => i !== index))}
              />
            </InputGroup>
          );
        })}
        <Button
          variant="secondary"
          size="sm"
          icon="plus"
          data-testid="records-add-filter"
          onClick={() => onChange([...filters, { property: '', operator: 'equals' }])}
        >
          Add filter
        </Button>
      </Stack>
    </EditorField>
  );
};
