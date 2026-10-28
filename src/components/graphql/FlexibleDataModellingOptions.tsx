import React from 'react';
import { EditorFieldGroup, EditorRow } from '@grafana/plugin-ui';
import { CogniteQuery } from '../../types';
import { DatapointsFields } from '../common/DatapointsFields';
import { LabelField } from '../common/LabelField';

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
 * How the GraphQL tab reads the numeric series its query returns, and how they are
 * named. Laid out in rows like the Time series tab: the data points, then the label.
 */
export const FlexibleDataModellingOptions = ({
  query,
  label,
  labelFields,
  onQueryChange,
  onLabelChange,
  intervalMs,
}: FlexibleDataModellingOptionsProps) => (
  <>
    <EditorRow>
      <DatapointsFields query={query} kind="numeric" intervalMs={intervalMs} onQueryChange={onQueryChange} />
    </EditorRow>
    <EditorRow>
      <EditorFieldGroup>
        <LabelField
          id={`fdm-label-${query.refId}`}
          value={label}
          tooltip={labelTooltip(labelFields)}
          onCommit={onLabelChange}
        />
      </EditorFieldGroup>
    </EditorRow>
  </>
);
