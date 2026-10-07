import React from 'react';
import { EditorField, EditorFieldGroup } from '@grafana/plugin-ui';
import { MultiSelect } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { RECORDS_PAGE_LIMIT } from '../../constants';
import { formatPropertyOptionLabel } from './typeBadges';
import { BlurInput } from './BlurInput';

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
    <EditorField
      label="Columns"
      tooltip="Fields to show. Leave empty for every view property plus top level record properties."
      optional
    >
      <MultiSelect
        width={44}
        options={columnOptions}
        value={columns}
        placeholder="all properties"
        formatOptionLabel={formatPropertyOptionLabel(true)}
        onChange={(selected) => onChange({ columns: selected.map((item) => item.value!) })}
      />
    </EditorField>
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
