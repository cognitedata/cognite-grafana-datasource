import React, { ChangeEvent } from 'react';
import { InlineField, InlineSegmentGroup, InlineFieldRow, Input, Select } from '@grafana/ui';
import { SelectedProps } from '../types';
import { GranularityPicker } from './common/GranularityPicker';

/** Shared with the GraphQL tab's own options row. */
export const GRANULARITY_TOOLTIP =
  'The width of each aggregate interval. Auto follows the time range: Standard gives about one interval ' +
  'per pixel of the panel, Fewer points intervals about 4 times wider, so a quarter as many points are fetched ' +
  'and drawn and a dashboard with many time series loads faster. Fixed takes a value: ' +
  `'second' (or 's'), 'minute' (or 'm'), 'hour' (or 'h'), 'day' (or 'd'), 'month' (or 'mo'). Example: 12h.`;

export const aggregateOptions = [
  { value: 'none', label: 'None' },
  { value: 'average', label: 'Average' },
  { value: 'max', label: 'Max' },
  { value: 'min', label: 'Min' },
  { value: 'count', label: 'Count' },
  { value: 'sum', label: 'Sum' },
  { value: 'interpolation', label: 'Interpolation' },
  { value: 'stepInterpolation', label: 'Step Interpolation' },
  { value: 'continuousVariance', label: 'Continuous Variance' },
  { value: 'discreteVariance', label: 'Discrete Variance' },
  { value: 'totalVariation', label: 'Total Variation' },
];

const GranularityEditor = ({ query, onQueryChange, intervalMs }: SelectedProps & { intervalMs?: number }) => {
  return (
    query.aggregation &&
    query.aggregation !== 'none' && (
      <InlineSegmentGroup>
        <InlineField
          label="Granularity"
          labelWidth={14}
          tooltip={GRANULARITY_TOOLTIP}
          // The picker is wrapped with its badge, so the label is pointed at its input.
          htmlFor={`granularity-${query.refId}`}
        >
          <GranularityPicker
            refId={query.refId}
            value={query.granularity}
            intervalMs={intervalMs}
            onChange={(granularity) => onQueryChange({ granularity })}
          />
        </InlineField>
      </InlineSegmentGroup>
    )
  );
};

const AggregationEditor = (props: SelectedProps) => {
  const { query, onQueryChange } = props;
  return (
    <InlineFieldRow>
      <InlineField
        label="Aggregation"
        labelWidth={14}
      >
        <Select
          inputId={`aggregation-${query.refId}`}
          onChange={({ value }) => onQueryChange({ aggregation: value })}
          options={aggregateOptions}
          menuPosition="fixed"
          value={query.aggregation}
          className="width-10"
        />
      </InlineField>
    </InlineFieldRow>
  );
};

export const LabelEditor = (props: SelectedProps) => {
  const { query, onQueryChange } = props;
  return (
    <InlineSegmentGroup>
      <InlineField
        label="Label"
        labelWidth={10}
        tooltip={
          'Label for each time series. Can also access time series properties via {{property}}, e.g. {{description}}-{{metadata.key}}.'
        }
      >
        <Input
          id={`label-${query.refId}`}
          value={query.label}
          width={40}
          placeholder="default"
          onChange={(e: ChangeEvent<HTMLInputElement>) => onQueryChange({ label: e.target.value })}
        />
      </InlineField>
    </InlineSegmentGroup>
  );
};

export const CommonEditors = (
  {
    onQueryChange,
    query,
    hideAggregation,
    intervalMs,
  }: SelectedProps & { hideAggregation?: boolean; intervalMs?: number }
) => (
  <InlineFieldRow>
    {!hideAggregation && <AggregationEditor {...{ onQueryChange, query }} />}
    <GranularityEditor {...{ onQueryChange, query, intervalMs }} />
    <LabelEditor {...{ onQueryChange, query }} />
  </InlineFieldRow>
);
