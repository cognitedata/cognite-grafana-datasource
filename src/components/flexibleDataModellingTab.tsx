import { AsyncSelect, CodeEditor, Field, HorizontalGroup, Select } from '@grafana/ui';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import _ from 'lodash';
import { FDMResponseToDropdown, getFirstSelection, reverseSort, typeNameList } from '../utils';
import { FlexibleDataModellingQuery, SelectedProps, EditorProps } from '../types';
import CogniteDatasource from '../datasource';
import { CommonEditors } from './commonEditors';

export const FlexibleDataModellingTab = (
  props: SelectedProps & Pick<EditorProps, 'onRunQuery'> & { datasource: CogniteDatasource }
) => {
  const { query, onQueryChange, datasource } = props;
  const [flexibleDataModellingQuery, setFlexibleDataModellingQuery] = useState(
    query.flexibleDataModellingQuery
  );
  const [allOptions, setAllOptions] = useState({});
  const [dataModelOptions, setDataModelOptions] = useState([]);
  const [names, setNames] = useState({});
  const versionOptions = useMemo(
    () => _.get(allOptions, flexibleDataModellingQuery.externalId),
    [flexibleDataModellingQuery.externalId, allOptions]
  );
  const patchFlexibleDataModellingQuery = useCallback(
    (flexibleDataModellingQueryPatch: Partial<FlexibleDataModellingQuery>) => {
      setFlexibleDataModellingQuery({
        ...flexibleDataModellingQuery,
        ...flexibleDataModellingQueryPatch,
      });
    },
    [flexibleDataModellingQuery]
  );
  const loadFlexibleDataModellingOptions = () => {
    return datasource.flexibleDataModellingDatasource
      .listFlexibleDataModelling(query.refId)
      .then((items) => {
        const {
          listApis: { edges },
        } = items;
        const { all, names, dataModelOptions } = FDMResponseToDropdown(edges);
        setAllOptions(all);
        setNames(names);
        setDataModelOptions(dataModelOptions);
        return dataModelOptions;
      });
  };
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
      tsKeys: firstSelection.length ? typeNameList(firstSelection) : [],
    });
  }, [flexibleDataModellingQuery.graphQlQuery, firstSelection]);
  const updateGraphQuery = useCallback(
    (graphQlQuery) => {
      console.log(
        'dataModelOptions: ',
        dataModelOptions,
        '\nfirstSelection: ',
        firstSelection,
        '\nnames: ',
        names,
        '\nextr: ',
        flexibleDataModellingQuery.externalId,
        '\ntsKeys: ',
        flexibleDataModellingQuery.tsKeys,
        '\nversion: ',
        flexibleDataModellingQuery.version
      );
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
          />
        </Field>
        <Field label="Version">
          <Select
            options={reverseSort(versionOptions)}
            value={{
              label: flexibleDataModellingQuery.version?.toString(),
              value: flexibleDataModellingQuery.version,
            }}
            onChange={(version) => patchFlexibleDataModellingQuery({ version: version.value })}
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
