import React from 'react';
import { EditorField, InputGroup, AccessoryButton } from '@grafana/plugin-ui';
import { Button, Select, Stack } from '@grafana/ui';
import { PropertyOption } from '../records/shared';
import { formatPropertyOptionLabel } from '../records/typeBadges';

export type SortDirection = 'asc' | 'desc';

export interface SortRow {
  property: string;
  direction: SortDirection;
}

const DIRECTION_OPTIONS = [
  { label: 'ascending', value: 'asc' as const },
  { label: 'descending', value: 'desc' as const },
];

interface PropertySortEditorProps<R extends SortRow> {
  /** The saved rows. Any other fields they carry are kept as they are. */
  rows: R[];
  /** The properties offered, each with its type for the badge. */
  options: PropertyOption[];
  /** The most rows offered. */
  max: number;
  /** Prefix of the add and remove buttons' test ids: `<prefix>-add-sort`, `<prefix>-remove-sort-N`. */
  testIdPrefix: string;
  /** The row Add sort appends. */
  newRow: R;
  /** The row with a newly picked property, for rows that carry what the property maps to. */
  withProperty?: (row: R, property: string) => R;
  tooltip: string;
  /** For a view whose properties might not be listed, such as one a query was saved with. */
  allowCustomValue?: boolean;
  onChange: (rows: R[]) => void;
}

/**
 * Sort rows over a view's properties, as the Records and Activities tabs offer them:
 * a property with its type badge, a direction, and a remove button per row.
 */
export const PropertySortEditor = <R extends SortRow>({
  rows,
  options,
  max,
  testIdPrefix,
  newRow,
  tooltip,
  allowCustomValue,
  withProperty = (row, property) => ({ ...row, property }),
  onChange,
}: PropertySortEditorProps<R>) => {
  const patchRow = (index: number, patch: (row: R) => R) =>
    onChange(rows.map((row, i) => (i === index ? patch(row) : row)));
  return (
    <EditorField label="Sort by" tooltip={tooltip} optional>
      <Stack direction="column" gap={0.5} alignItems="flex-start">
        {rows.map((row, index) => (
          <InputGroup key={index}>
            <Select
              width={28}
              options={options}
              value={row.property || null}
              placeholder="property"
              allowCustomValue={allowCustomValue}
              formatOptionLabel={formatPropertyOptionLabel()}
              onChange={({ value }) => patchRow(index, (old) => withProperty(old, value!))}
            />
            <Select
              width={16}
              options={DIRECTION_OPTIONS}
              value={row.direction}
              onChange={({ value }) => patchRow(index, (old) => ({ ...old, direction: value! }))}
            />
            <AccessoryButton
              icon="times"
              variant="secondary"
              aria-label={`Remove sort ${index + 1}`}
              data-testid={`${testIdPrefix}-remove-sort-${index}`}
              onClick={() => onChange(rows.filter((_, i) => i !== index))}
            />
          </InputGroup>
        ))}
        {rows.length < max && (
          <Button
            variant="secondary"
            size="sm"
            icon="plus"
            data-testid={`${testIdPrefix}-add-sort`}
            onClick={() => onChange([...rows, newRow])}
          >
            Add sort
          </Button>
        )}
      </Stack>
    </EditorField>
  );
};
