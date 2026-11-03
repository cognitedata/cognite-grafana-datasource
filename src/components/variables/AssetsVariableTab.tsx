import React from 'react';
import { InlineField, InlineFieldRow, Input, Select, TextLink } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { variableValueOptions } from '../../constants';
import { FormattedMessage, Keyword } from '../common/Styled';
import { DeprecationNotice } from '../common/DeprecationNotice';

const assetsHelp = (
  <pre>
    Variable query uses the{' '}
    <TextLink external href="https://api-docs.cognite.com/20230101/tag/Assets/operation/listAssets">
      assets/list
    </TextLink>{' '}
    endpoint to fetch data. Use <Keyword>&apos;=&apos;</Keyword> operator to provide parameters for
    the request.
    <br />
    Format: <Keyword>{`assets{param=value,...}`}</Keyword>
    <br />
    Example: <Keyword>{`assets{assetSubtreeIds=[{id=123}, {externalId='external'}]}`}</Keyword>
    <br />
    <br />
    You can specify additional client-side filtering with the <Keyword>
      &apos;=~&apos;
    </Keyword>, <Keyword>&apos;!~&apos;</Keyword> and <Keyword>&apos;!=&apos;</Keyword> operators.
    Comma between multiple filters acts as logic <Keyword>AND</Keyword>
    <br />
    Format:
    <br />
    <Keyword>&apos;=~&apos;</Keyword> – regex equality, returns results satisfying the regular
    expression.
    <br />
    <Keyword>&apos;!~&apos;</Keyword> – regex inequality, excludes results satisfying the regular
    expression.
    <br />
    <Keyword>&apos;!=&apos;</Keyword> – strict inequality, returns items where a property
    doesn&apos;t equal a given value.
    <br />
    Example:{' '}
    <Keyword>{`assets{metadata={KEY='value', KEY_2=~'value.*'}, assetSubtreeIds=[{id=123}]}`}</Keyword>
    To learn more about the querying capabilities of Cognite Data Source for Grafana, please visit
    our{' '}
    <TextLink external href="https://docs.cognite.com/cdf/dashboards/guides/grafana/timeseries">
      documentation
    </TextLink>
    .
  </pre>
);

interface AssetsVariableTabProps {
  query: string;
  valueType?: SelectableValue<string>;
  error?: string;
  onQueryChange: (query: string) => void;
  onValueTypeChange: (value: SelectableValue<string>) => void;
  onBlur: () => void;
}

export const AssetsVariableTab = ({
  query,
  valueType,
  error,
  onQueryChange,
  onValueTypeChange,
  onBlur,
}: AssetsVariableTabProps) => (
  <div>
    <DeprecationNotice replacement="Use the GraphQL tab to build variables from a data model instead." />
    <InlineFieldRow>
      <InlineField label="Query" labelWidth={10} htmlFor="assets-variable-query" grow>
        <Input
          id="assets-variable-query"
          value={query}
          onChange={(event) => onQueryChange(event.currentTarget.value)}
          onBlur={onBlur}
          placeholder="eg: assets{name='example', assetSubtreeIds=[{id=123456789, externalId='externalId'}]}"
        />
      </InlineField>
      <InlineField
        label="Value"
        tooltip="Value to populate when using the variable."
        htmlFor="assets-variable-value"
      >
        <Select
          inputId="assets-variable-value"
          options={variableValueOptions}
          onChange={onValueTypeChange}
          value={valueType}
          width={20}
          onBlur={onBlur}
        />
      </InlineField>
    </InlineFieldRow>
    <div>
      {error ? <FormattedMessage severity="error">{error}</FormattedMessage> : null}
      {assetsHelp}
    </div>
  </div>
);
