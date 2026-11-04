import React from 'react';
import { EditorField, EditorFieldGroup } from '@grafana/plugin-ui';
import { SelectableValue } from '@grafana/data';
import { RECORDS_PAGE_LIMIT } from '../../constants';
import { BlurInput } from './BlurInput';
import { PropertyColumnsField } from '../common/PropertyColumnsField';

interface ListOptionsEditorProps {
  refId: string;
  columns: string[];
  columnOptions: Array<SelectableValue<string>>;
  limit: number;
  onChange: (partial: { columns?: string[]; limit?: number }) => void;
}

export const ListOptionsEditor = ({
  refId,
  columns,
  columnOptions,
  limit,
  onChange,
}: ListOptionsEditorProps) => (
  <EditorFieldGroup>
    <PropertyColumnsField
      inputId={`records-columns-${refId}`}
      columns={columns}
      options={columnOptions}
      tooltip="Fields to show. Leave empty for every view property plus the record's own properties."
      placeholder="all properties"
      optional
      onChange={(next) => onChange({ columns: next })}
    />
    <EditorField
      label="Limit"
      tooltip={`CDF returns at most ${RECORDS_PAGE_LIMIT} records per request.`}
      htmlFor={`records-limit-${refId}`}
    >
      <BlurInput
        id={`records-limit-${refId}`}
        width={12}
        type="number"
        value={String(limit)}
        onCommit={(text) =>
          onChange({ limit: Math.min(Math.max(Number(text) || 1, 1), RECORDS_PAGE_LIMIT) })
        }
      />
    </EditorField>
  </EditorFieldGroup>
);
