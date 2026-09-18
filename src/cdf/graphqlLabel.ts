import { LABEL_TOKEN, renderLabelToken, resolvePath } from './labelTokens';

/**
 * Resolves a series-label template against the GraphQL row a time series came from.
 *
 * `series` is the object holding the time series; `row` is the item it was found on,
 * which differs when the query reaches the series through a relation. Series fields
 * win, so `{{name}}` is the series' own name, while fields it does not carry, or
 * carries as null -- `{{name}}` on a parent asset, say -- resolve against the row.
 *
 * Unresolved tokens follow the same rules as the Time Series tab's labels (see
 * `renderLabelToken`), so `{{nope}}` reads `:nope` on either tab.
 *
 * An empty result means the template produced nothing useful, and the caller keeps
 * its own default rather than labelling the series with a blank string.
 */
export function interpolateGraphqlLabel(
  template: string,
  series: unknown,
  row?: unknown
): string {
  if (!template) {
    return '';
  }
  const resolved = template.replace(LABEL_TOKEN, (_match, path: string) => {
    const fromSeries = resolvePath(series, path);
    if (fromSeries.found && fromSeries.value != null) {
      return renderLabelToken(path, fromSeries);
    }
    const fromRow = row ? resolvePath(row, path) : { found: false as const };
    if (fromRow.found && fromRow.value != null) {
      return renderLabelToken(path, fromRow);
    }
    // Neither side carries a value; report against whichever carries the field.
    return renderLabelToken(path, fromSeries.found ? fromSeries : fromRow);
  });
  return resolved.trim() ? resolved : '';
}
