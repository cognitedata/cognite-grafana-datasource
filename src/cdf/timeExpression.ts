/**
 * A tiny typed expression language for the Records time filter.
 *
 * Immutable streams always need a lastUpdatedTime window, but the dashboard range
 * is not always the window the user wants: a common pattern is several queries that
 * each cover one `maxFilteringInterval` slice, stacked in one panel. These
 * expressions let each query name its own window relative to the dashboard range
 * and the stream's own limit, e.g.
 *
 *   from: {{endTime}} - 2 * {{maxFilteringInterval}}
 *   to:   {{endTime}} - {{maxFilteringInterval}}
 *
 * Values are typed as instants or durations so that only meaningful arithmetic is
 * accepted: an instant minus a duration is an instant, two instants subtract to a
 * duration, and a duration scales by a plain number.
 */

export interface TimeExpressionContext {
  /** Dashboard range start. */
  startTime?: number;
  /** Dashboard range end. */
  endTime?: number;
  /** Evaluation time; injected so results are reproducible in tests. */
  now?: number;
  /** The selected view's stream limit, in milliseconds. */
  maxFilteringIntervalMs?: number;
}

type Value =
  | { kind: 'instant'; ms: number }
  | { kind: 'duration'; ms: number }
  | { kind: 'number'; n: number };

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

// Matched before plain numbers so "2026-08-01T00:00:00Z" is one literal and its
// dashes are not mistaken for subtraction.
const ISO_INSTANT =
  /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:?\d{2})?)?/;
const ISO_DURATION = /^P(?!$)(?:\d+(?:\.\d+)?[YMWD])*(?:T(?:\d+(?:\.\d+)?[HMS])+)?/;
const SIMPLE_DURATION = /^\d+(?:\.\d+)?(?:ms|s|m|h|d|w)(?![a-zA-Z0-9])/;
const NUMBER = /^\d+(?:\.\d+)?/;
const ANCHOR = /^\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/;

const ISO_DURATION_PARTS =
  /^P(?:([\d.]+)Y)?(?:([\d.]+)M)?(?:([\d.]+)W)?(?:([\d.]+)D)?(?:T(?:([\d.]+)H)?(?:([\d.]+)M)?(?:([\d.]+)S)?)?$/;

/** Approximates years and months; only ever used for relative windows. */
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

type Token =
  | { type: 'value'; value: Value }
  | { type: 'op'; op: '+' | '-' | '*' | '/' }
  | { type: 'lparen' }
  | { type: 'rparen' };

class ExpressionError extends Error {}

function tokenize(input: string, ctx: TimeExpressionContext): Token[] {
  const tokens: Token[] = [];
  let rest = input.trim();

  while (rest.length) {
    if (/^\s/.test(rest)) {
      rest = rest.replace(/^\s+/, '');
      continue;
    }

    const anchor = ANCHOR.exec(rest);
    if (anchor) {
      tokens.push({ type: 'value', value: resolveAnchor(anchor[1], ctx) });
      rest = rest.slice(anchor[0].length);
      continue;
    }

    const iso = ISO_INSTANT.exec(rest);
    if (iso) {
      // Everything CDF stores is UTC. Per ECMA-262 a date-time without an offset
      // parses as browser-local, which would skew the window by the viewer's offset;
      // a bare date already parses as UTC.
      const literal = iso[0];
      const ms = Date.parse(
        /\d/.test(literal.slice(10)) && !/(Z|[+-]\d{2}:?\d{2})$/i.test(literal)
          ? `${literal}Z`
          : literal
      );
      if (Number.isNaN(ms)) {
        throw new ExpressionError(`"${iso[0]}" is not a valid date`);
      }
      tokens.push({ type: 'value', value: { kind: 'instant', ms } });
      rest = rest.slice(iso[0].length);
      continue;
    }

    const isoDuration = ISO_DURATION.exec(rest);
    if (isoDuration) {
      const ms = parseDurationMs(isoDuration[0]);
      if (ms === null) {
        throw new ExpressionError(`"${isoDuration[0]}" is not a valid duration`);
      }
      tokens.push({ type: 'value', value: { kind: 'duration', ms } });
      rest = rest.slice(isoDuration[0].length);
      continue;
    }

    const duration = SIMPLE_DURATION.exec(rest);
    if (duration) {
      tokens.push({
        type: 'value',
        value: { kind: 'duration', ms: parseDurationMs(duration[0])! },
      });
      rest = rest.slice(duration[0].length);
      continue;
    }

    const num = NUMBER.exec(rest);
    if (num) {
      tokens.push({ type: 'value', value: { kind: 'number', n: Number(num[0]) } });
      rest = rest.slice(num[0].length);
      continue;
    }

    const char = rest[0];
    if (char === '(') {
      tokens.push({ type: 'lparen' });
    } else if (char === ')') {
      tokens.push({ type: 'rparen' });
    } else if ('+-*/'.includes(char)) {
      tokens.push({ type: 'op', op: char as '+' | '-' | '*' | '/' });
    } else {
      throw new ExpressionError(`Unexpected character "${char}"`);
    }
    rest = rest.slice(1);
  }

  return tokens;
}

