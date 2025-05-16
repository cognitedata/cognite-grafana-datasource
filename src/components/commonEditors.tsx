import React, { ChangeEvent } from 'react';
import { InlineField, InlineSegmentGroup, InlineFieldRow, InlineFormLabel, Input, Select } from '@grafana/ui';
import { SelectedProps } from '../types';

const aggregateOptions = [
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

const GranularityEditor = (props: SelectedProps) => {
  const { query, onQueryChange } = props;
  return (
    query.aggregation &&
    query.aggregation !== 'none' && (
      <InlineSegmentGroup>
        <InlineField
          label="Granularity"
          labelWidth={14}
          tooltip={
            `The granularity of the aggregate values. Valid entries are: 'day' (or 'd'), 'hour' (or 'h'), 'minute' (or 'm'), 'second' (or 's'). Example: 12h.`
          }
        >
          <Input
            value={query.granularity}
            id={`granularity-${query.refId}`}
            width={12}
            placeholder="default"
            onChange={(e: ChangeEvent<HTMLInputElement>) => onQueryChange({ granularity: e.target.value })}
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
      <InlineFormLabel htmlFor={`aggregation-${query.refId}`} width={6}>Aggregation</InlineFormLabel>
      <Select
        inputId={`aggregation-${query.refId}`}
        onChange={({ value }) => onQueryChange({ aggregation: value })}
        options={aggregateOptions}
        menuPosition="fixed"
        value={query.aggregation}
        className="cog-mr-4 width-10"
      />
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
          'Set the label for each time series. Can also access time series properties via {{property}}. Eg: {{description}}-{{metadata.key}}'
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

export const CommonEditors = ({ onQueryChange, query, ...etc }: SelectedProps & any) => (
  <InlineFieldRow>
    <AggregationEditor {...{ onQueryChange, query }} />
    <GranularityEditor {...{ onQueryChange, query }} />
    {!etc?.visible && <LabelEditor {...{ onQueryChange, query }} />}
  </InlineFieldRow>
);
