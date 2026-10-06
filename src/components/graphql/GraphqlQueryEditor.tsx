import React, { useCallback, useEffect, useState } from 'react';
import { css } from '@emotion/css';
import { GraphQLSchema, parse } from 'graphql';
import { GrafanaTheme2 } from '@grafana/data';
import { EditorField, EditorFieldGroup, EditorRow, FlexItem } from '@grafana/plugin-ui';
import {
  Button,
  CodeEditor,
  FieldValidationMessage,
  MonacoEditor,
  Select,
  Stack,
  useStyles2,
} from '@grafana/ui';
import CogniteDatasource from '../../datasource';
import { getGraphqlSuggestions } from '../graphqlAutocomplete';
import { GraphqlResponsePane } from './GraphqlResponsePane';
import {
  DataModelOption,
  GraphqlDataModelRef,
  useGraphqlDataModels,
  VersionOption,
} from './useGraphqlDataModels';
import { useGraphqlSchema } from './useGraphqlSchema';
import { useGraphqlPreview } from './useGraphqlPreview';

/** Tall enough to hold a typical query without scrolling. */
const GRAPHQL_EDITOR_HEIGHT = 320;

const getStyles = (theme: GrafanaTheme2) => ({
  // Query and response side by side, each taking half the row.
  panes: css({
    display: 'flex',
    gap: theme.spacing(1),
    width: '100%',
  }),
  pane: css({
    flex: 1,
    minWidth: 0,
  }),
});

const parses = (query: string): boolean => {
  try {
    parse(query);
    return true;
  } catch {
    return false;
  }
};

interface GraphqlQueryEditorProps {
  datasource: CogniteDatasource;
  /** Identifies the caller in error notifications. */
  refId: string;
  dataModel: GraphqlDataModelRef;
  graphqlQuery: string;
  onDataModelChange: (dataModel: {
    space: string;
    externalId: string;
    version: string;
  }) => void;
  onVersionChange: (version: string) => void;
  onQueryChange: (graphqlQuery: string) => void;
  /** Rendered beside Test query, e.g. an Examples button. */
  headerActions?: React.ReactNode;
  queryError?: string;
  /** The introspected schema, for callers that read the query's types too. */
  onSchemaChange?: (schema: GraphQLSchema | undefined) => void;
}

/**
 * Picking a data model and version, writing a GraphQL query against it, and
 * inspecting what it returns. Shared by the panel query editor and the dashboard
 * variable editor so the two stay in step.
 */
export const GraphqlQueryEditor = ({
  datasource,
  refId,
  dataModel,
  graphqlQuery,
  onDataModelChange,
  onVersionChange,
  onQueryChange,
  headerActions,
  queryError,
  onSchemaChange,
}: GraphqlQueryEditorProps) => {
  const [editor, setEditor] = useState<MonacoEditor>();
  const styles = useStyles2(getStyles);

  const { space, externalId, version } = dataModel ?? {};
  const { dataModelOptions, versions, loadingDataModels, loadingVersions, metadataError } =
    useGraphqlDataModels(datasource, refId, space, externalId);
  const schema = useGraphqlSchema(datasource, refId, space, externalId, version);
  useEffect(() => {
    onSchemaChange?.(schema);
  }, [schema, onSchemaChange]);
  const { response, isRunning, canRun, run } = useGraphqlPreview(
    datasource,
    graphqlQuery,
    dataModel
  );

  const modelSelected = !!(space && externalId);
  // Stable between renders: the code editor re-registers its completion provider
  // whenever this callback changes.
  const getSuggestions = useCallback(() => getGraphqlSuggestions(schema, editor), [schema, editor]);
  /**
   * Tests the text on screen, not only what was last saved. The editor saves on
   * blur, and Monaco reports blur a tick late, so a quick click could otherwise test
   * the previous query. Unsaved text is saved first -- which reports a parse error
   * beside the editor -- and is run only if it parses.
   */
  const handleRun = () => {
    const text = editor?.getValue();
    if (text === undefined || text === graphqlQuery) {
      run();
      return;
    }
    onQueryChange(text);
    if (parses(text)) {
      run(text);
    }
  };

  // While the shown text has not been accepted, a run would test something other
  // than what the panel or variable will execute.
  const runTooltip = queryError
    ? 'Fix the query first.'
    : canRun
    ? 'Test the query and show the response, without saving anything.'
    : 'Select a data model and version first.';

  return (
    <>
      <EditorRow>
        <EditorFieldGroup>
          <EditorField
            label="Data model"
            tooltip="The data model whose GraphQL endpoint this query runs against."
          >
            {/* Data model labels carry a name, an external ID and a space, so they
                need the room; there is plenty of it on this row. */}
            <Select
              inputId={`graphql-data-model-${refId}`}
              width={64}
              isLoading={loadingDataModels}
              options={dataModelOptions}
              value={
                dataModelOptions.find(
                  (option: DataModelOption) =>
                    option.value.space === space && option.value.externalId === externalId
                ) ?? null
              }
              placeholder="Select a data model"
              onChange={(option: DataModelOption) =>
                option?.value &&
                onDataModelChange({
                  space: option.value.space,
                  externalId: option.value.externalId,
                  version: option.value.version,
                })
              }
            />
          </EditorField>
          {/* Wide enough for the placeholder to stay on one line; version strings
              themselves are short. */}
          <EditorField
            label="Version"
            tooltip="The version of the selected data model. Queries run against this version's schema."
          >
            <Select
              inputId={`graphql-version-${refId}`}
              width={24}
              isLoading={loadingVersions}
              disabled={!modelSelected}
              options={versions}
              value={
                versions.find((option: VersionOption) => option.value.version === version) ?? null
              }
              placeholder={modelSelected ? 'Select version' : 'Pick a model first'}
              onChange={(option: VersionOption) =>
                option?.value && onVersionChange(option.value.version)
              }
            />
          </EditorField>
        </EditorFieldGroup>
        <FlexItem grow={1} />
        <Stack gap={1} alignItems="center">
          <Button
            variant="secondary"
            size="sm"
            icon="play"
            disabled={!canRun || isRunning || !!queryError}
            onClick={handleRun}
            tooltip={runTooltip}
          >
            Test query
          </Button>
          {headerActions}
        </Stack>
      </EditorRow>

      {metadataError && (
        <EditorRow>
          <FieldValidationMessage>{metadataError}</FieldValidationMessage>
        </EditorRow>
      )}

      <EditorRow>
        {/* Query and response side by side, so what is being extracted can be checked
            against the shape the query actually returns. */}
        <div className={styles.panes}>
          <div className={styles.pane}>
            <EditorField
              label="Query"
              tooltip="The GraphQL query to run. Dashboard variables are interpolated with $variable or ${variable}."
            >
              <CodeEditor
                value={graphqlQuery}
                language="graphql"
                height={GRAPHQL_EDITOR_HEIGHT}
                onBlur={onQueryChange}
                onSave={onQueryChange}
                onEditorDidMount={setEditor}
                showMiniMap={false}
                showLineNumbers
                monacoOptions={{ scrollBeyondLastLine: false }}
                getSuggestions={getSuggestions}
              />
            </EditorField>
            {queryError && <FieldValidationMessage>{queryError}</FieldValidationMessage>}
          </div>
          <div className={styles.pane}>
            <EditorField
              label="Response"
              tooltip="The response from a test run."
            >
              <GraphqlResponsePane
                response={response}
                isRunning={isRunning}
                height={GRAPHQL_EDITOR_HEIGHT}
              />
            </EditorField>
          </div>
        </div>
      </EditorRow>
    </>
  );
};
