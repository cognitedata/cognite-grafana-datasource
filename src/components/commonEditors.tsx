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

export const stateAggregateOptions = [
  { value: 'none', label: 'None' },
  { value: 'dominantState', label: 'Dominant State' },
  { value: 'count', label: 'Count' },
  { value: 'stateDuration', label: 'State Duration' },
  { value: 'stateCount', label: 'State Count' },
  { value: 'stateTransitions', label: 'State Transitions' },
];

export type LabelContext = 'legacy' | 'cdmNumeric' | 'cdmState';

const LABEL_TOOLTIPS: Record<LabelContext, string> = {
  legacy:
    'Label for each time series. Access time series properties via {{property}}, e.g. {{description}}-{{metadata.key}}.',
  cdmNumeric:
    'Label for each time series. Access view properties via {{property}}, e.g. {{name}} or {{unit.externalId}}.',
  cdmState:
    'Label for each time series. Access view properties via {{property}}, e.g. {{name}}. ' +
    'For the State Duration / State Count / State Transitions aggregations (which produce one series per state), ' +
    'use the reserved {{$state}} token to embed the state name in the label.',
};

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
            `The granularity of the aggregate values. Use: 'day' (or 'd'), 'hour' (or 'h'), 'minute' (or 'm'), 'second' (or 's'). Example: 12h.`
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

const AggregationEditor = (props: SelectedProps & { isStateType?: boolean }) => {
  const { query, onQueryChange, isStateType } = props;
  const options = isStateType ? stateAggregateOptions : aggregateOptions;
  return (
    <InlineFieldRow>
      <InlineField
        label="Aggregation"
        labelWidth={14}
      >
        <Select
          inputId={`aggregation-${query.refId}`}
          onChange={({ value }) => onQueryChange({ aggregation: value })}
          options={options}
          menuPosition="fixed"
          value={query.aggregation}
          className="width-10"
        />
      </InlineField>
    </InlineFieldRow>
  );
};

export const LabelEditor = (props: SelectedProps & { labelContext?: LabelContext }) => {
  const { query, onQueryChange, labelContext = 'legacy' } = props;
  const tooltip = LABEL_TOOLTIPS[labelContext];
  return (
    <InlineSegmentGroup>
      <InlineField
        label="Label"
        labelWidth={10}
        tooltip={tooltip}
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

export const CommonEditors = ({
  onQueryChange,
  query,
  ...etc
}: SelectedProps & { visible?: boolean; hideAggregation?: boolean; isStateType?: boolean; labelContext?: LabelContext }) => (
  <InlineFieldRow>
    {!etc?.hideAggregation && <AggregationEditor {...{ onQueryChange, query, isStateType: etc?.isStateType }} />}
    <GranularityEditor {...{ onQueryChange, query }} />
    {!etc?.visible && (
      <LabelEditor {...{ onQueryChange, query, labelContext: etc?.labelContext ?? 'legacy' }} />
    )}
  </InlineFieldRow>
);