function resolveAnchor(name: string, ctx: TimeExpressionContext): Value {
  switch (name) {
    case 'startTime':
      if (ctx.startTime === undefined) {
        throw new ExpressionError('{{startTime}} needs a dashboard time range');
      }
      return { kind: 'instant', ms: ctx.startTime };
    case 'endTime':
      if (ctx.endTime === undefined) {
        throw new ExpressionError('{{endTime}} needs a dashboard time range');
      }
      return { kind: 'instant', ms: ctx.endTime };
    case 'now':
      return { kind: 'instant', ms: ctx.now ?? Date.now() };
    case 'maxFilteringInterval':
      if (ctx.maxFilteringIntervalMs === undefined) {
        throw new ExpressionError(
          '{{maxFilteringInterval}} is only available on streams that declare one'
        );
      }
      return { kind: 'duration', ms: ctx.maxFilteringIntervalMs };
    default:
      throw new ExpressionError(`Unknown variable {{${name}}}`);
  }
}

const describe = (v: Value) => (v.kind === 'number' ? 'a number' : `a ${v.kind}`);

function apply(op: '+' | '-' | '*' | '/', a: Value, b: Value): Value {
  if (op === '+' || op === '-') {
    if (a.kind === 'instant' && b.kind === 'duration') {
      return { kind: 'instant', ms: op === '+' ? a.ms + b.ms : a.ms - b.ms };
    }
    if (a.kind === 'duration' && b.kind === 'instant' && op === '+') {
      return { kind: 'instant', ms: a.ms + b.ms };
    }
    if (a.kind === 'instant' && b.kind === 'instant' && op === '-') {
      return { kind: 'duration', ms: a.ms - b.ms };
    }
    if (a.kind === 'duration' && b.kind === 'duration') {
      return { kind: 'duration', ms: op === '+' ? a.ms + b.ms : a.ms - b.ms };
    }
    if (a.kind === 'number' && b.kind === 'number') {
      return { kind: 'number', n: op === '+' ? a.n + b.n : a.n - b.n };
    }
    throw new ExpressionError(`Cannot ${op === '+' ? 'add' : 'subtract'} ${describe(b)} and ${describe(a)}`);
  }

  if (op === '*') {
    if (a.kind === 'duration' && b.kind === 'number') {
      return { kind: 'duration', ms: a.ms * b.n };
    }
    if (a.kind === 'number' && b.kind === 'duration') {
      return { kind: 'duration', ms: a.n * b.ms };
    }
    if (a.kind === 'number' && b.kind === 'number') {
      return { kind: 'number', n: a.n * b.n };
    }
    throw new ExpressionError(`Cannot multiply ${describe(a)} by ${describe(b)}`);
  }

  // division
  if (b.kind === 'number' && b.n === 0) {
    throw new ExpressionError('Division by zero');
  }
  if (a.kind === 'duration' && b.kind === 'number') {
    return { kind: 'duration', ms: a.ms / b.n };
  }
  if (a.kind === 'duration' && b.kind === 'duration') {
    if (b.ms === 0) {
      throw new ExpressionError('Division by zero');
    }
    return { kind: 'number', n: a.ms / b.ms };
  }
  if (a.kind === 'number' && b.kind === 'number') {
    return { kind: 'number', n: a.n / b.n };
  }
  throw new ExpressionError(`Cannot divide ${describe(a)} by ${describe(b)}`);
}

