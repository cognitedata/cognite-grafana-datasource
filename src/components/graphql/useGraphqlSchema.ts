import { useEffect, useState } from 'react';
import { buildClientSchema, GraphQLSchema } from 'graphql';
import CogniteDatasource from '../../datasource';

/**
 * The introspected schema behind the editor's autocomplete.
 *
 * Introspection returns undefined when it fails, which `buildClientSchema` would
 * throw on, so a failure here simply leaves the editor without suggestions.
 */
export const useGraphqlSchema = (
  datasource: CogniteDatasource,
  refId: string,
  space?: string,
  externalId?: string,
  version?: string
): GraphQLSchema | undefined => {
  const [schema, setSchema] = useState<GraphQLSchema>();
  const fdmDatasource = datasource?.flexibleDataModellingDatasource;

  useEffect(() => {
    let cancelled = false;
    if (!fdmDatasource || !space || !externalId || !version) {
      setSchema(undefined);
      return undefined;
    }
    fdmDatasource
      .runIntrospectionQuery({ space, externalId, version }, { refId })
      .then((data) => {
        if (!cancelled) {
          setSchema(data ? buildClientSchema(data) : undefined);
        }
      })
      .catch(() => !cancelled && setSchema(undefined));
    return () => {
      cancelled = true;
    };
  }, [fdmDatasource, refId, space, externalId, version]);

  return schema;
};
