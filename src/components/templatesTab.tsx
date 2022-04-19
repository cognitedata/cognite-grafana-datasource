import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Select, AsyncSelect, Field, Input, HorizontalGroup } from '@grafana/ui';
import { QueryEditorProps, SelectableValue } from '@grafana/data';
import CodeMirror from 'codemirror';
import CogniteDatasource from '../datasource';
import {
  CogniteDataSourceOptions,
  CogniteQuery,
  CogniteTargetObj,
  CogniteQueryBase,
  TemplateQuery,
} from '../types';
import '../css/query_editor.css';
import '../css/templates.css';
import '../css/common.css';
import 'codemirror/lib/codemirror.css';
import '../css/dracula.css';
import 'codemirror/addon/hint/show-hint';
import 'codemirror/addon/lint/lint';
import 'codemirror-graphql/hint';
import 'codemirror-graphql/lint';
import 'codemirror-graphql/mode';

type EditorProps = QueryEditorProps<CogniteDatasource, CogniteQuery, CogniteDataSourceOptions>;
type OnQueryChange = (
  patch: Partial<CogniteQueryBase> | CogniteTargetObj,
  shouldRunQuery?: boolean
) => void;
type SelectedProps = Pick<EditorProps, 'query'> & { onQueryChange: OnQueryChange };

export function TemplatesTab(
  props: SelectedProps & Pick<EditorProps, 'onRunQuery'> & { datasource: CogniteDatasource }
) {
  const { query, onQueryChange, datasource } = props;
  const [templateQuery, setTemplateQuery] = useState(query.templateQuery);
  const [versionOptions, setVersionOptions] = useState([]);
  const [editor, setEditor] = useState<CodeMirror.EditorFromTextArea | null>(null);
  const textAreaRef = useRef(null);

  const patchTemplateQuery = useCallback(
    (templateQueryPatch: Partial<TemplateQuery>) => {
      setTemplateQuery({ ...templateQuery, ...templateQueryPatch });
    },
    [templateQuery]
  );

  const triggerQuery = useCallback(() => {
    onQueryChange({
      templateQuery,
    });
  }, [templateQuery, onQueryChange]);

  useEffect(() => {
    if (textAreaRef.current) {
      const editor = CodeMirror.fromTextArea(textAreaRef.current, {
        mode: 'graphql',
        theme: 'dracula',
        /* lint: {
          schema: myGraphQLSchema,
          validationRules: [ExampleRule],
        },
        hintOptions: {
          schema: myGraphQLSchema,
        }, */
      });
      setEditor(editor);
      editor.getDoc().setValue(templateQuery.graphQlQuery);
    }
  }, [textAreaRef]);

  useEffect(() => {
    if (editor != null) {
      const handleChange = () => {
        patchTemplateQuery({ graphQlQuery: editor.getDoc().getValue() });
      };

      const handleBlur = () => {
        triggerQuery();
      };

      editor.getDoc().on('change', handleChange);
      editor.on('blur', handleBlur);
      return () => {
        editor.getDoc().off('change', handleChange);
        editor.off('blur', handleBlur);
      };
    }

    return undefined;
  }, [editor, patchTemplateQuery, triggerQuery]);

  const updateTemplateGroup = useCallback(
    (selectableValue: SelectableValue<string>) => {
      const externalId = selectableValue.value;
      patchTemplateQuery({ groupExternalId: externalId });

      datasource.templatesDatasource.listTemplateGroupVersions(externalId).then((versions) =>
        setVersionOptions(
          versions.map((templateVersion) => ({
            label: templateVersion.version.toString(),
            value: templateVersion.version,
          }))
        )
      );
    },
    [patchTemplateQuery, datasource]
  );

  const loadTemplateGroupsOptions = useCallback(() => {
    return datasource.templatesDatasource
      .listTemplatesGroups()
      .then((items) => items.map((item) => ({ label: item.externalId, value: item.externalId })));
  }, [datasource]);

  return (
    <>
      <HorizontalGroup>
        <Field label="Template Group" description="Select template group">
          <AsyncSelect
            loadOptions={loadTemplateGroupsOptions}
            defaultOptions
            value={{ label: templateQuery.groupExternalId, value: templateQuery.groupExternalId }}
            onChange={updateTemplateGroup}
            onBlur={triggerQuery}
          />
        </Field>
        <Field label="Version" description="Select template group version">
          <Select
            options={versionOptions}
            value={{ label: templateQuery.version?.toString(), value: templateQuery.version }}
            onChange={(version) => patchTemplateQuery({ version: version.value })}
            onBlur={triggerQuery}
          />
        </Field>
      </HorizontalGroup>
      <Field label="Query" description="GraphQL query">
        <textarea ref={textAreaRef} name="graphQlQuery" />
      </Field>
      <HorizontalGroup>
        <Field label="Data Path" description="Path to the data">
          <Input
            value={templateQuery.dataPath}
            onChange={(value) => patchTemplateQuery({ dataPath: (value.target as any).value })}
            onBlur={triggerQuery}
          />
        </Field>
        <Field label="Group by" description="Property to group by">
          <Input
            value={templateQuery.groupBy}
            onChange={(value) => patchTemplateQuery({ groupBy: (value.target as any).value })}
            onBlur={triggerQuery}
          />
        </Field>
        <Field label="Datapoints Path" description="Path to the datapoints">
          <Input
            value={templateQuery.datapointsPath}
            onChange={(value) =>
              patchTemplateQuery({ datapointsPath: (value.target as any).value })
            }
            onBlur={triggerQuery}
          />
        </Field>
      </HorizontalGroup>
    </>
  );
}