/** Precedence-climbing parser over the token list. */
function parse(tokens: Token[]): Value {
  let pos = 0;

  const peek = () => tokens[pos];

  const parseFactor = (): Value => {
    const token = peek();
    if (!token) {
      throw new ExpressionError('Unexpected end of expression');
    }
    if (token.type === 'op' && token.op === '-') {
      pos += 1;
      const inner = parseFactor();
      if (inner.kind === 'instant') {
        throw new ExpressionError('Cannot negate a date');
      }
      return inner.kind === 'duration'
        ? { kind: 'duration', ms: -inner.ms }
        : { kind: 'number', n: -inner.n };
    }
    if (token.type === 'lparen') {
      pos += 1;
      const inner = parseExpr();
      if (peek()?.type !== 'rparen') {
        throw new ExpressionError('Missing closing parenthesis');
      }
      pos += 1;
      return inner;
    }
    if (token.type === 'value') {
      pos += 1;
      return token.value;
    }
    throw new ExpressionError('Expected a value');
  };

  const parseTerm = (): Value => {
    let left = parseFactor();
    for (;;) {
      const token = peek();
      if (token?.type === 'op' && (token.op === '*' || token.op === '/')) {
        pos += 1;
        left = apply(token.op, left, parseFactor());
      } else {
        return left;
      }
    }
  };

  function parseExpr(): Value {
    let left = parseTerm();
    for (;;) {
      const token = peek();
      if (token?.type === 'op' && (token.op === '+' || token.op === '-')) {
        pos += 1;
        left = apply(token.op, left, parseTerm());
      } else {
        return left;
      }
    }
  }

  const result = parseExpr();
  if (pos !== tokens.length) {
    throw new ExpressionError('Unexpected trailing input');
  }
  return result;
}

export interface TimeExpressionResult {
  /** Epoch milliseconds; present when the expression resolved to an instant. */
  ms?: number;
  /** ISO-8601 rendering of `ms`, shown in the editor next to the window bounds. */
  iso?: string;
  error?: string;
}

/** Evaluates an expression that must resolve to a point in time. */
export function evaluateTimeExpression(
  expression: string,
  ctx: TimeExpressionContext = {}
): TimeExpressionResult {
  const text = (expression ?? '').trim();
  if (!text) {
    return { error: 'Enter a time expression' };
  }
  try {
    const tokens = tokenize(text, ctx);
    if (!tokens.length) {
      return { error: 'Enter a time expression' };
    }
    const value = parse(tokens);
    if (value.kind !== 'instant') {
      return {
        error:
          value.kind === 'duration'
            ? 'Expression resolves to a duration; it must resolve to a point in time'
            : 'Expression resolves to a number; it must resolve to a point in time',
      };
    }
    if (!Number.isFinite(value.ms)) {
      return { error: 'Expression does not resolve to a valid date' };
    }
    const ms = Math.round(value.ms);
    return { ms, iso: new Date(ms).toISOString() };
  } catch (e) {
    return { error: e instanceof ExpressionError ? e.message : String(e) };
  }
}

/** Anchors offered in the editor's autocomplete/help. */
export const TIME_EXPRESSION_ANCHORS = [
  { name: '{{startTime}}', description: 'Dashboard time range start' },
  { name: '{{endTime}}', description: 'Dashboard time range end' },
  { name: '{{now}}', description: 'Current time' },
  {
    name: '{{maxFilteringInterval}}',
    description: "The selected view's stream limit, as a duration",
  },
];
