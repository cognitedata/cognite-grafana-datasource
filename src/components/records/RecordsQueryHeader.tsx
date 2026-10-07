import React from 'react';
import { EditorField, EditorFieldGroup, FlexItem } from '@grafana/plugin-ui';
import { Badge, RadioButtonGroup, Select, Stack } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { RecordsQueryMode, RecordsViewRef } from '../../types';
import { StreamDefinition } from '../../types/records';
import { formatDurationHuman } from '../../cdf/records';
import { MODE_OPTIONS } from './shared';

interface RecordsQueryHeaderProps {
  mode: RecordsQueryMode;
  view?: RecordsViewRef;
  viewOptions: Array<SelectableValue<string>>;
  selectedViewValue: string | null;
  loadingViews: boolean;
  stream: StreamDefinition | null;
  maxInterval?: string;
  onModeChange: (mode: RecordsQueryMode) => void;
  onViewChange: (value: string) => void;
  preview?: React.ReactNode;
}

export const RecordsQueryHeader = ({
  mode,
  view,
  viewOptions,
  selectedViewValue,
  loadingViews,
  stream,
  maxInterval,
  onModeChange,
  onViewChange,
  preview,
}: RecordsQueryHeaderProps) => (
  <>
    <EditorFieldGroup>
      <EditorField
        label="Query type"
        tooltip="List returns each record as a row, while Aggregate returns statistics."
      >
        <RadioButtonGroup
          options={MODE_OPTIONS}
          value={mode}
          onChange={(value) => onModeChange(value!)}
        />
      </EditorField>
      <EditorField
        label="Record view"
        tooltip="Select a record view to query."
      >
        <Select
          width={44}
          isLoading={loadingViews}
          options={viewOptions}
          value={selectedViewValue}
          placeholder="Select a record view"
          onChange={({ value }) => onViewChange(value!)}
        />
      </EditorField>
    </EditorFieldGroup>
    <FlexItem grow={1} />
    {/* Stack centres its children, so the badge keeps its own height instead of
        stretching to fill the editor row. */}
    <Stack gap={1} alignItems="center">
      {preview}
      {view?.streamId && (
        <Badge
          color="blue"
          icon="database"
          text={[
            view.streamId,
            stream?.type ? stream.type.toLowerCase() : null,
            maxInterval ? `max ${formatDurationHuman(maxInterval)}` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
          tooltip="The stream associated with the selected record view."
        />
      )}
    </Stack>
  </>
);
