import React from 'react';
import { EditorField } from '@grafana/plugin-ui';
import { MultiSelect } from '@grafana/ui';
import { PropertyOption } from '../records/shared';
import { formatPropertyOptionLabel } from '../records/typeBadges';

interface PropertyColumnsFieldProps {
  inputId?: string;
  columns: string[];
  /** The properties offered, each with its type for the badge in the menu. */
  options: PropertyOption[];
  tooltip: string;
  placeholder: string;
  optional?: boolean;
  /** For columns a query was saved with that the view no longer lists. */
  allowCustomValue?: boolean;
  onChange: (columns: string[]) => void;
}

/**
 * The columns a table shows, picked from a view's properties, as the Records and
 * Activities tabs offer them. The type badge shows in the menu only, so the chips
 * stay short.
 */
export const PropertyColumnsField = ({
  inputId,
  columns,
  options,
  tooltip,
  placeholder,
  optional,
  allowCustomValue,
  onChange,
}: PropertyColumnsFieldProps) => (
  <EditorField label="Columns" tooltip={tooltip} optional={optional} htmlFor={inputId}>
    <MultiSelect
      inputId={inputId}
      width={44}
      options={options}
      value={columns}
      placeholder={placeholder}
      allowCustomValue={allowCustomValue}
      formatOptionLabel={formatPropertyOptionLabel(true)}
      onChange={(selected) => onChange(selected.map((item) => item.value!))}
    />
  </EditorField>
);
