import React from 'react';
import { EditorField } from '@grafana/plugin-ui';
import { Badge, RadioButtonGroup, Stack } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { RecordsQuery, RecordsTimeFilterMode } from '../../types';
import { formatDurationHuman } from '../../cdf/records';

interface TimeWindowEditorProps {
  timeFilterMode: RecordsTimeFilterMode;
  timeFilterOptions: Array<SelectableValue<RecordsTimeFilterMode>>;
  isImmutable: boolean;
  rangeExceedsLimit: boolean;
  maxInterval?: string;
  onChange: (partial: Partial<RecordsQuery>) => void;
}

export const TimeWindowEditor = ({
  timeFilterMode,
  timeFilterOptions,
  isImmutable,
  rangeExceedsLimit,
  maxInterval,
  onChange,
}: TimeWindowEditorProps) => (
  <EditorField
    label="Time window"
    tooltip={
      'Selects which records are read, by lastUpdatedTime. This narrows the ' +
      'stream before the filters below are evaluated.' +
      (isImmutable ? ' This stream is immutable, so a window is always required.' : '')
    }
  >
    <Stack gap={1} alignItems="center">
      <RadioButtonGroup
        options={timeFilterOptions}
        value={timeFilterMode}
        onChange={(value) => onChange({ timeFilterMode: value! })}
      />
      {rangeExceedsLimit && (
        <Badge
          color="orange"
          icon="exclamation-triangle"
          text={`Time range exceeds the stream limit of ${formatDurationHuman(maxInterval)}`}
          tooltip="Shorten the dashboard time range."
        />
      )}
    </Stack>
  </EditorField>
);
