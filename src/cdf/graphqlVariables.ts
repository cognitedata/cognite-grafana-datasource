import { TemplateSrv } from "@grafana/runtime";
import { Connector } from "../connector";
import { graphqlEndpointPath } from "./graphqlEndpoint";
import { unwrapGraphqlRows } from "./graphqlRows";
import { interpolateInstanceRefs } from "./graphqlInstanceRefs";
import {
  encodeInstanceRef,
  INSTANCE_ID_FIELD,
  readInstanceRef,
  readPath,
  readScalarPath,
} from "./instanceRef";
import { HttpMethod, MetricDescription } from "../types";

/**
 * Runs a GraphQL query against one data model version and hands back the untouched
 * response.
 *
 * Shared by the variable query, the variable editor's preview and the panel
 * editor's preview, so all three send the same request. The panel's *actual* query
 * goes through `FlexibleDataModellingDatasource`, which interpolates with the
 * panel's scoped variables; this path interpolates dashboard variables only.
 */
export async function runGraphqlQuery(
  connector: Connector,
  templateSrv: TemplateSrv,
  {
    graphqlQuery,
    dataModel,
  }: {
    graphqlQuery: string;
    dataModel: { space: string; externalId: string; version: string };
  },
): Promise<{ data?: any; errors?: any }> {
  return connector.fetchQuery({
    path: graphqlEndpointPath(dataModel),
    method: HttpMethod.POST,
    data: JSON.stringify({
      query: templateSrv.replace(interpolateInstanceRefs(graphqlQuery, templateSrv)),
    }),
  });
}

/** One line out of a GraphQL `errors` array, for a notification or an error pane. */
export const formatGraphqlErrors = (errors: Array<{ message?: string }>): string =>
  errors.map((e) => e?.message).filter(Boolean).join("; ") || JSON.stringify(errors);

/**
 * Resolves a variable's GraphQL query to `{ text, value }` options: one per row,
 * reading `valueType` for the value and `displayField` for the text.
 */
export async function metricFindGraphqlQuery(
  connector: Connector,
  templateSrv: TemplateSrv,
  {
    graphqlQuery,
    dataModel,
    valueType,
    displayField,
  }: {
    graphqlQuery?: string;
    dataModel?: { space?: string; externalId?: string; version?: string };
    valueType?: { value: string; label: string };
    displayField?: string;
  },
): Promise<MetricDescription[]> {
  if (
    !graphqlQuery || !dataModel?.space || !dataModel?.externalId ||
    !dataModel?.version
  ) {
    return [];
  }

  const { data, errors } = await runGraphqlQuery(connector, templateSrv, {
    graphqlQuery,
    dataModel: {
      space: dataModel.space,
      externalId: dataModel.externalId,
      version: dataModel.version,
    },
  });

  if (errors) {
    // Surfaced, not just logged: a variable that silently resolves to nothing is
    // indistinguishable from one whose query returned no rows.
    throw new Error(`GraphQL variable query failed: ${formatGraphqlErrors(errors)}`);
  }

  const items = unwrapGraphqlRows(data);
  const fieldName = valueType?.value || "name";
  return items
    .map((item) => {
      const scalar = (path: string) => readScalarPath(item, path);
      // An explicit display field wins; unset, the picker text is the value
      // itself, so what the user sees is exactly what the variable emits.
      const chosenText = displayField ? scalar(displayField) : "";

      // Instance-reference mode: the value carries the whole identifier so it can
      // be piped straight into a filter that matches on a direct relation.
      if (fieldName === INSTANCE_ID_FIELD) {
        const ref = readInstanceRef(item);
        if (!ref) {
          return null;
        }
        const value = encodeInstanceRef(ref);
        return { text: chosenText || value, value };
      }

      // A field naming an object -- `instanceId { space externalId }` -- is also a
      // reference. Previously this stringified to "[object Object]". A list is
      // not: one element cannot stand in for every item of a relation.
      const selected = readPath(item, fieldName);
      if (Array.isArray(selected)) {
        return null;
      }
      if (selected && typeof selected === "object") {
        const ref = readInstanceRef(selected as Record<string, unknown>);
        if (!ref) {
          return null;
        }
        const value = encodeInstanceRef(ref);
        return { text: chosenText || value, value };
      }

      const value = scalar(fieldName) || scalar("id") || scalar("externalId");
      if (!value) {
        return null;
      }
      return { text: chosenText || value, value };
    })
    .filter((entry) => entry !== null) as MetricDescription[];
}
