import { useCallback, useEffect, useRef, useState } from 'react';
import CogniteDatasource from '../../datasource';
import { formatGraphqlErrors } from '../../cdf/graphqlVariables';
import { GraphqlDataModelRef } from './useGraphqlDataModels';

export interface GraphqlResponseState {
  body?: string;
  error?: string;
}

interface UseGraphqlPreview {
  response?: GraphqlResponseState;
  isRunning: boolean;
  canRun: boolean;
  run: () => Promise<void>;
}

/**
 * Runs the query as the panel or variable will run it -- same endpoint, same
 * interpolation -- and keeps the untouched response for display. Nothing here
 * touches the saved query.
 */
export const useGraphqlPreview = (
  datasource: CogniteDatasource,
  graphqlQuery: string,
  dataModel: GraphqlDataModelRef
): UseGraphqlPreview => {
  const [response, setResponse] = useState<GraphqlResponseState>();
  const [isRunning, setIsRunning] = useState(false);
  // Runs resolve in completion order, not click order, and can outlive the editor.
  // Only the latest run is allowed to report.
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
    },
    []
  );

  const { space, externalId, version } = dataModel ?? {};
  const canRun = !!(graphqlQuery && space && externalId && version);

  const run = useCallback(async () => {
    if (!graphqlQuery || !space || !externalId || !version) {
      return;
    }
    const mine = ++generation.current;
    const isCurrent = () => generation.current === mine;
    setIsRunning(true);
    try {
      const { data, errors } = await datasource.runGraphqlQuery({
        graphqlQuery,
        dataModel: { space, externalId, version },
      });
      if (!isCurrent()) {
        return;
      }
      // GraphQL reports query errors in a 200 body, so they are read from the
      // response rather than caught below.
      setResponse(
        errors
          ? { error: formatGraphqlErrors(errors) }
          : { body: JSON.stringify(data, null, 2) }
      );
    } catch (err) {
      if (isCurrent()) {
        setResponse({ error: err instanceof Error ? err.message : String(err) });
      }
    } finally {
      if (isCurrent()) {
        setIsRunning(false);
      }
    }
  }, [datasource, graphqlQuery, space, externalId, version]);

  return { response, isRunning, canRun, run };
};
