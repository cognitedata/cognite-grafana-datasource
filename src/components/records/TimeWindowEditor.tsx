import React from 'react';
import { EditorField, InputGroup } from '@grafana/plugin-ui';
import {
  Badge,
  FieldValidationMessage,
  RadioButtonGroup,
  Stack,
} from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { RecordsQuery, RecordsTimeFilterMode } from '../../types';
import { formatDurationHuman } from '../../cdf/records';
import { TIME_EXPRESSION_ANCHORS, TimeExpressionResult } from '../../cdf/timeExpression';
import { BlurInput } from './BlurInput';

interface TimeWindowEditorProps {
  recordsQuery: RecordsQuery;
  timeFilterMode: RecordsTimeFilterMode;
  timeFilterOptions: Array<SelectableValue<RecordsTimeFilterMode>>;
  isImmutable: boolean;
  rangeExceedsLimit: boolean;
  maxInterval?: string;
  customFrom: TimeExpressionResult;
  customTo: TimeExpressionResult;
  onChange: (partial: Partial<RecordsQuery>) => void;
}

export const TimeWindowEditor = ({
  recordsQuery,
  timeFilterMode,
  timeFilterOptions,
  isImmutable,
  rangeExceedsLimit,
  maxInterval,
  customFrom,
  customTo,
  onChange,
}: TimeWindowEditorProps) => (
  <>
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
            text={`${timeFilterMode === 'custom' ? 'Window' : 'Time range'} exceeds the stream limit of ${formatDurationHuman(maxInterval)}`}
            tooltip={
              timeFilterMode === 'custom'
                ? 'Narrow the window bounds, or split the window across several queries.'
                : 'Shorten the dashboard time range, or switch to a custom window and combine several queries.'
            }
          />
        )}
      </Stack>
    </EditorField>
    {timeFilterMode === 'custom' && (
      <EditorField
        label="Window bounds"
        tooltip={`Bounds of the time window above. Expressions must resolve to a point in time. Anchors: ${TIME_EXPRESSION_ANCHORS.map(
          (a) => a.name
        ).join(', ')}. Supports + - * / and ISO timestamps.`}
      >
        <Stack direction="column" gap={0.5} alignItems="flex-start">
          <Stack gap={1} alignItems="center">
            <InputGroup>
              <BlurInput
                width={40}
                prefix="from"
                value={recordsQuery.timeFilterFrom ?? ''}
                invalid={!!customFrom.error}
                placeholder="{{endTime}} - {{maxFilteringInterval}}"
                onCommit={(timeFilterFrom) => onChange({ timeFilterFrom })}
              />
              <BlurInput
                width={40}
                prefix="to"
                value={recordsQuery.timeFilterTo ?? ''}
                invalid={!!customTo.error}
                placeholder="{{endTime}}"
                onCommit={(timeFilterTo) => onChange({ timeFilterTo })}
              />
            </InputGroup>
            {customFrom.iso && customTo.iso && (
              <Badge
                color="blue"
                icon="clock-nine"
                text={`${customFrom.iso} → ${customTo.iso}`}
                tooltip="The window this query will request."
              />
            )}
          </Stack>
          {customFrom.error && (
            <FieldValidationMessage>{customFrom.error}</FieldValidationMessage>
          )}
          {customTo.error && (
            <FieldValidationMessage>{customTo.error}</FieldValidationMessage>
          )}
        </Stack>
      </EditorField>
    )}
  </>
);
