import { QueryEditorProps } from '@grafana/data';
import { AsyncSelect, CodeEditor, Field, HorizontalGroup, Select } from '@grafana/ui';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import _, { assignIn, get, map } from 'lodash';
import { ExecutableDefinitionNode } from 'graphql';
import gql from 'graphql-tag';
import {
  CogniteDataSourceOptions,
  CogniteQuery,
  CogniteTargetObj,
  CogniteQueryBase,
  FlexibleDataModellingQuery,
} from '../types';
import CogniteDatasource from '../datasource';
import { CommonEditors } from './commonEditors';

const getNodeSelection = (selection) => {
  const { selectionSet } = selection[0];
  if (selectionSet) {
    const { selections } = selectionSet;
    if (selection[0].name.value === 'node') {
      return selections;
    }
    return getNodeSelection(selections);
  }
  return [];
};
type EditorProps = QueryEditorProps<CogniteDatasource, CogniteQuery, CogniteDataSourceOptions>;
type OnQueryChange = (
  patch: Partial<CogniteQueryBase> | CogniteTargetObj,
  shouldRunQuery?: boolean
) => void;
type SelectedProps = Pick<EditorProps, 'query'> & { onQueryChange: OnQueryChange };

export const FlexibleDataModellingTab = (
  props: SelectedProps & Pick<EditorProps, 'onRunQuery'> & { datasource: CogniteDatasource }
) => {
  const { query, onQueryChange, datasource } = props;
  const [flexibleDataModellingQuery, setflexibleDataModellingQuery] = useState(
    query.flexibleDataModellingQuery
  );
  const [allOptions, setAllOptions] = useState({});
  const [names, setNames] = useState({});
  const versionOptions = useMemo(
    () => get(allOptions, flexibleDataModellingQuery.externalId),
    [flexibleDataModellingQuery.externalId, allOptions]
  );
  const [error, setError] = useState(undefined);
  const patchFlexibleDataModellingQuery = useCallback(
    (flexibleDataModellingQueryPatch: Partial<FlexibleDataModellingQuery>) => {
      setflexibleDataModellingQuery({
        ...flexibleDataModellingQuery,
        ...flexibleDataModellingQueryPatch,
      });
    },
    [flexibleDataModellingQuery]
  );
  const triggerQuery = useCallback(() => {
    onQueryChange({
      flexibleDataModellingQuery,
    });
  }, [flexibleDataModellingQuery, onQueryChange]);

  const loadFlexibleDataModellingOptions = useCallback(() => {
    return datasource.flexibleDataModellingDatasource
      .listFlexibleDataModelling()
      .then((items) => {
        const values = [];
        const all = {};
        const names = {};
        const { edges } = items;
        map(edges, ({ node: { externalId, versions, name } }) => {
          const collector = [];
          map(versions, ({ version }) => {
            collector.push({ label: `${version}`, value: version });
          });
          assignIn(all, { [externalId]: collector });
          values.push({ value: externalId, label: name });
          _.assignIn(names, { [externalId]: name });
        });
        setAllOptions(all);
        setNames(names);
        setError(undefined);
        return _.sortBy(values, ['label']);
      })
      .catch((e) => {
        setError(e.data.error.message);
        return [];
      });
  }, [datasource]);
  useEffect(() => {
    onQueryChange({
      flexibleDataModellingQuery,
    });
  }, [flexibleDataModellingQuery]);

  const checkGraphQuery = (graph) => {
    try {
      const g = gql`
        ${graph}
      `;
      setError(undefined);
      return g;
    } catch (e) {
      setError(JSON.stringify(e));
      return false;
    }
  };

  useEffect(() => {
    const gQuery = checkGraphQuery(flexibleDataModellingQuery.graphQlQuery);
    const tsKeys = [];
    if (gQuery) {
      const { selectionSet } = gQuery.definitions[0] as ExecutableDefinitionNode;
      _.map(getNodeSelection(selectionSet?.selections), ({ selectionSet, name: { value } }) => {
        if (selectionSet) {
          const i = _.find(
            selectionSet.selections,
            ({ name: { value } }) => value === '__typename'
          );
          if (i && !tsKeys.includes(value)) {
            tsKeys.push(value);
          }
        }
        return tsKeys;
      });
    }
    patchFlexibleDataModellingQuery({ tsKeys });
  }, [flexibleDataModellingQuery.graphQlQuery]);
  return (
    <>
      <HorizontalGroup>
        <Field label="Flexible Data Modelling" description="Select Flexible Data Modelling">
          <AsyncSelect
            loadOptions={loadFlexibleDataModellingOptions}
            defaultOptions
            value={{
              label:
                names[flexibleDataModellingQuery.externalId] ||
                flexibleDataModellingQuery.externalId,
              value: flexibleDataModellingQuery.externalId,
            }}
            onChange={(externalId) => {
              patchFlexibleDataModellingQuery({ externalId: externalId.value, version: undefined });
            }}
            onBlur={triggerQuery}
          />
        </Field>
        <Field label="Version" description="Select Flexible Data Modelling version">
          <Select
            options={_.sortBy(versionOptions).reverse()}
            value={{
              label: flexibleDataModellingQuery.version?.toString(),
              value: flexibleDataModellingQuery.version,
            }}
            onChange={(version) => patchFlexibleDataModellingQuery({ version: version.value })}
            onBlur={triggerQuery}
          />
        </Field>
      </HorizontalGroup>
      <Field label="Query" description="GraphQL query">
        <CodeEditor
          value={flexibleDataModellingQuery.graphQlQuery ?? ''}
          language="graphql"
          height={400}
          onBlur={(graphQlQuery) =>
            checkGraphQuery(graphQlQuery) && patchFlexibleDataModellingQuery({ graphQlQuery })
          }
          onSave={(graphQlQuery) =>
            checkGraphQuery(graphQlQuery) && patchFlexibleDataModellingQuery({ graphQlQuery })
          }
          showMiniMap={false}
          showLineNumbers
        />
      </Field>
      {flexibleDataModellingQuery.tsKeys?.length > 0 && (
        <CommonEditors {...{ onQueryChange, query, visible: true }} />
      )}
      {error && <pre className="gf-formatted-error">{error}</pre>}
    </>
  );
};
