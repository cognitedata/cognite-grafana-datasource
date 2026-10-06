import React from 'react';
import { EditorField, EditorFieldGroup, EditorRow, EditorRows, FlexItem } from '@grafana/plugin-ui';
import { Badge, Select, Stack } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import CogniteDatasource from '../../datasource';
import { VARIABLE_REF_ID } from '../../constants';
import { INSTANCE_ID_FIELD, INSTANCE_REF_HINT } from '../../cdf/instanceRef';
import { GraphqlQueryEditor } from '../graphql/GraphqlQueryEditor';
import { GraphqlDataModelRef } from '../graphql/useGraphqlDataModels';
import { GraphqlExamplesModal } from '../graphql/GraphqlExamplesModal';
import { VARIABLE_GRAPHQL_EXAMPLES } from '../graphql/graphqlExamples';

interface GraphqlVariableTabProps {
  datasource: CogniteDatasource;
  graphqlQuery: string;
  dataModel: GraphqlDataModelRef;
  valueType?: SelectableValue<string>;
  displayField?: string;
  valueFieldOptions: Array<SelectableValue<string>>;
  displayFieldOptions: Array<SelectableValue<string>>;
  canEmitInstanceRef: boolean;
  queryError?: string;
  onDataModelChange: (dataModel: {
    space: string;
    externalId: string;
    version: string;
  }) => void;
  onVersionChange: (version: string) => void;
  onGraphqlQueryChange: (query: string) => void;
  onValueTypeChange: (value: SelectableValue<string>) => void;
  onDisplayFieldChange: (value?: string) => void;
}

const VALUE_TOOLTIP_BASE = 'The field read from each result row and used as the variable value.';

export const GraphqlVariableTab = ({
  datasource,
  graphqlQuery,
  dataModel,
  valueType,
  displayField,
  valueFieldOptions,
  displayFieldOptions,
  canEmitInstanceRef,
  queryError,
  onDataModelChange,
  onVersionChange,
  onGraphqlQueryChange,
  onValueTypeChange,
  onDisplayFieldChange,
}: GraphqlVariableTabProps) => {
  const emitsInstanceRefs = valueType?.value === INSTANCE_ID_FIELD;

  return (
    <EditorRows>
      <GraphqlQueryEditor
        datasource={datasource}
        refId={VARIABLE_REF_ID}
        dataModel={dataModel}
        graphqlQuery={graphqlQuery}
        queryError={queryError}
        onDataModelChange={onDataModelChange}
        onVersionChange={onVersionChange}
        onQueryChange={onGraphqlQueryChange}
        headerActions={
          <GraphqlExamplesModal
            title="GraphQL variable examples"
            examples={VARIABLE_GRAPHQL_EXAMPLES}
          />
        }
      />

      <EditorRow>
        <EditorFieldGroup>
          <EditorField
            label="Value"
            tooltip={
              canEmitInstanceRef
                ? `${VALUE_TOOLTIP_BASE} Instance ID emits the whole reference, for filtering on a direct relation.`
                : `${VALUE_TOOLTIP_BASE} Select both space and externalId in the query to unlock the Instance ID option.`
            }
          >
            <Select
              inputId="graphql-variable-value-field"
              width={32}
              options={valueFieldOptions}
              value={valueType ?? null}
              placeholder="Select a field"
              onChange={onValueTypeChange}
            />
          </EditorField>
          <EditorField
            label="Display text"
            optional
            tooltip="The field shown in the variable picker, when it should differ from the value."
          >
            <Select
              inputId="graphql-variable-display-field"
              width={32}
              isClearable
              options={displayFieldOptions}
              value={displayFieldOptions.find((option) => option.value === displayField) ?? null}
              placeholder="Auto (same as value)"
              onChange={(option) => onDisplayFieldChange(option?.value)}
            />
          </EditorField>
        </EditorFieldGroup>
        <FlexItem grow={1} />
        {/* Stack centres its children, so the badge keeps its own height instead of
            stretching to fill the editor row. */}
        <Stack gap={1} alignItems="center">
          {emitsInstanceRefs && (
            <Badge
              color="blue"
              icon="link"
              text="Emits instance references"
              tooltip={`Each value is emitted as ${INSTANCE_REF_HINT}, which can be used to match against a direct relation filter.`}
            />
          )}
        </Stack>
      </EditorRow>
    </EditorRows>
  );
};
