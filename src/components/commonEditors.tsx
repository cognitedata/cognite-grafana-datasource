import React, { ChangeEvent } from 'react';
import { InlineField, InlineSegmentGroup, InlineFieldRow, Input, Select } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { SelectedProps } from '../types';
import { NUMERIC_AGGREGATES } from '../cdf/aggregates';
import { GranularityPicker, granularityInputId } from './common/GranularityPicker';

/** Shared with the GraphQL tab's own options row. */
export const GRANULARITY_TOOLTIP =
  'The width of each aggregate interval. Auto follows the time range: Standard gives about one interval ' +
  'per pixel of the panel, Fewer points intervals about 4 times wider, so a quarter as many points are fetched ' +
  'and drawn and a dashboard with many time series loads faster. Fixed takes a value: ' +
  `'second' (or 's'), 'minute' (or 'm'), 'hour' (or 'h'), 'day' (or 'd'), 'month' (or 'mo'). Example: 12h.`;

export const aggregateOptions = NUMERIC_AGGREGATES;

const GranularityEditor = ({ query, onQueryChange, intervalMs }: SelectedProps & { intervalMs?: number }) => {
  return (
    query.aggregation &&
    query.aggregation !== 'none' && (
      <InlineSegmentGroup>
        <InlineField
          label="Granularity"
          labelWidth={14}
          tooltip={GRANULARITY_TOOLTIP}
          // The picker is wrapped with its badge, so the label is pointed at the control shown.
          htmlFor={granularityInputId(query.refId, query.granularity)}
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

const AggregationEditor = (
  props: SelectedProps & { options?: Array<SelectableValue<string>> }
) => {
  const { query, onQueryChange, options = aggregateOptions } = props;
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
          // Wide enough for the option descriptions to read on one or two lines.
          width={36}
        />
      </InlineField>
    </InlineFieldRow>
  );
};

const LABEL_TOOLTIP =
  'Label for each time series. Can also access time series properties via {{property}}, e.g. {{description}}-{{metadata.key}}.';

export const LabelEditor = (
  props: SelectedProps & { tooltip?: string; labelWidth?: number; width?: number }
) => {
  const { query, onQueryChange, tooltip = LABEL_TOOLTIP, labelWidth = 10, width = 40 } = props;
  return (
    <InlineSegmentGroup>
      <InlineField
        label="Label"
        labelWidth={labelWidth}
        tooltip={tooltip}
      >
        <Input
          id={`label-${query.refId}`}
          value={query.label}
          width={width}
          placeholder="default"
          onChange={(e: ChangeEvent<HTMLInputElement>) => onQueryChange({ label: e.target.value })}
        />
      </InlineField>
    </InlineSegmentGroup>
  );
};

/**
 * The label on a row of its own, below everything else on the tab: it names whatever
 * the rows above produce, raw, aggregated or latest.
 */
export const LabelRow = (props: SelectedProps & { tooltip?: string }) => (
  <InlineFieldRow>
    <LabelEditor {...props} labelWidth={14} width={64} />
  </InlineFieldRow>
);

export const CommonEditors = (
  {
    onQueryChange,
    query,
    intervalMs,
    aggregateOptions: options,
    hideLabel,
  }: SelectedProps & {
    intervalMs?: number;
    aggregateOptions?: Array<SelectableValue<string>>;
    /** For a tab that places the label on a row of its own. */
    hideLabel?: boolean;
  }
) => (
  <InlineFieldRow>
    <AggregationEditor {...{ onQueryChange, query, options }} />
    <GranularityEditor {...{ onQueryChange, query, intervalMs }} />
    {!hideLabel && <LabelEditor {...{ onQueryChange, query }} />}
  </InlineFieldRow>
);
