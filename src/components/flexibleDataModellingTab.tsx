import { EditorRows } from '@grafana/plugin-ui';
import React, { useEffect, useMemo, useState } from 'react';
import { GraphQLSchema, parse } from 'graphql';
import { isEqual } from 'lodash';
import { getFirstSelection, typeNameList } from '../utils';
import { timeSeriesKeysFromSchema } from '../cdf/graphqlTimeSeries';
import { FlexibleDataModellingQuery, SelectedProps } from '../types';
import CogniteDatasource from '../datasource';
import { GraphqlQueryEditor } from './graphql/GraphqlQueryEditor';
import { GraphqlExamplesModal } from './graphql/GraphqlExamplesModal';
import { PANEL_GRAPHQL_EXAMPLES } from './graphql/graphqlExamples';
import { FlexibleDataModellingOptions } from './graphql/FlexibleDataModellingOptions';
import { extractFieldNamesFromQuery, leafFieldNames } from './graphql/graphqlFields';

export const FlexibleDataModellingTab = (props: SelectedProps & { datasource: CogniteDatasource }) => {
  const { query, onQueryChange, datasource } = props;
  const { flexibleDataModellingQuery } = query;
  const { externalId, space, version, graphQlQuery } = flexibleDataModellingQuery;
  const [schema, setSchema] = useState<GraphQLSchema>();
  const [queryError, setQueryError] = useState<string>();

  const firstSelection = useMemo(
    () => getFirstSelection(graphQlQuery, query.refId),
    [graphQlQuery, query.refId]
  );

  // Named in the Label tooltip, so the tokens that will actually resolve are visible
  // without having to re-read the query.
  const labelFields = useMemo(
    () => leafFieldNames(extractFieldNamesFromQuery(graphQlQuery ?? '', query.refId)),
    [graphQlQuery, query.refId]
  );

  const patchFlexibleDataModellingQuery = (
    flexibleDataModellingQueryPatch: Partial<FlexibleDataModellingQuery>
  ) => {
    onQueryChange({
      flexibleDataModellingQuery: {
        ...flexibleDataModellingQuery,
        ...flexibleDataModellingQueryPatch,
      },
    });
  };

  // Text the parser rejects is not saved, so the panel keeps running its last valid
  // query. That has to be said next to the editor: the text on screen and the
  // query being run have just diverged.
  const updateGraphQuery = (newQuery: string) => {
    try {
      parse(newQuery);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setQueryError(`Not saved: ${message} The panel still runs the last valid query.`);
      return;
    }
    setQueryError(undefined);
    patchFlexibleDataModellingQuery({ graphQlQuery: newQuery });
  };

  // Which selections hold time series. The schema is the authority when it has
  // loaded; the query-shape heuristics (`type` selected, legacy `__typename`) stay
  // in as fallbacks for saved queries and models the schema cannot vouch for. The
  // two are kept apart so the shape heuristics never pass for schema-vouched.
  useEffect(() => {
    const patch: Partial<FlexibleDataModellingQuery> = {};
    const tsKeys = firstSelection.length ? typeNameList(firstSelection) : [];
    if (!isEqual(tsKeys, flexibleDataModellingQuery.tsKeys ?? [])) {
      patch.tsKeys = tsKeys;
    }
    // While the schema is still loading the saved keys stand, so reopening a
    // panel does not briefly drop its series and fetch them again.
    if (schema) {
      const schemaTsKeys = timeSeriesKeysFromSchema(schema, graphQlQuery ?? '');
      if (!isEqual(schemaTsKeys, flexibleDataModellingQuery.schemaTsKeys ?? [])) {
        patch.schemaTsKeys = schemaTsKeys;
      }
    }
    if (Object.keys(patch).length) {
      patchFlexibleDataModellingQuery(patch);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphQlQuery, firstSelection, schema]);

  const hasTimeSeries =
    (flexibleDataModellingQuery.tsKeys?.length ?? 0) > 0 ||
    (flexibleDataModellingQuery.schemaTsKeys?.length ?? 0) > 0;

  return (
    <EditorRows>
      <GraphqlQueryEditor
        datasource={datasource}
        refId={query.refId}
        dataModel={{ space, externalId, version }}
        graphqlQuery={graphQlQuery ?? ''}
        onDataModelChange={(dataModel) => patchFlexibleDataModellingQuery(dataModel)}
        onVersionChange={(nextVersion) =>
          patchFlexibleDataModellingQuery({ version: nextVersion })
        }
        onQueryChange={updateGraphQuery}
        queryError={queryError}
        onSchemaChange={setSchema}
        headerActions={
          <GraphqlExamplesModal title="GraphQL query examples" examples={PANEL_GRAPHQL_EXAMPLES} />
        }
      />
      {/* Only meaningful once the query yields series to aggregate and name. */}
      {hasTimeSeries && (
        <FlexibleDataModellingOptions
          query={query}
          label={flexibleDataModellingQuery.label}
          labelFields={labelFields}
          onQueryChange={onQueryChange}
          onLabelChange={(label) => patchFlexibleDataModellingQuery({ label })}
        />
      )}
    </EditorRows>
  );
};
