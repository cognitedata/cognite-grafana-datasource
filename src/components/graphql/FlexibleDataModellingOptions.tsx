import React from 'react';
import { EditorField, EditorFieldGroup, EditorRow } from '@grafana/plugin-ui';
import { RadioButtonGroup } from '@grafana/ui';
import { CogniteQuery, GraphqlQueryType } from '../../types';
import { defaultAggregationFor, isAggregateAllowed, TimeSeriesKind } from '../../cdf/aggregates';
import { STATE_LABEL_TOOLTIP_SUFFIX } from '../commonEditors';
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
export const labelTooltip = (labelFields: string[], seriesType?: TimeSeriesKind): string =>
  (labelFields.length
    ? `${LABEL_TOOLTIP} Fields in this query: ${labelFields.map((field) => `{{${field}}}`).join(', ')}.`
    : LABEL_TOOLTIP) + (seriesType === 'state' ? ` ${STATE_LABEL_TOOLTIP_SUFFIX}` : '');

const QUERY_TYPE_OPTIONS: Array<{ label: string; value: GraphqlQueryType; description: string }> = [
  { label: 'Numeric', value: 'numeric', description: 'Data points of the numeric time series the query returns' },
  { label: 'String', value: 'string', description: 'Data points of the string time series the query returns' },
  { label: 'State', value: 'state', description: 'Data points of the state time series the query returns' },
  { label: 'Instances', value: 'instances', description: 'The rows the query returns, without data points' },
];

const QUERY_TYPE_TOOLTIP =
  'The data points of one type of time series, or the rows alone (Instances). The Examples dialog shows each.';

/**
 * What the GraphQL tab fetches for its rows, and how the returned series are read
 * and named. Laid out in rows like the Time series tab: the query type, then the
 * data points, then the label.
 */
export const FlexibleDataModellingOptions = ({
  query,
  label,
  labelFields,
  onQueryChange,
  onLabelChange,
  intervalMs,
}: FlexibleDataModellingOptionsProps) => {
  const queryType = query.flexibleDataModellingQuery.queryType ?? 'numeric';
  const seriesType = queryType === 'instances' ? undefined : queryType;

  const changeQueryType = (next: GraphqlQueryType) =>
    onQueryChange({
      flexibleDataModellingQuery: { ...query.flexibleDataModellingQuery, queryType: next },
      // An aggregation the new type does not have gives way to that type's default.
      // Latest reads no aggregation, so the saved one is left alone there.
      ...(next === 'instances' || query.latestValue || isAggregateAllowed(next, query.aggregation)
        ? {}
        : { aggregation: defaultAggregationFor(next) }),
    });

  return (
    <>
      <EditorRow>
        <EditorFieldGroup>
          <EditorField label="Query type" tooltip={QUERY_TYPE_TOOLTIP}>
            <RadioButtonGroup
              options={QUERY_TYPE_OPTIONS}
              value={queryType}
              onChange={changeQueryType}
              aria-label="Query type"
            />
          </EditorField>
        </EditorFieldGroup>
      </EditorRow>
      {seriesType && (
        <>
          <EditorRow>
            <DatapointsFields query={query} kind={seriesType} intervalMs={intervalMs} onQueryChange={onQueryChange} />
          </EditorRow>
          <EditorRow>
            <EditorFieldGroup>
              <LabelField
                id={`fdm-label-${query.refId}`}
                value={label}
                tooltip={labelTooltip(labelFields, seriesType)}
                onCommit={onLabelChange}
              />
            </EditorFieldGroup>
          </EditorRow>
        </>
      )}
    </>
  );
};
