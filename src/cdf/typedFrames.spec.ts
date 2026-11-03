import { FieldType, MappingType } from '@grafana/data';
import {
  mostTimeInStateFrame,
  perStateFrames,
  stateFramesFor,
  stateValueFrame,
  stringSeriesFrame,
  withoutStateToken,
} from './typedFrames';

// The wind turbine state set in grafana-plugin-test, ordered by code.
const STATES = [
  { numericValue: 0, stringValue: 'RUNNING' },
  { numericValue: 1, stringValue: 'AVAILABLE' },
  { numericValue: 4, stringValue: 'FAULT' },
];

// Shaped like the API's answer: a bucket lists only states with something to
// report, and a bucket without data has no `stateAggregates` at all.
const BUCKETS = [
  {
    timestamp: 1000,
    stateAggregates: [
      { numericValue: 4, stringValue: 'FAULT', stateCount: 1, stateTransitions: 1, stateDuration: 600_000 },
      { numericValue: 0, stringValue: 'RUNNING', stateCount: 0, stateTransitions: 0, stateDuration: 60_600_000 },
    ],
  },
  { timestamp: 2000 },
  {
    timestamp: 3000,
    stateAggregates: [
      { numericValue: 1, stringValue: 'AVAILABLE', stateCount: 2, stateTransitions: 2, stateDuration: 34_800_000 },
      { numericValue: 0, stringValue: 'RUNNING', stateCount: 1, stateTransitions: 1, stateDuration: 34_800_000 },
    ],
  },
];

describe('stringSeriesFrame', () => {
  it('holds the values as text in a field named after the series', () => {
    const frame = stringSeriesFrame('phase', [
      { timestamp: 1, value: 'IDLE' },
      { timestamp: 2, value: null },
    ]);
    expect(frame.name).toBe('phase');
    expect(frame.length).toBe(2);
    expect(frame.fields[0]).toMatchObject({ name: 'Time', type: FieldType.time, values: [1, 2] });
    expect(frame.fields[1]).toMatchObject({
      name: 'phase',
      type: FieldType.string,
      values: ['IDLE', null],
      config: { displayNameFromDS: 'phase' },
    });
  });
});

describe('stateValueFrame', () => {
  const points = [
    { timestamp: 1, state: { numericValue: 4, stringValue: 'FAULT' } },
    { timestamp: 2, state: { numericValue: null } },
  ];

  it('keeps codes as numbers, mapped to their labels in state set order', () => {
    const value = stateValueFrame('turbine', points, STATES).fields[1];
    expect(value.type).toBe(FieldType.number);
    expect(value.values).toEqual([4, null]);
    expect(value.config.mappings).toEqual([
      {
        type: MappingType.ValueToText,
        options: {
          '0': { text: 'RUNNING', index: 0 },
          '1': { text: 'AVAILABLE', index: 1 },
          '4': { text: 'FAULT', index: 2 },
        },
      },
    ]);
  });

  it('takes the code of a point that carries only its label from the state set', () => {
    const value = stateValueFrame('turbine', [{ timestamp: 1, state: { stringValue: 'AVAILABLE' } }], STATES).fields[1];
    expect(value.type).toBe(FieldType.number);
    expect(value.values).toEqual([1]);
  });

  it('keeps the labels as text when one is not in the state set', () => {
    const value = stateValueFrame(
      'turbine',
      [...points, { timestamp: 3, state: { stringValue: 'ICING' } }],
      STATES
    ).fields[1];
    expect(value.type).toBe(FieldType.string);
    expect(value.values).toEqual(['FAULT', null, 'ICING']);
  });

  it('falls back to the labels as text without a state set', () => {
    const value = stateValueFrame('turbine', points).fields[1];
    expect(value.type).toBe(FieldType.string);
    expect(value.name).toBe('turbine');
    expect(value.values).toEqual(['FAULT', null]);
  });
});

describe('perStateFrames', () => {
  it('makes one series per state that occurs, ordered by code', () => {
    const frames = perStateFrames('turbine', BUCKETS, 'stateDuration', STATES);
    expect(frames.map((f) => f.fields[1].config.displayNameFromDS)).toEqual([
      'turbine · RUNNING',
      'turbine · AVAILABLE',
      'turbine · FAULT',
    ]);
    expect(frames.map((f) => f.fields[1].labels)).toEqual([
      { state: 'RUNNING' },
      { state: 'AVAILABLE' },
      { state: 'FAULT' },
    ]);
  });

  it('counts 0 for a state a bucket does not list, and leaves out a bucket without data', () => {
    const [running, available, fault] = perStateFrames('turbine', BUCKETS, 'stateCount', STATES);
    expect(running.fields[0].values).toEqual([1000, 3000]);
    expect(running.fields[1].values).toEqual([0, 1]);
    expect(available.fields[1].values).toEqual([0, 2]);
    expect(fault.fields[1].values).toEqual([1, 0]);
  });

  it('gives durations a millisecond unit', () => {
    expect(perStateFrames('t', BUCKETS, 'stateDuration')[0].fields[1].config.unit).toBe('ms');
    expect(perStateFrames('t', BUCKETS, 'stateTransitions')[0].fields[1].config.unit).toBeUndefined();
  });

  it('fills in a {{state}} label token instead of appending the state', () => {
    const frames = perStateFrames('{{state}} on turbine 1', BUCKETS, 'stateCount', STATES);
    expect(frames.map((f) => f.name)).toEqual([
      'RUNNING on turbine 1',
      'AVAILABLE on turbine 1',
      'FAULT on turbine 1',
    ]);
  });
});

describe('mostTimeInStateFrame', () => {
  it('picks the state held longest, the lower code on a tie, and nothing for a bucket without data', () => {
    const value = mostTimeInStateFrame('turbine', BUCKETS, STATES).fields[1];
    expect(value.values).toEqual([0, null, 0]);
    expect(value.config.mappings).toBeDefined();
  });
});

describe('stateFramesFor', () => {
  it('reads raw points, interpolations and per-state aggregates', () => {
    expect(
      stateFramesFor('t', [{ timestamp: 1, numericValue: 1, stringValue: 'AVAILABLE' }], 'none', STATES)![0]
        .fields[1].values
    ).toEqual([1]);
    expect(
      stateFramesFor('t', [{ timestamp: 1, interpolation: { numericValue: 4, stringValue: 'FAULT' } }], 'interpolation')![0]
        .fields[1].values
    ).toEqual(['FAULT']);
    expect(stateFramesFor('t', BUCKETS, 'stateTransitions', STATES)).toHaveLength(3);
    expect(stateFramesFor('t', BUCKETS, 'dominantState', STATES)).toHaveLength(1);
  });

  it('leaves plain-number aggregates to the numeric path', () => {
    expect(stateFramesFor('t', [{ timestamp: 1, count: 3 }], 'count')).toBeUndefined();
    expect(stateFramesFor('t', [{ timestamp: 1, durationGood: 3 }], 'durationGood')).toBeUndefined();
  });
});

describe('withoutStateToken', () => {
  it('shows a {{state}} token as missing on a series that is not per state', () => {
    expect(withoutStateToken('{{state}} turbine')).toBe(':state turbine');
  });
});
