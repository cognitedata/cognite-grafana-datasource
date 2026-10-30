/**
 * CDF-side helpers for the Synthetic time series tab: instance listing with
 * cursor pagination, persisted-query normalization and interpolation, and the
 * request preview shown in the query editor.
 */
import { Connector } from '../connector';
import {
  CdmSyntheticQuery,
  SyntheticVariable,
  SyntheticVariableMode,
  defaultCdmSyntheticQuery,
  HttpMethod,
} from '../types';
import { DMSFilter, DMSInstance, DMSListRequest, DMSViewReference, ViewRef } from '../types/dms';
import { retryOnTransientError } from './client';

export type SyntheticViewRef = ViewRef;

/**
 * Flattened DMS instance: the node identity plus the properties it holds
 * through the selected view. The node's own space/externalId always win over
 * (reserved, so never colliding) view property names, and together form the
 * instance id the synthetic API understands.
 */
export type FlatSyntheticInstance = {
  space: string;
  externalId: string;
  [prop: string]: unknown;
};

export const toViewReference = (view: SyntheticViewRef): DMSViewReference => ({
  type: 'view',
  space: view.space,
  externalId: view.externalId,
  version: view.version,
});

export const flattenInstance = (instance: DMSInstance, view: SyntheticViewRef): FlatSyntheticInstance => ({
  ...(instance.properties?.[view.space]?.[`${view.externalId}/${view.version}`] ?? {}),
  space: instance.space,
  externalId: instance.externalId,
});

/**
 * The body of the instance lookup for a variable's filter. One more than
 * `maxInstances` is asked for, so a cut-off result is detected without another call.
 * Shared by the lookup and its request preview.
 */
export const instanceListRequest = (
  view: SyntheticViewRef,
  filter: DMSFilter | undefined,
  maxInstances: number
): DMSListRequest & { limit: number } => ({
  sources: [{ source: toViewReference(view) }],
  instanceType: 'node',
  ...(filter ? { filter } : {}),
  limit: maxInstances + 1,
});

/** Lists the node instances of a view matching the filter, up to `maxInstances`. */
export async function listAllDmsInstances(
  connector: Connector,
  view: SyntheticViewRef,
  filter: DMSFilter | undefined,
  maxInstances: number
): Promise<{ instances: DMSInstance[]; truncated: boolean }> {
  const items = await retryOnTransientError(() =>
    connector.fetchAndPaginate<DMSInstance>({
      method: HttpMethod.POST,
      path: '/models/instances/list',
      data: instanceListRequest(view, filter, maxInstances),
    })
  );
  const truncated = items.length > maxInstances;
  return { instances: truncated ? items.slice(0, maxInstances) : items, truncated };
}

const VARIABLE_MODES: SyntheticVariableMode[] = ['instance', 'filter'];

/** A saved variable row with unknown fields dropped and exclusive fields reconciled. */
export const normalizeSyntheticVariable = (
  row: Partial<SyntheticVariable> = {}
): SyntheticVariable => {
  const instance =
    row.instance?.space && row.instance?.externalId
      ? {
          space: row.instance.space,
          externalId: row.instance.externalId,
          ...(row.instance.name ? { name: row.instance.name } : {}),
        }
      : undefined;
  return {
    name: typeof row.name === 'string' ? row.name.trim() : '',
    mode: row.mode && VARIABLE_MODES.includes(row.mode) ? row.mode : 'instance',
    ...(instance ? { instance } : {}),
    ...(typeof row.filter === 'string' ? { filter: row.filter } : {}),
    ...(typeof row.aggregate === 'string' && row.aggregate !== 'none'
      ? { aggregate: row.aggregate }
      : {}),
    ...(row.targetUnit
      ? { targetUnit: row.targetUnit }
      : row.targetUnitSystem
        ? { targetUnitSystem: row.targetUnitSystem }
        : {}),
  };
};

const defaultVariables = () => defaultCdmSyntheticQuery.variables.map((row) => ({ ...row }));

/**
 * Single defaulting point for the persisted query model. Only version 2 is
 * understood; anything else (the unreleased version 1 included) starts over.
 */
export const normalizeCdmSyntheticQuery = (
  query?: Partial<CdmSyntheticQuery>
): CdmSyntheticQuery => {
  if (!query || query.version !== 2) {
    return { ...defaultCdmSyntheticQuery, variables: defaultVariables() };
  }
  return {
    version: 2,
    view: { ...defaultCdmSyntheticQuery.view, ...(query.view ?? {}) },
    variables: Array.isArray(query.variables)
      ? query.variables.map(normalizeSyntheticVariable)
      : [],
    expression: typeof query.expression === 'string' ? query.expression : '',
  };
};

/**
 * Dashboard variables in the expression, the view reference and each row's
 * filter, instance id and units. Public so the editor's request previews
 * interpolate exactly what the query will send. Filters take their own
 * replacer, so instance-reference variables can be rendered first.
 */
export const interpolateCdmSyntheticQuery = (
  query: CdmSyntheticQuery,
  replace: (value: string) => string,
  replaceFilter: (value: string) => string = replace
): CdmSyntheticQuery => {
  const maybe = (value?: string) => (value === undefined ? undefined : replace(value));
  return {
    ...query,
    expression: replace(query.expression ?? ''),
    view: {
      space: replace(query.view.space),
      externalId: replace(query.view.externalId),
      version: replace(query.view.version),
    },
    variables: query.variables.map((row) => ({
      ...row,
      ...(row.instance
        ? {
            instance: {
              ...row.instance,
              space: replace(row.instance.space),
              externalId: replace(row.instance.externalId),
            },
          }
        : {}),
      ...(row.filter !== undefined ? { filter: replaceFilter(row.filter) } : {}),
      ...(row.targetUnit ? { targetUnit: maybe(row.targetUnit) } : {}),
      ...(row.targetUnitSystem ? { targetUnitSystem: maybe(row.targetUnitSystem) } : {}),
    })),
  };
};

/** Body + path of the /models/instances/list call, for the editor's request preview. */
export const buildListRequestPreview = (
  view: SyntheticViewRef,
  filter: DMSFilter | undefined,
  maxInstances: number,
  project = '{project}'
): { path: string; body: object } => ({
  path: `/api/v1/projects/${project}/models/instances/list`,
  // The lookup asks for one more than the cap only to tell that a filter matches more;
  // the preview shows the cap itself, the number the docs and the match chip use.
  body: { ...instanceListRequest(view, filter, maxInstances), limit: maxInstances },
});
