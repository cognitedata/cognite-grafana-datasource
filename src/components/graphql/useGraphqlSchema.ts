import { useEffect, useState } from 'react';
import { buildClientSchema, GraphQLSchema } from 'graphql';
import CogniteDatasource from '../../datasource';
import { errorMessageOf } from '../../queryMessages';

/**
 * The introspected schema behind the editor's autocomplete and its markers, and why
 * it could not be read, for the editor to say so. Without it the editor still works,
 * without suggestions.
 */
export const useGraphqlSchema = (
  datasource: CogniteDatasource,
  refId: string,
  space?: string,
  externalId?: string,
  version?: string
): { schema?: GraphQLSchema; schemaError?: string } => {
  const [schema, setSchema] = useState<GraphQLSchema>();
  const [schemaError, setSchemaError] = useState<string>();
  const fdmDatasource = datasource?.flexibleDataModellingDatasource;

  useEffect(() => {
    let cancelled = false;
    // The previous model's schema goes at once: until the new one arrives, its fields
    // would be suggested, and checked against, for a model that doesn't have them.
    setSchema(undefined);
    setSchemaError(undefined);
    if (!fdmDatasource || !space || !externalId || !version) {
      return undefined;
    }
    fdmDatasource
      .runIntrospectionQuery({ space, externalId, version })
      .then((data) => {
        if (!cancelled) {
          setSchema(buildClientSchema(data));
          setSchemaError(undefined);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setSchema(undefined);
          setSchemaError(`Couldn't read the data model's schema, so there are no suggestions: ${errorMessageOf(error)}`);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [fdmDatasource, refId, space, externalId, version]);

  return { schema, schemaError };
};
