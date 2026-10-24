import React from 'react';
import { EditorField, EditorFieldGroup, FlexItem } from '@grafana/plugin-ui';
import { Badge, FieldValidationMessage, RadioButtonGroup, Select, Stack } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { RecordsQueryMode, RecordsViewRef } from '../../types';
import { StreamDefinition } from '../../types/records';
import { formatDurationHuman } from '../../cdf/records';
import { MODE_OPTIONS } from './shared';

interface RecordsQueryHeaderProps {
  refId: string;
  mode: RecordsQueryMode;
  view?: RecordsViewRef;
  viewOptions: Array<SelectableValue<string>>;
  selectedViewValue: string | null;
  loadingViews: boolean;
  /** Why the record views could not be listed. */
  viewsError?: string | null;
  stream: StreamDefinition | null;
  maxInterval?: string;
  onModeChange: (mode: RecordsQueryMode) => void;
  onViewChange: (value: string) => void;
  preview?: React.ReactNode;
}

export const RecordsQueryHeader = ({
  refId,
  mode,
  view,
  viewOptions,
  selectedViewValue,
  loadingViews,
  viewsError,
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
        tooltip="The record view to read records from."
        htmlFor={`records-view-${refId}`}
      >
        <div>
          <Select
            inputId={`records-view-${refId}`}
            width={44}
            isLoading={loadingViews}
            options={viewOptions}
            value={selectedViewValue}
            placeholder="Select a record view"
            invalid={!!viewsError}
            onChange={({ value }) => onViewChange(value!)}
          />
          {viewsError && <FieldValidationMessage>{viewsError}</FieldValidationMessage>}
        </div>
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
          tooltip="The stream that holds the record view's records."
        />
      )}
    </Stack>
  </>
);
