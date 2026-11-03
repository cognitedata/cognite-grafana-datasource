/**
 * The request previews of the Synthetic time series tab, pure of Monaco:
 * a filter variable's instance lookup, and the synthetic expressions the
 * whole query expands to.
 */
import { Connector } from '../../connector';
import { CdmSyntheticQuery, SyntheticVariable, Tuple } from '../../types';
import {
  buildSyntheticQueryRequest,
  chunkSyntheticItems,
  resolveRequestTimeZone,
  SYNTHETIC_ITEMS_PER_REQUEST,
} from '../../cdf/client';
import { ViewRef } from '../../types/dms';
import { buildListRequestPreview } from '../../cdf/syntheticTimeSeries';
import {
  MAX_SYNTHETIC_FANOUT,
  buildDmsFilter,
  ExpandOptions,
  formQueriesForSyntheticQuery,
  parseFilter,
  splitRefFilters,
  undefinedFilterVariable,
  ViewFilterProperties,
} from '../../parser/dms';
import { STSReference } from '../../parser/shared';

export const SYNTHETIC_PATH = '/api/v1/projects/{project}/timeseries/synthetic/query';

export interface SyntheticRequestPreviewParts {
  path: string;
  /** The body of each request sent, as JSON; more than one when the items are split. */
  bodies?: string[];
  error?: string;
  /** What the body covers, or why there is none. */
  note?: string;
}

/** The instance lookup a filter variable compiles to; a picked series needs none. */
export const buildVariableLookupPreview = (
  view: ViewRef,
  row: SyntheticVariable,
  properties?: ViewFilterProperties
): SyntheticRequestPreviewParts => {
  const { path } = buildListRequestPreview(view, undefined, MAX_SYNTHETIC_FANOUT);
  if (row.mode !== 'filter') {
    return {
      path,
      note: `Variable ${row.name} is a fixed time series, so no request is needed.`,
    };
  }
  if (!row.filter?.trim()) {
    return { path, note: `Variable ${row.name} has an empty filter, so no request is sent.` };
  }
  const undefinedVariable = undefinedFilterVariable(row.filter);
  if (undefinedVariable) {
    return { path, error: `Dashboard variable ${undefinedVariable} is not defined.` };
  }
  try {
    const { synthetic, server } = splitRefFilters(STSReference(parseFilter(row.filter ?? '')));
    if (synthetic.length) {
      return {
        path,
        error: `Set ${synthetic.map((f) => f.path).join(', ')} with the row's options, not in the filter.`,
      };
    }
    const filter = buildDmsFilter(view, server, { properties });
    return { path, bodies: [JSON.stringify(buildListRequestPreview(view, filter, MAX_SYNTHETIC_FANOUT).body, null, 2)] };
  } catch (err: any) {
    return { path, error: err?.message ?? String(err) };
  }
};

/** The dashboard context a synthetic request carries besides its expressions. */
export interface SyntheticRequestContext {
  /** Start and end in ms. */
  range: Tuple<number>;
  /** The dashboard time zone, as Grafana reports it ("browser", "utc", or a zone name). */
  timezone?: string;
}

/**
 * The synthetic requests the query sends, after resolving every variable:
 * the same bodies the datasource builds, split into the same requests.
 */
export const buildExpressionPreview = async (
  query: CdmSyntheticQuery,
  options: ExpandOptions,
  connector: Connector,
  { range, timezone }: SyntheticRequestContext
): Promise<SyntheticRequestPreviewParts> => {
  try {
    const { items, counts, warnings } = await formQueriesForSyntheticQuery(
      query,
      options,
      connector
    );
    const request = buildSyntheticQueryRequest(
      items.map(({ expression }) => expression),
      range,
      resolveRequestTimeZone(timezone),
      SYNTHETIC_ITEMS_PER_REQUEST
    );
    const bodies = chunkSyntheticItems(request.items).map((requestItems) =>
      JSON.stringify({ ...request, items: requestItems }, null, 2)
    );
    const resolved = Object.entries(counts)
      .map(([name, count]) => `${name}: ${count} time series`)
      .join(' · ');
    const plural = items.length === 1 ? 'expression' : 'expressions';
    return {
      path: SYNTHETIC_PATH,
      bodies,
      note: [`${resolved} → ${items.length} ${plural}.`, ...warnings].join(' '),
    };
  } catch (err: any) {
    return { path: SYNTHETIC_PATH, error: err?.message ?? String(err) };
  }
};
