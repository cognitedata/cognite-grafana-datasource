/**
 * Durations for the Records tab: the ISO-8601 limits streams declare
 * (maxFilteringInterval, e.g. "PT168H") and the simple units bucket intervals use.
 */

/** Shared with the records builders, so a duration means the same thing everywhere. */
export const SECOND = 1000;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

const SIMPLE_DURATION_UNITS: Record<string, number> = {
  ms: 1,
  s: SECOND,
  m: MINUTE,
  h: HOUR,
  d: DAY,
  w: 7 * DAY,
};

const ISO_DURATION_PARTS =
  /^P(?:([\d.]+)Y)?(?:([\d.]+)M)?(?:([\d.]+)W)?(?:([\d.]+)D)?(?:T(?:([\d.]+)H)?(?:([\d.]+)M)?(?:([\d.]+)S)?)?$/;

/** Approximates years and months; only ever used for guardrails, never for a request. */
export function parseDurationMs(text: string): number | null {
  const value = text.trim();
  const simple = /^(\d+(?:\.\d+)?)(ms|s|m|h|d|w)$/.exec(value);
  if (simple) {
    return Number(simple[1]) * SIMPLE_DURATION_UNITS[simple[2]];
  }
  const iso = ISO_DURATION_PARTS.exec(value);
  if (!iso || value === 'P') {
    return null;
  }
  const [, y, mo, w, d, h, mi, s] = iso;
  if (![y, mo, w, d, h, mi, s].some(Boolean)) {
    return null;
  }
  return (
    Number(y ?? 0) * 365 * DAY +
    Number(mo ?? 0) * 30 * DAY +
    Number(w ?? 0) * 7 * DAY +
    Number(d ?? 0) * DAY +
    Number(h ?? 0) * HOUR +
    Number(mi ?? 0) * MINUTE +
    Number(s ?? 0) * SECOND
  );
}
