import React from 'react';
import { EditorField, EditorFieldGroup } from '@grafana/plugin-ui';
import { SelectableValue } from '@grafana/data';
import { RECORDS_PAGE_LIMIT } from '../../constants';
import { BlurInput } from './BlurInput';
import { PropertyColumnsField } from '../common/PropertyColumnsField';

interface ListOptionsEditorProps {
  columns: string[];
  columnOptions: Array<SelectableValue<string>>;
  limit: number;
  onChange: (partial: { columns?: string[]; limit?: number }) => void;
}

export const ListOptionsEditor = ({
  columns,
  columnOptions,
  limit,
  onChange,
}: ListOptionsEditorProps) => (
  <EditorFieldGroup>
    <PropertyColumnsField
      columns={columns}
      options={columnOptions}
      tooltip="Fields to show. Leave empty for every view property plus top level record properties."
      placeholder="all properties"
      optional
      onChange={(next) => onChange({ columns: next })}
    />
    <EditorField
      label="Limit"
      tooltip={`CDF will return at most ${RECORDS_PAGE_LIMIT} records on this request.`}
    >
      <BlurInput
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
