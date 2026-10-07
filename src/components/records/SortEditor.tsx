import React from 'react';
import { EditorField, InputGroup, AccessoryButton } from '@grafana/plugin-ui';
import { Button, Select, Stack } from '@grafana/ui';
import { RecordsSortRow } from '../../types';
import { RecordViewDefinition } from '../../types/records';
import { propertyOptions } from './shared';
import { formatPropertyOptionLabel } from './typeBadges';

interface SortEditorProps {
  sort: RecordsSortRow[];
  viewDef: RecordViewDefinition | null;
  onChange: (sort: RecordsSortRow[]) => void;
}

export const SortEditor = ({ sort, viewDef, onChange }: SortEditorProps) => {
  const options = propertyOptions(viewDef);

  /**
   * Sorting goes through the container property. The
   * mapping is captured here so the request builder stays pure.
   */
  const withContainer = (property: string, direction: 'asc' | 'desc'): RecordsSortRow => {
    const mapped = viewDef?.properties?.[property];
    return {
      property,
      direction,
      containerSpace: mapped?.container?.space,
      containerExternalId: mapped?.container?.externalId,
      containerPropertyIdentifier: mapped?.containerPropertyIdentifier,
    };
  };

  return (
    <EditorField
      label="Sort by"
      tooltip="Select one or more properties to sort the results by."
      optional
    >
      <Stack direction="column" gap={0.5} alignItems="flex-start">
        {sort.map((row, index) => (
          <InputGroup key={index}>
            <Select
              width={28}
              options={options}
              value={row.property || null}
              placeholder="property"
              formatOptionLabel={formatPropertyOptionLabel()}
              onChange={({ value }) =>
                onChange(
                  sort.map((old, i) =>
                    i === index ? withContainer(value!, old.direction) : old
                  )
                )
              }
            />
            <Select
              width={16}
              options={[
                { label: 'ascending', value: 'asc' as const },
                { label: 'descending', value: 'desc' as const },
              ]}
              value={row.direction}
              onChange={({ value }) =>
                onChange(
                  sort.map((old, i) => (i === index ? { ...old, direction: value! } : old))
                )
              }
            />
            <AccessoryButton
              icon="times"
              variant="secondary"
              aria-label={`Remove sort ${index + 1}`}
              data-testid={`records-remove-sort-${index}`}
              onClick={() => onChange(sort.filter((_, i) => i !== index))}
            />
          </InputGroup>
        ))}
        {sort.length < 5 && (
          <Button
            variant="secondary"
            size="sm"
            icon="plus"
            data-testid="records-add-sort"
            onClick={() => onChange([...sort, withContainer('', 'desc')])}
          >
            Add sort
          </Button>
        )}
      </Stack>
    </EditorField>
  );
};
