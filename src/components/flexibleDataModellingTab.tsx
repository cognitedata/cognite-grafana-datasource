import { AsyncSelect, CodeEditor, Field, HorizontalGroup, Select } from '@grafana/ui';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import _ from 'lodash';
import { getFirstSelection } from '../utils';
import { FlexibleDataModellingQuery, SelectedProps, EditorProps } from '../types';
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
    () => _.get(allOptions, flexibleDataModellingQuery.externalId),
    [flexibleDataModellingQuery.externalId, allOptions]
  );
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
      .listFlexibleDataModelling(query.refId)
      .then((items) => {
        const values = [];
        const all = {};
        const names = {};
        const {
          listApis: { edges },
        } = items;
        _.map(edges, ({ node: { externalId, versions, name } }) => {
          const collector = [];
          _.map(versions, ({ version }) => {
            collector.push({ label: `${version}`, value: version });
          });
          _.assignIn(all, { [externalId]: collector });
          values.push({ value: externalId, label: name });
          _.assignIn(names, { [externalId]: name });
        });
        setAllOptions(all);
        setNames(names);
        return _.sortBy(values, ['label']);
      });
  }, [datasource]);
  useEffect(() => {
    onQueryChange({
      flexibleDataModellingQuery,
    });
  }, [flexibleDataModellingQuery]);
  const firstSelection = useMemo(
    (graphQlQuery = flexibleDataModellingQuery.graphQlQuery) =>
      getFirstSelection(graphQlQuery, query.refId),
    [flexibleDataModellingQuery.graphQlQuery]
  );
  useEffect(() => {
    patchFlexibleDataModellingQuery({
      tsKeys: firstSelection.length
        ? _.uniq(
            _.filter(
              _.map(getNodeSelection(firstSelection), ({ selectionSet, name: { value } }) => {
                if (selectionSet) {
                  const i = _.find(
                    selectionSet.selections,
                    ({ name: { value } }) => value === '__typename'
                  );
                  if (i) {
                    return value;
                  }
                }
                return undefined;
              })
            )
          )
        : [],
    });
  }, [flexibleDataModellingQuery.graphQlQuery, firstSelection]);
  const updateGraphQuery = useCallback(
    (graphQlQuery) => {
      if (firstSelection.length) {
        patchFlexibleDataModellingQuery({ graphQlQuery });
      }
    },
    [firstSelection]
  );
  return (
    <>
      <HorizontalGroup>
        <Field label="Data Model">
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
        <Field label="Version">
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
          onBlur={updateGraphQuery}
          onSave={updateGraphQuery}
          showMiniMap={false}
          showLineNumbers
        />
      </Field>
      {flexibleDataModellingQuery.tsKeys?.length > 0 && (
        <CommonEditors {...{ onQueryChange, query, visible: true }} />
      )}
    </>
  );
};
