import React, { ChangeEvent, useEffect, useState } from 'react';
import { EditorField, EditorFieldGroup, EditorRow } from '@grafana/plugin-ui';
import { Input, Select } from '@grafana/ui';
import { CogniteQuery } from '../../types';
import { GRANULARITY_TOOLTIP, aggregateOptions } from '../commonEditors';
import { GAP_FILL_TOOLTIP, GapFillControls } from '../common/GapFillEditor';
import { GranularityPicker, granularityInputId } from '../common/GranularityPicker';

interface FlexibleDataModellingOptionsProps {
  query: CogniteQuery;
  label?: string;
  /** Field paths the current query selects, named in the Label tooltip. */
  labelFields: string[];
  onQueryChange: (patch: Partial<CogniteQuery>) => void;
  onLabelChange: (label: string) => void;
  /** The panel's interval, for showing what an auto granularity resolves to. */
  intervalMs?: number;
}

const LABEL_TOOLTIP =
  'Series label, interpolating fields of the response with {{field}}, for example {{name}} or {{externalId}}. Left empty, each series is labelled with its name.';

/** The Label tooltip, naming the fields the current query actually selects. */
export const labelTooltip = (labelFields: string[]): string =>
  labelFields.length
    ? `${LABEL_TOOLTIP} Fields in this query: ${labelFields.map((field) => `{{${field}}}`).join(', ')}.`
    : LABEL_TOOLTIP;

/**
 * How the returned series are aggregated and named.
 *
 * The same three controls the other tabs get from `CommonEditors`, rebuilt on the
 * editor-row primitives this tab uses so they share one row instead of sitting in a
 * second, differently styled one.
 */
export const FlexibleDataModellingOptions = ({
  query,
  label,
  labelFields,
  onQueryChange,
  onLabelChange,
  intervalMs,
}: FlexibleDataModellingOptionsProps) => {
  const aggregated = !!query.aggregation && query.aggregation !== 'none';

  // Typing is held locally and committed on blur. Committing per keystroke would
  // re-run the whole query -- a GraphQL request plus a datapoints fetch per series --
  // for every character of a label template.
  const [draftLabel, setDraftLabel] = useState(label ?? '');

  useEffect(() => setDraftLabel(label ?? ''), [label]);

  return (
    <EditorRow>
      <EditorFieldGroup>
        <EditorField label="Aggregation" tooltip="How each series is aggregated over time.">
          <Select
            inputId={`aggregation-${query.refId}`}
            width={24}
            options={aggregateOptions}
            value={query.aggregation}
            menuPosition="fixed"
            onChange={({ value }) => onQueryChange({ aggregation: value })}
          />
        </EditorField>
        {aggregated && (
          <EditorField
            label="Granularity"
            optional
            tooltip={GRANULARITY_TOOLTIP}
            htmlFor={granularityInputId(query.refId, query.granularity)}
          >
            <GranularityPicker
              refId={query.refId}
              value={query.granularity}
              intervalMs={intervalMs}
              onChange={(granularity) => onQueryChange({ granularity })}
            />
          </EditorField>
        )}
        {aggregated && (
          <EditorField label="Gap filling" optional tooltip={GAP_FILL_TOOLTIP}>
            <GapFillControls
              query={query}
              intervalMs={intervalMs}
              onChange={(gapFill) => onQueryChange({ gapFill })}
            />
          </EditorField>
        )}
        <EditorField
          label="Label"
          optional
          tooltip={labelTooltip(labelFields)}
        >
          <Input
            id={`fdm-label-${query.refId}`}
            width={44}
            value={draftLabel}
            placeholder="{{name}}"
            onChange={(e: ChangeEvent<HTMLInputElement>) => setDraftLabel(e.target.value)}
            onBlur={() => draftLabel !== (label ?? '') && onLabelChange(draftLabel)}
          />
        </EditorField>
      </EditorFieldGroup>
    </EditorRow>
  );
};
