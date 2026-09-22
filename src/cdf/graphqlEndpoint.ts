/**
 * The GraphQL endpoint of one data model version.
 *
 * Built in one place so the panel query, the variable query and the editor preview
 * cannot drift onto different URLs.
 */
export function graphqlEndpointPath(dataModel: {
  space?: string;
  externalId?: string;
  version?: string;
}): string {
  const [space, externalId, version] = [dataModel.space, dataModel.externalId, dataModel.version].map(
    (segment) => encodeURIComponent(segment ?? '')
  );
  return `/userapis/spaces/${space}/datamodels/${externalId}/versions/${version}/graphql`;
}
