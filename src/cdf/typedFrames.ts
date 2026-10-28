import { DataFrame, Field, FieldType, MappingType, ValueMapping } from '@grafana/data';

/**
 * Frames for series whose values are not numbers. The numeric path keeps returning
 * legacy `TimeSeries`, which Grafana always reads as numbers; text values need a
 * frame with a string field so the table and state timeline panels show them.
 *
 * Built as plain objects (arrays as field values) so they work on every Grafana
 * version the plugin supports.
 */

/** One state of a state set: the code stored with each data point and its label. */
export type StateSetEntry = { numericValue: number; stringValue: string; description?: string };

/** A state as data points and interpolations carry it. Bad data points may have no value. */
type StateValue = { numericValue?: number | null; stringValue?: string | null } | null | undefined;

type StateAggregate = {
  numericValue: number;
  stringValue?: string;
  stateCount?: number;
  stateTransitions?: number;
  stateDuration?: number;
};

type StateBucket = { timestamp: number; stateAggregates?: StateAggregate[] };

/** The label token that names the state of a per-state series. */
export const STATE_LABEL_TOKEN = 'state';
const STATE_TOKEN = /\{\{\s*state\s*\}\}/g;

/** Aggregates CDF reports once per state, in a bucket's `stateAggregates`. */
export const PER_STATE_AGGREGATES = new Set(['stateCount', 'stateTransitions', 'stateDuration']);

/** "Most time in state": derived here from stateDuration, which is what is requested. */
export const MOST_TIME_IN_STATE = 'dominantState';

/**
 * Text fields are named after their series. Explore's table merges frames that are
 * not time series (any frame with a text value) by field name, so with every text
 * field called "Value", two string queries were stacked into one column.
 */
const textField = (label: string, values: Array<string | null>): Field => ({
  name: label,
  type: FieldType.string,
  config: { displayNameFromDS: label },
  values,
});

const timeField = (timestamps: number[]): Field => ({
  name: 'Time',
  type: FieldType.time,
  config: {},
  values: timestamps,
});

function frame(name: string, timestamps: number[], value: Field): DataFrame {
  return { name, length: timestamps.length, fields: [timeField(timestamps), value] };
}

/** A series name for a label that may hold `{{state}}`, which only per-state series fill in. */
export const withoutStateToken = (label: string) => label.replace(STATE_TOKEN, `:${STATE_LABEL_TOKEN}`);

export function stringSeriesFrame(
  name: string,
  points: Array<{ timestamp: number; value: string | null }>
): DataFrame {
  const label = withoutStateToken(name);
  return frame(label, points.map((p) => p.timestamp), textField(label, points.map((p) => p.value)));
}

/** Value mappings from a state's code to its label, in state set order. */
export function stateValueMappings(states: StateSetEntry[]): ValueMapping[] {
  return [
    {
      type: MappingType.ValueToText,
      options: Object.fromEntries(
        states.map(({ numericValue, stringValue }, index) => [String(numericValue), { text: stringValue, index }])
      ),
    },
  ];
}

/**
 * A state per point. With the state set known, the codes are kept as numbers and
 * mapped to their labels, so the state timeline shows labels in the set's order and
 * a time series panel can still plot the codes. Without it, the labels are text.
 */
export function stateValueFrame(
  name: string,
  points: Array<{ timestamp: number; state: StateValue }>,
  states?: StateSetEntry[]
): DataFrame {
  const label = withoutStateToken(name);
  const timestamps = points.map((p) => p.timestamp);
  if (states?.length) {
    return frame(label, timestamps, {
      name: 'Value',
      type: FieldType.number,
      config: { displayNameFromDS: label, mappings: stateValueMappings(states) },
      values: points.map((p) => p.state?.numericValue ?? null),
    });
  }
  return frame(
    label,
    timestamps,
    textField(label, points.map((p) => p.state?.stringValue ?? (p.state?.numericValue != null ? String(p.state.numericValue) : null)))
  );
}

