/**
 * `{{ field.path }}` in a series label. Whitespace inside the braces is tolerated,
 * since the template is hand-typed. Shared by every tab that offers label tokens,
 * so `{{ name }}` means the same thing on all of them.
 */
export const LABEL_TOKEN = /\{\{\s*([^{}\s]+)\s*\}\}/g;

/**
 * How a `{{field}}` label token renders once its lookup has been attempted. One
 * shared rule set, so a mistyped or empty field reads the same on every tab:
 *
 * - a field the data does not carry renders as `:field`, pointing at the typo
 *   instead of silently falling back to a default label;
 * - a carried field holding null renders as `null` (`:path` for a dotted path,
 *   where the null usually means a link that is not populated);
 * - an object serializes whole, so a bare `{{unit}}` shows the property bag and
 *   the available `{{unit.<prop>}}` paths are discoverable from the label itself.
 */
export type LabelTokenResolution =
  | { found: false }
  | { found: true; value: unknown };

/**
 * Walks a dotted path, reporting whether the data carries the field at all: a
 * GraphQL response only holds the fields the query selected, so an absent key
 * means the path names a field the query does not return. Lists are not walked
 * into -- a path names one value, and a list is many.
 */
export function resolvePath(item: unknown, path: string): LabelTokenResolution {
  if (!path) {
    return { found: false };
  }
  let node: unknown = item;
  for (const segment of path.split('.')) {
    if (
      !node ||
      typeof node !== 'object' ||
      Array.isArray(node) ||
      !(segment in (node as Record<string, unknown>))
    ) {
      return { found: false };
    }
    node = (node as Record<string, unknown>)[segment];
  }
  return { found: true, value: node };
}

export function renderLabelToken(
  path: string,
  resolution: LabelTokenResolution
): string {
  if (!resolution.found) {
    return `:${path}`;
  }
  const { value } = resolution;
  if (value == null) {
    return path.includes('.') ? `:${path}` : 'null';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}
