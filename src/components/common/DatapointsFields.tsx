import React, { useEffect, useRef } from 'react';
import { EditorField, EditorFieldGroup } from '@grafana/plugin-ui';
import { RadioButtonGroup, Select } from '@grafana/ui';
import { CogniteQuery } from '../../types';
import {
  aggregateGroupsFor,
  canAggregate,
  DatapointsMode,
  datapointsModeOf,
  datapointsModePatch,
  TimeSeriesKind,
} from '../../cdf/aggregates';
import { GRANULARITY_TOOLTIP } from '../commonEditors';
import { GAP_FILL_TOOLTIP, GapFillControls } from './GapFillEditor';
import { GranularityPicker, granularityInputId } from './GranularityPicker';

const MODE_OPTIONS: Array<{ label: string; value: DatapointsMode; description: string }> = [
  { label: 'Aggregate', value: 'aggregate', description: 'One value per granularity interval, computed by CDF' },
  { label: 'Raw', value: 'raw', description: 'The data points as stored' },
  { label: 'Latest', value: 'latest', description: 'The last data point in the time range' },
];

const MODE_TOOLTIP =
  'How the data points of each time series are read. Aggregate: one value per granularity interval, computed ' +
  'by CDF, with the aggregation, granularity and gap filling chosen here. Raw: the data points as stored. ' +
  'Latest: the last data point in the time range.';

const AGGREGATION_TOOLTIP = 'How the data points in each interval are combined into one value.';

interface DatapointsFieldsProps {
  query: Pick<CogniteQuery, 'refId' | 'aggregation' | 'granularity' | 'gapFill' | 'latestValue'>;
  /** The type of the series read, which decides the aggregates offered. Numeric until known. */
  kind?: TimeSeriesKind;
  /** The panel's interval, for showing what an auto granularity resolves to. */
  intervalMs?: number;
  onQueryChange: (patch: Partial<CogniteQuery>) => void;
  /** While the series' type is being looked up: the aggregates it accepts are not known yet. */
  disabled?: boolean;
}

/**
 * The field groups of the Data points row, shared by the CDM tabs: the mode and the
 * aggregation, then the granularity and gap filling. Two groups, so a narrow editor
 * wraps the row between them rather than mid-pair. Raw and Latest collapse the row
 * to the mode alone.
 */
export const DatapointsFields = ({ query, kind, intervalMs, onQueryChange, disabled }: DatapointsFieldsProps) => {
  const mode = datapointsModeOf(query);
  // Raw saves no aggregation, so the one in use is remembered for coming back to Aggregate.
  const lastAggregate = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (mode === 'aggregate') {
      lastAggregate.current = query.aggregation;
    }
  }, [mode, query.aggregation]);
  return (
    <>
      <EditorFieldGroup>
        <EditorField label="Data points" tooltip={MODE_TOOLTIP}>
          <RadioButtonGroup
            // A type with no aggregates yet is read raw or latest only.
            options={canAggregate(kind) ? MODE_OPTIONS : MODE_OPTIONS.filter(({ value }) => value !== 'aggregate')}
            value={mode}
            onChange={(next) => onQueryChange(datapointsModePatch(next, query, kind, lastAggregate.current))}
            disabled={disabled}
            aria-label="Data points"
          />
        </EditorField>
        {mode === 'aggregate' && (
          <EditorField label="Aggregation" tooltip={AGGREGATION_TOOLTIP} htmlFor={`aggregation-${query.refId}`}>
            <Select
              inputId={`aggregation-${query.refId}`}
              // Wide enough for the option descriptions to read on one or two lines.
              width={36}
              options={aggregateGroupsFor(kind, { withNone: false })}
              value={query.aggregation}
              menuPosition="fixed"
              onChange={({ value }) => onQueryChange({ aggregation: value })}
            />
          </EditorField>
        )}
      </EditorFieldGroup>
      {mode === 'aggregate' && (
        <EditorFieldGroup>
          <EditorField label="Granularity" tooltip={GRANULARITY_TOOLTIP} htmlFor={granularityInputId(query.refId, query.granularity)}>
            <GranularityPicker
              refId={query.refId}
              value={query.granularity}
              intervalMs={intervalMs}
              onChange={(granularity) => onQueryChange({ granularity })}
            />
          </EditorField>
          <EditorField label="Gap filling" optional tooltip={GAP_FILL_TOOLTIP}>
            <GapFillControls
              query={query}
              intervalMs={intervalMs}
              onChange={(gapFill) => onQueryChange({ gapFill })}
            />
          </EditorField>
        </EditorFieldGroup>
      )}
    </>
  );
};
