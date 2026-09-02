import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Tab, TabsBar, TabContent } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import {
  DEFAULT_GRAPHQL_DATA_MODEL,
  DEFAULT_GRAPHQL_VARIABLE_QUERY,
  VariableQueryData,
  VariableQueryProps,
} from '../types';
import { parse } from '../parser/events-assets';
import { VARIABLE_REF_ID } from '../constants';
import { INSTANCE_ID_FIELD } from '../cdf/instanceRef';
import { AssetsVariableTab } from './variables/AssetsVariableTab';
import { GraphqlVariableTab } from './variables/GraphqlVariableTab';
import {
  VariableQueryProblem,
  buildDisplayFieldOptions,
  buildPersistedVariableQuery,
  buildValueFieldOptions,
  canEmitInstanceRef,
} from './variables/graphqlFields';
import { extractFieldNamesFromQuery } from './graphql/graphqlFields';

type QueryType = 'assets' | 'graphql';

const DEFAULT_ASSETS_VALUE_TYPE: SelectableValue<string> = { value: 'id', label: 'Id' };
const DEFAULT_GRAPHQL_VALUE_TYPE: SelectableValue<string> = {
  value: 'externalId',
  label: 'externalId',
};

/** A saved query that the assets path would execute, whatever the datasource now allows. */
const isSavedAssetsQuery = (query: string | VariableQueryData): boolean => {
  if (typeof query === 'string') {
    return query.trim().length > 0;
  }
  if (query?.queryType === 'graphql') {
    // Parked by the GraphQL tab; the variable still has an asset query to come back to.
    return !!query.assetsQuery?.trim();
  }
  return !!query?.query?.trim();
};

/** The asset expression, wherever the saved shape parked it. */
const savedAssetsQuery = (saved: VariableQueryData): string =>
  (saved.queryType === 'graphql' ? saved.assetsQuery : saved.query) ?? '';

const normalize = (query: string | VariableQueryData): VariableQueryData =>
  typeof query === 'string' ? { query } : { ...query };

/** What to show when a state cannot be saved, so a refusal is never silent. */
const describeProblem = (problem: VariableQueryProblem): string | undefined => {
  switch (problem.reason) {
    case 'invalid-assets':
      return problem.message;
    case 'invalid-graphql':
      return `Not saved: ${problem.message}`;
    case 'incomplete-graphql':
      return 'Select a data model and version, and enter a query, to save this variable.';
    // Merely opening the Assets tab is not an error worth reporting.
    case 'empty-assets':
    default:
      return undefined;
  }
};

/** The persisted shape needs both halves; a Select can hand back either alone. */
const toPersistedValueType = (
  value?: SelectableValue<string>
): VariableQueryData['valueType'] =>
  value?.value === undefined
    ? undefined
    : { value: value.value, label: value.label ?? value.value };

