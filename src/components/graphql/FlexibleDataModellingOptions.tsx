import React, { ChangeEvent, useEffect, useState } from 'react';
import { EditorField, EditorFieldGroup, EditorRow } from '@grafana/plugin-ui';
import { Input, Select } from '@grafana/ui';
import { CogniteQuery } from '../../types';
import { GRANULARITY_TOOLTIP, aggregateOptions } from '../commonEditors';

interface FlexibleDataModellingOptionsProps {
  query: CogniteQuery;
  label?: string;
  /** Field paths the current query selects, named in the Label tooltip. */
  labelFields: string[];
  onQueryChange: (patch: Partial<CogniteQuery>) => void;
  onLabelChange: (label: string) => void;
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
}: FlexibleDataModellingOptionsProps) => {
  const aggregated = !!query.aggregation && query.aggregation !== 'none';

  // Typing is held locally and committed on blur. Committing per keystroke would
  // re-run the whole query -- a GraphQL request plus a datapoints fetch per series --
  // for every character of a label template.
  const [draftLabel, setDraftLabel] = useState(label ?? '');
  const [draftGranularity, setDraftGranularity] = useState(query.granularity ?? '');

  useEffect(() => setDraftLabel(label ?? ''), [label]);
  useEffect(() => setDraftGranularity(query.granularity ?? ''), [query.granularity]);

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
          >
            {/* Values are short, but the field still has to carry its own label:
                "Granularity - optional" is wider than the input it sits above. */}
            <Input
              id={`granularity-${query.refId}`}
              width={21}
              value={draftGranularity}
              placeholder="default"
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setDraftGranularity(e.target.value)
              }
              onBlur={() =>
                draftGranularity !== (query.granularity ?? '') &&
                onQueryChange({ granularity: draftGranularity })
              }
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
