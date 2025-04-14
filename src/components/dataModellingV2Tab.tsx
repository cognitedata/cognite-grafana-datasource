import {
  CodeEditor,
  CodeEditorSuggestionItem,
  CodeEditorSuggestionItemKind,
  Field,
  MonacoEditor,
  Select,
  Stack,
} from '@grafana/ui';
import React, { useState, useEffect, useMemo } from 'react';
import { SelectableValue } from '@grafana/data';
import { buildClientSchema, GraphQLSchema } from 'graphql';
import {
  CompletionItem,
  getAutocompleteSuggestions,
  Position,
  Range as GqlRange,
} from 'graphql-language-service';
import { getFirstSelection, isValidQuery, typeNameList } from '../utils';
import {
  FlexibleDataModellingQuery,
  SelectedProps,
  EditorProps,
  DataModellingV2Query,
} from '../types';
import CogniteDatasource from '../datasource';
import { CommonEditors } from './commonEditors';

export const DataModellingV2Tab = (
  props: SelectedProps & Pick<EditorProps, 'onRunQuery'> & { datasource: CogniteDatasource }
) => {
  const { query, onQueryChange, datasource } = props;
  const [graphQlQueryEditor, setGraphQlQueryEditor] = useState<MonacoEditor>();
  const [postProcessingEditor, setPostProcessingEditor] = useState<MonacoEditor>();
  const { dataModellingV2Query } = query;
  const { externalId, space, version, graphQlQuery, postProcessing } = dataModellingV2Query;
  const [options, setOptions] = useState<
    Array<SelectableValue<{ space: string; externalId: string; version: string; dml: string }>>
  >([]);
  const [versions, setVersions] = useState<
    Array<SelectableValue<{ version: string; dml: string }>>
  >([]);
  const [dml, setDML] = useState<string>('');
  const firstSelection = useMemo(
    () => getFirstSelection(graphQlQuery, query.refId),
    [graphQlQuery, query.refId]
  );
  const patchDataModellingV2Query = (
    flexibleDataModellingQueryPatch: Partial<DataModellingV2Query>
  ) => {
    onQueryChange({
      dataModellingV2Query: {
        ...dataModellingV2Query,
        ...flexibleDataModellingQueryPatch,
      },
    });
  };

  const updateGraphQuery = (newQuery) => {
    if (isValidQuery(newQuery, query.refId)) {
      patchDataModellingV2Query({
        graphQlQuery: newQuery,
      });
    }
  };

  const updatePostProcessing = (newQuery) => {
    patchDataModellingV2Query({
      postProcessing: newQuery,
    });
  };

  useEffect(() => {
    patchDataModellingV2Query({
      tsKeys: firstSelection.length ? typeNameList(firstSelection) : [],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphQlQuery, firstSelection]);

  useEffect(() => {
    datasource.flexibleDataModellingDatasource
      .listFlexibleDataModelling(query.refId)
      .then(({ listGraphQlDmlVersions: { items } }) => {
        setOptions(
          items.map((el) => ({
            label: `${el.name} (${el.externalId}) <${el.space}>`,
            value: {
              space: el.space,
              externalId: el.externalId,
              version: el.version,
              dml: el.graphQlDml,
            },
          }))
        );
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    setVersions([]);
    datasource.flexibleDataModellingDatasource
      .listVersionByExternalIdAndSpace(query.refId, space, externalId)
      .then(({ graphQlDmlVersionsById: { items } }) => {
        setVersions(
          items.map((el) => ({
            label: el.version,
            value: { version: el.version, dml: el.graphQlDml },
          }))
        );
      });
  }, [space, externalId, datasource.flexibleDataModellingDatasource, query.refId]);

  const [schema, setSchema] = useState<GraphQLSchema>();

  useEffect(() => {
    (async () => {
      const data = await datasource.flexibleDataModellingDatasource.runIntrospectionQuery(
        { externalId, space, version },
        query
      );
      setSchema(buildClientSchema(data));
    })();
  }, [externalId, space, version, datasource.flexibleDataModellingDatasource, query]);

  return (
    <>
      <Stack>
        <Field label="Data Model">
          <Select
            options={options}
            value={options.find(
              (el) =>
                el.value.space === dataModellingV2Query.space &&
                el.value.externalId === dataModellingV2Query.externalId
            )}
            onChange={(data) => {
              patchDataModellingV2Query({
                externalId: data.value.externalId,
                space: data.value.space,
                version: data.value.version,
              });
              setDML(data.value.dml);
            }}
            width={24}
          />
        </Field>
        <Field label="Version">
          <Select
            options={versions}
            value={versions.find((el) => el.value.version === dataModellingV2Query.version)}
            onChange={(update) => {
              patchDataModellingV2Query({ version: update.value.version });
              setDML(update.value.dml);
            }}
          />
        </Field>
      </Stack>
      <Field label="Query" description="GraphQL query">
        <CodeEditor
          onEditorDidMount={setGraphQlQueryEditor}
          value={dataModellingV2Query.graphQlQuery ?? ''}
          language="graphql"
          height={200}
          onBlur={updateGraphQuery}
          onSave={updateGraphQuery}
          showMiniMap={false}
          showLineNumbers
          getSuggestions={() => {
            if (schema && graphQlQueryEditor) {
              return getAutocompleteSuggestions(
                schema,
                graphQlQueryEditor.getModel().getValue(),
                new Position(
                  graphQlQueryEditor.getPosition().lineNumber - 1,
                  graphQlQueryEditor.getPosition().column - 1
                )
              ).map((el) => toCompletionItem(el));
            }
            return [];
          }}
        />
      </Field>
      <Field label="Post process">
        <CodeEditor
          onEditorDidMount={setPostProcessingEditor}
          value={dataModellingV2Query.postProcessing}
          language="javascript"
          height={200}
          onBlur={updatePostProcessing}
          onSave={updatePostProcessing}
          showMiniMap={false}
          showLineNumbers
        />
      </Field>
      {dataModellingV2Query.tsKeys?.length > 0 && (
        <CommonEditors {...{ onQueryChange, query, visible: true }} />
      )}
    </>
  );
};

/** Format the text, adds icon and returns in format that monaco graphQlQueryEditor expects */
const toCompletionItem = (entry: CompletionItem, range?: GqlRange): CodeEditorSuggestionItem => {
  const results = {
    label: entry.label,
    insertText: entry.insertText || entry.label,
    insertTextFormat: entry.insertTextFormat,
    sortText: entry.sortText,
    filterText: entry.filterText,
    documentation: entry.documentation,
    detail: entry.detail,
    range: range ? toMonacoRange(range) : undefined,
    kind: CodeEditorSuggestionItemKind.Property,
  };
  if (entry.insertTextFormat) {
    results.insertTextFormat = entry.insertTextFormat;
  }

  return results;
};

const toMonacoRange = (range: GqlRange) => {
  return {
    startLineNumber: range.start.line + 1,
    startColumn: range.start.character + 1,
    endLineNumber: range.end.line + 1,
    endColumn: range.end.character + 1,
  };
};