export const CogniteVariableQueryEditor = ({
  query,
  onChange,
  datasource,
}: VariableQueryProps) => {
  const saved = useMemo(() => normalize(query), [query]);
  const legacyEnabled = !!datasource?.connector?.isLegacyDataModelFeaturesEnabled?.();
  const graphqlEnabled = !!datasource?.connector?.isFlexibleDataModellingEnabled?.();
  // Each tab follows its feature flag, as the panel tabs do. A saved variable keeps
  // its tab even after an admin turns the feature off, so an existing dashboard
  // never looks like it lost its configuration.
  const showAssetsTab = legacyEnabled || isSavedAssetsQuery(query);
  const showGraphqlTab = graphqlEnabled || saved.queryType === 'graphql';

  const initialQueryType: QueryType =
    saved.queryType === 'graphql' || !showAssetsTab ? 'graphql' : 'assets';

  const [queryType, setQueryType] = useState<QueryType>(initialQueryType);
  const [assetsQuery, setAssetsQuery] = useState(savedAssetsQuery(saved));
  const [graphqlQuery, setGraphqlQuery] = useState(saved.graphqlQuery ?? DEFAULT_GRAPHQL_VARIABLE_QUERY);
  // Nothing configured yet means the core data model, so the editor opens on a query
  // that runs. An empty-string model from an older save counts as unconfigured.
  const hasSavedDataModel = !!(
    saved.dataModel?.space &&
    saved.dataModel?.externalId &&
    saved.dataModel?.version
  );
  const [dataModel, setDataModel] = useState(
    hasSavedDataModel ? saved.dataModel! : DEFAULT_GRAPHQL_DATA_MODEL
  );
  const [valueType, setValueType] = useState<SelectableValue<string> | undefined>(
    saved.valueType ??
      (initialQueryType === 'graphql' ? DEFAULT_GRAPHQL_VALUE_TYPE : DEFAULT_ASSETS_VALUE_TYPE)
  );
  const [displayField, setDisplayField] = useState(saved.displayField);
  const [error, setError] = useState<string>();

  /**
   * Persists whatever is currently valid, and says why when it is not.
   *
   * An incomplete edit is never written: the previously working definition stays
   * untouched rather than being cleared. Silence would look identical to a save, so
   * the refusal is reported back to the editor.
   */
  const commit = useCallback(
    (patch: Partial<VariableQueryData> = {}) => {
      const nextType = patch.queryType ?? queryType;
      const next: VariableQueryData = {
        // Whichever tab is active owns `query`; the other tab's text rides along.
        query: nextType === 'graphql' ? graphqlQuery : assetsQuery,
        assetsQuery,
        valueType: toPersistedValueType(valueType),
        queryType: nextType,
        graphqlQuery,
        dataModel,
        displayField,
        ...patch,
      };
      const { value, problem } = buildPersistedVariableQuery(next, (expression) =>
        parse(datasource.replaceVariable(expression))
      );
      if (problem) {
        setError(describeProblem(problem));
        return;
      }
      setError(undefined);
      onChange(value);
    },
    [
      assetsQuery,
      valueType,
      queryType,
      graphqlQuery,
      dataModel,
      displayField,
      onChange,
      datasource,
    ]
  );

  /**
   * A brand new variable saves its defaults once, so the query shown on open is also
   * the one that runs. Guarded down to genuinely empty variables: anything already
   * saved is left exactly as it is.
   */
  const seeded = useRef(false);
  useEffect(() => {
    // Both halves are defaulted, so both must be missing for the defaults to be the
    // whole truth. Seeding over a half-saved variable would display a model it never
    // persisted.
    if (
      seeded.current ||
      !showGraphqlTab ||
      initialQueryType !== 'graphql' ||
      saved.graphqlQuery ||
      hasSavedDataModel
    ) {
      return;
    }
    seeded.current = true;
    commit();
  }, [showGraphqlTab, initialQueryType, saved.graphqlQuery, hasSavedDataModel, commit]);

  const fieldNames = useMemo(() => extractFieldNamesFromQuery(graphqlQuery, VARIABLE_REF_ID), [graphqlQuery]);
  const valueFieldOptions = useMemo(() => buildValueFieldOptions(fieldNames), [fieldNames]);
  const displayFieldOptions = useMemo(() => buildDisplayFieldOptions(fieldNames), [fieldNames]);

  // A display field the query no longer selects would keep being saved while the
  // control reads "Auto", so it is cleared as soon as the query drops it. Only once
  // the query parses: an unparseable edit offers no fields at all.
  useEffect(() => {
    if (
      displayField &&
      fieldNames.length &&
      !displayFieldOptions.some((option) => option.value === displayField)
    ) {
      setDisplayField(undefined);
      commit({ displayField: undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayField, fieldNames, displayFieldOptions]);

  const handleAssetsBlur = () => commit();

  const handleGraphqlQueryChange = (next: string) => {
    setGraphqlQuery(next);
    setError(undefined);
    commit({ graphqlQuery: next });
  };

  const handleTabChange = (next: QueryType) => {
    setQueryType(next);
    setError(undefined);
    // `id` means nothing to a GraphQL row and the instance-reference sentinel means
    // nothing to an asset, so a value carried across tabs is replaced by the
    // destination's own default.
    const keepsValueType =
      next === 'graphql'
        ? valueType?.value !== DEFAULT_ASSETS_VALUE_TYPE.value
        : valueType?.value !== INSTANCE_ID_FIELD;
    const nextValueType = keepsValueType
      ? valueType
      : next === 'graphql'
      ? DEFAULT_GRAPHQL_VALUE_TYPE
      : DEFAULT_ASSETS_VALUE_TYPE;
    setValueType(nextValueType);
    commit({ queryType: next, valueType: toPersistedValueType(nextValueType) });
  };

  const handleDataModelChange = (next: {
    space: string;
    externalId: string;
    version: string;
  }) => {
    setDataModel(next);
    commit({ dataModel: next });
  };

  const handleVersionChange = (version: string) => {
    const next = { ...dataModel, version };
    setDataModel(next);
    commit({ dataModel: next });
  };

  const handleValueTypeChange = (value: SelectableValue<string>) => {
    setValueType(value);
    commit({ valueType: toPersistedValueType(value) });
  };

  const handleDisplayFieldChange = (value?: string) => {
    setDisplayField(value);
    commit({ displayField: value });
  };

  if (!showAssetsTab && !showGraphqlTab) {
    return (
      <div className="gf-form">
        <span className="gf-form-label">
          Enable GraphQL or asset-centric features on the data source to define variables.
        </span>
      </div>
    );
  }

  return (
    <div>
      {/* A single available tab is just a heading, so the bar only appears when there
          is actually a choice to make. */}
      {showAssetsTab && showGraphqlTab && (
        <TabsBar>
          <Tab
            label="Assets"
            active={queryType === 'assets'}
            onChangeTab={() => handleTabChange('assets')}
          />
          <Tab
            label="GraphQL"
            active={queryType === 'graphql'}
            onChangeTab={() => handleTabChange('graphql')}
          />
        </TabsBar>
      )}

      <TabContent>
        {queryType === 'assets' ? (
          <AssetsVariableTab
            query={assetsQuery}
            valueType={valueType}
            error={error}
            onQueryChange={(next) => {
              setAssetsQuery(next);
              setError(undefined);
            }}
            onValueTypeChange={handleValueTypeChange}
            onBlur={handleAssetsBlur}
          />
        ) : (
          <GraphqlVariableTab
            datasource={datasource}
            graphqlQuery={graphqlQuery}
            dataModel={dataModel}
            valueType={valueType}
            displayField={displayField}
            valueFieldOptions={valueFieldOptions}
            displayFieldOptions={displayFieldOptions}
            canEmitInstanceRef={canEmitInstanceRef(fieldNames)}
            queryError={error}
            onDataModelChange={handleDataModelChange}
            onVersionChange={handleVersionChange}
            onGraphqlQueryChange={handleGraphqlQueryChange}
            onValueTypeChange={handleValueTypeChange}
            onDisplayFieldChange={handleDisplayFieldChange}
          />
        )}
      </TabContent>
    </div>
  );
};