const stateName = (state: { numericValue: number; stringValue?: string }, states?: StateSetEntry[]) =>
  state.stringValue ??
  states?.find(({ numericValue }) => numericValue === state.numericValue)?.stringValue ??
  String(state.numericValue);

/** The series name for one state: `{{state}}` filled in, or the state appended. */
const perStateName = (label: string, state: string) =>
  /\{\{\s*state\s*\}\}/.test(label) ? label.replace(STATE_TOKEN, state) : `${label} · ${state}`;

/**
 * One series per state that occurs in the response, ordered by state code. A bucket
 * that lists other states but not this one counts 0 for it (CDF only lists states
 * with something to report); a bucket with no data at all is left out.
 */
export function perStateFrames(
  label: string,
  buckets: StateBucket[],
  aggregate: string,
  states?: StateSetEntry[]
): DataFrame[] {
  const seen = new Map<number, string>();
  buckets.forEach(({ stateAggregates }) =>
    stateAggregates?.forEach((state) => seen.set(state.numericValue, stateName(state, states)))
  );
  const reported = buckets.filter(({ stateAggregates }) => stateAggregates?.length);
  const timestamps = reported.map(({ timestamp }) => timestamp);

  return [...seen.entries()]
    .sort(([a], [b]) => a - b)
    .map(([code, stateLabel]) => {
      const name = perStateName(label, stateLabel);
      return frame(name, timestamps, {
        name: 'Value',
        type: FieldType.number,
        labels: { state: stateLabel },
        config: {
          displayNameFromDS: name,
          ...(aggregate === 'stateDuration' ? { unit: 'ms' } : {}),
        },
        values: reported.map(({ stateAggregates }) => {
          const entry = stateAggregates!.find(({ numericValue }) => numericValue === code);
          return (entry?.[aggregate as keyof StateAggregate] as number | undefined) ?? 0;
        }),
      });
    });
}

/**
 * The state held longest in each bucket, from stateDuration; a tie goes to the
 * lower code. A bucket where no state lasted has no value, so a state timeline
 * shows a gap there instead of stretching the previous state across it.
 */
export function mostTimeInStateFrame(label: string, buckets: StateBucket[], states?: StateSetEntry[]): DataFrame {
  return stateValueFrame(
    label,
    buckets.map(({ timestamp, stateAggregates }) => {
      const longest = [...(stateAggregates ?? [])]
        .filter(({ stateDuration }) => (stateDuration ?? 0) > 0)
        .sort((a, b) => (b.stateDuration ?? 0) - (a.stateDuration ?? 0) || a.numericValue - b.numericValue)[0];
      return { timestamp, state: longest ?? null };
    }),
    states
  );
}

/**
 * The frames for a state series' response, given the query's aggregation (not the
 * one requested: Most time in state is requested as stateDuration), or undefined
 * when the aggregate is a plain number (count and the status aggregates) that the
 * numeric path handles.
 */
export function stateFramesFor(
  label: string,
  datapoints: Array<Record<string, any> & { timestamp: number }>,
  aggregate: string | undefined,
  states?: StateSetEntry[]
): DataFrame[] | undefined {
  if (aggregate === MOST_TIME_IN_STATE) {
    return [mostTimeInStateFrame(label, datapoints as StateBucket[], states)];
  }
  if (!aggregate || aggregate === 'none') {
    return [
      stateValueFrame(label, datapoints.map((dp) => ({ timestamp: dp.timestamp, state: dp as StateValue })), states),
    ];
  }
  if (aggregate === 'interpolation') {
    return [
      stateValueFrame(label, datapoints.map((dp) => ({ timestamp: dp.timestamp, state: dp[aggregate] })), states),
    ];
  }
  if (PER_STATE_AGGREGATES.has(aggregate)) {
    return perStateFrames(label, datapoints as StateBucket[], aggregate, states);
  }
  return undefined;
}
