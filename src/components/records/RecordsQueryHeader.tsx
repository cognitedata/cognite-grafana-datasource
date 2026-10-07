import React from 'react';
import { EditorField, FlexItem } from '@grafana/plugin-ui';
import { Badge, Select, Stack } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { RecordsViewRef } from '../../types';
import { StreamDefinition } from '../../types/records';
import { formatDurationHuman } from '../../cdf/records';

interface RecordsQueryHeaderProps {
  view?: RecordsViewRef;
  viewOptions: Array<SelectableValue<string>>;
  selectedViewValue: string | null;
  loadingViews: boolean;
  stream: StreamDefinition | null;
  maxInterval?: string;
  onViewChange: (value: string) => void;
  preview?: React.ReactNode;
}

export const RecordsQueryHeader = ({
  view,
  viewOptions,
  selectedViewValue,
  loadingViews,
  stream,
  maxInterval,
  onViewChange,
  preview,
}: RecordsQueryHeaderProps) => (
  <>
    <EditorField label="Record view" tooltip="Select a record view to query.">
      <Select
        width={44}
        isLoading={loadingViews}
        options={viewOptions}
        value={selectedViewValue}
        placeholder="Select a record view"
        onChange={({ value }) => onViewChange(value!)}
      />
    </EditorField>
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
