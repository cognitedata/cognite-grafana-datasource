/**
 * A data modelling instance identifier, as the APIs expect it.
 *
 * Grafana template variables carry strings, and query models persist strings, so a
 * reference has to travel encoded. JSON is the canonical form: an instance externalId
 * may itself contain colons (`asset:equip:iaa_met_34es7512`), which makes a delimiter
 * shorthand ambiguous to read back.
 */
import { resolvePath } from './labelTokens';

export interface InstanceRef {
  space: string;
  externalId: string;
}

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

/** The canonical wire form stored in queries and emitted by variables. */
export const encodeInstanceRef = ({ space, externalId }: InstanceRef): string =>
  JSON.stringify({ space, externalId });

/**
 * Reads a reference back. Returns null rather than throwing so callers can decide how
 * to report it -- the APIs accept a malformed reference and answer with zero rows, so
 * a bad value has to be caught here or it disappears silently.
 *
 * Extra keys are dropped: forwarding them would make the API reject the request.
 */
export function parseInstanceRef(raw: string): InstanceRef | null {
  const text = raw?.trim();
  if (!text || !text.startsWith('{')) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null;
  }
  const { space, externalId } = parsed as Record<string, unknown>;
  if (!isNonEmptyString(space) || !isNonEmptyString(externalId)) {
    return null;
  }
  return { space: space.trim(), externalId: externalId.trim() };
}

export const INSTANCE_REF_HINT = '{"space":"…","externalId":"…"}';

/**
 * The sentinel value field that makes a GraphQL variable emit whole instance
 * references instead of a scalar column.
 */
export const INSTANCE_ID_FIELD = '__instanceId';

/** The value at a dotted path, e.g. "instanceId.space", or undefined off the path. */
export function readPath(item: unknown, path: string): unknown {
  const resolution = resolvePath(item, path);
  return resolution.found ? resolution.value : undefined;
}

/**
 * Scalar at `path`, as a string. Objects and arrays yield '' rather than
 * "[object Object]" -- a poison value that used to reach dashboards intact.
 */
export function readScalarPath(item: unknown, path: string): string {
  const value = readPath(item, path);
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}

const ownInstanceRef = (item: Record<string, unknown>): InstanceRef | null => {
  const { space, externalId } = item;
  return isNonEmptyString(space) && isNonEmptyString(externalId)
    ? { space: space.trim(), externalId: externalId.trim() }
    : null;
};

/**
 * Reads an instance reference out of a GraphQL item, whether the identifiers sit at
 * the top level (`items { space externalId }`) or under a nested field
 * (`items { instanceId { space externalId } }`).
 *
 * Exactly one nested object may carry a reference: with two (`asset { … } unit { … }`)
 * there is no telling which one the user meant, so neither is picked. A list is
 * never a reference either -- one element cannot stand in for all of them.
 */
export function readInstanceRef(item: Record<string, unknown>): InstanceRef | null {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return null;
  }
  const own = ownInstanceRef(item);
  if (own) {
    return own;
  }
  const nested = Object.values(item)
    .filter((value): value is Record<string, unknown> =>
      !!value && typeof value === 'object' && !Array.isArray(value)
    )
    .map(ownInstanceRef)
    .filter((ref): ref is InstanceRef => ref !== null);
  return nested.length === 1 ? nested[0] : null;
}
