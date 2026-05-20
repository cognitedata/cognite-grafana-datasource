import { Err, Ok, Tab, defaultCogniteTimeSeries } from '../types';
import {
  datapoints2Tuples,
  reduceTimeseries,
  labelContainsVariableProps,
  interpolateCogniteTimeSeriesInstanceLabel,
  concurrent,
  convertItemsToTable,
} from '../cdf/client';
import { getDataqueryResponse, getMeta } from '../test_utils';

describe('CDF client', () => {
  describe('datapoints to tuples', () => {
    it('converts non aggregated values', () => {
      expect(
        datapoints2Tuples(
          [
            { timestamp: 1, value: 2 },
            { timestamp: 1, value: 2 },
          ],
          ''
        )
      ).toEqual([
        [2, 1],
        [2, 1],
      ]);
    });

    it('converts aggregated values', () => {
      expect(
        datapoints2Tuples(
          [
            { timestamp: 1, aggregate: 2 },
            { timestamp: 1, aggregate: 2 },
          ],
          'aggregate'
        )
      ).toEqual([
        [2, 1],
        [2, 1],
      ]);
    });
  });

  describe('reduce timeseries', () => {
    it('should return datapoints and the default label', () => {
      const id = 2;
      const externalIdPrefix = 'Timeseries';
      const metaResponses: any[] = [
        {
          result: getDataqueryResponse(
            {
              items: [{ id }],
              aggregates: ['average'],
            },
            externalIdPrefix
          ),
          metadata: getMeta(id, 'average', ['']),
        },
      ];
      const [reduced] = reduceTimeseries(metaResponses, [1549336675000, 1549337275000]);
      expect(reduced.datapoints).toEqual([
        [0, 1549336675000],
        [1, 1549337275000],
      ]);
      expect(reduced.target).toEqual(`average ${externalIdPrefix}${id}`);
    });

    it('should return latest data point even if outside the time range with a correct label', () => {
      const id = 1;
      const metaResponses: any[] = [
        {
          result: getDataqueryResponse(
            {
              items: [{ id }],
              aggregates: ['average'],
            },
            '',
            1
          ),
          metadata: getMeta(id, 'average', [''], 'latest'),
        },
      ];
      const [reduced] = reduceTimeseries(metaResponses, [1549337270000, 1549337275000]);
      expect(reduced.datapoints).toEqual([[0, 1549336675000]]);
      expect(reduced.target).toEqual(`${id}`);
    });

    it('fans out state TS stateDuration: one series per state, 0 when absent, sorted by numericValue', () => {
      const target = {
        tab: Tab.CogniteTimeSeriesSearch,
        aggregation: 'stateDuration',
        cogniteTimeSeries: {
          ...defaultCogniteTimeSeries,
          type: 'state' as const,
          instanceId: { space: 's1', externalId: 'ts1' },
          displayAsNumeric: false,
        },
      };

      const metaResponses: any[] = [
        {
          result: {
            data: {
              items: [
                {
                  id: 1,
                  externalId: 'x',
                  datapoints: [
                    {
                      timestamp: 1000,
                      stateAggregates: [
                        { numericValue: 1, stringValue: 'ON', stateDuration: 200 },
                        { numericValue: 0, stringValue: 'OFF', stateDuration: 100 },
                      ],
                    },
                    {
                      timestamp: 2000,
                      stateAggregates: [
                        { numericValue: 0, stringValue: 'OFF', stateDuration: 50 },
                      ],
                    },
                  ],
                },
              ],
            },
            config: { data: { aggregates: 'stateDuration' } },
          },
          metadata: {
            labels: ['s1:ts1'],
            target,
            type: 'data',
          },
        },
      ];

      const reduced = reduceTimeseries(metaResponses, [0, 5000]);
      expect(reduced).toHaveLength(2);
      expect(reduced[0].target).toBe('s1:ts1 - OFF');
      expect(reduced[1].target).toBe('s1:ts1 - ON');
      expect(reduced[0].datapoints).toEqual([
        [100, 1000],
        [50, 2000],
      ]);
      expect(reduced[1].datapoints).toEqual([
        [200, 1000],
        [0, 2000],
      ]);
    });

    it('replaces {{$state}} with state label only (no base suffix)', () => {
      const target = {
        tab: Tab.CogniteTimeSeriesSearch,
        aggregation: 'stateDuration',
        cogniteTimeSeries: {
          ...defaultCogniteTimeSeries,
          type: 'state' as const,
          instanceId: { space: 's1', externalId: 'ts1' },
        },
      };

      const metaResponses: any[] = [
        {
          result: {
            data: {
              items: [
                {
                  id: 1,
                  datapoints: [
                    {
                      timestamp: 1000,
                      stateAggregates: [
                        { numericValue: 0, stringValue: 'OFF', stateDuration: 1 },
                        { numericValue: 1, stringValue: 'ON', stateDuration: 2 },
                      ],
                    },
                  ],
                },
              ],
            },
            config: { data: { aggregates: 'stateDuration' } },
          },
          metadata: {
            labels: ['{{$state}}'],
            target,
            type: 'data',
          },
        },
      ];

      const reduced = reduceTimeseries(metaResponses, [0, 5000]);
      expect(reduced.map((s) => s.target)).toEqual(['OFF', 'ON']);
    });

    it('embeds {{$state}} inside a custom label without extra " - "', () => {
      const target = {
        tab: Tab.CogniteTimeSeriesSearch,
        aggregation: 'stateDuration',
        cogniteTimeSeries: {
          ...defaultCogniteTimeSeries,
          type: 'state' as const,
          instanceId: { space: 's1', externalId: 'ts1' },
        },
      };

      const metaResponses: any[] = [
        {
          result: {
            data: {
              items: [
                {
                  id: 1,
                  datapoints: [
                    {
                      timestamp: 1000,
                      stateAggregates: [
                        { numericValue: 0, stringValue: 'OFF', stateDuration: 1 },
                        { numericValue: 1, stringValue: 'ON', stateDuration: 2 },
                      ],
                    },
                  ],
                },
              ],
            },
            config: { data: { aggregates: 'stateDuration' } },
          },
          metadata: {
            labels: ['Status: {{$state}}'],
            target,
            type: 'data',
          },
        },
      ];

      const reduced = reduceTimeseries(metaResponses, [0, 5000]);
      expect(reduced.map((s) => s.target)).toEqual(['Status: OFF', 'Status: ON']);
    });

    it('does not append " - <state>" when user provided a custom Label without {{$state}}', () => {
      const target = {
        tab: Tab.CogniteTimeSeriesSearch,
        aggregation: 'stateDuration',
        label: '{{name}}',
        cogniteTimeSeries: {
          ...defaultCogniteTimeSeries,
          type: 'state' as const,
          instanceId: { space: 's1', externalId: 'ts1' },
        },
      };

      const metaResponses: any[] = [
        {
          result: {
            data: {
              items: [
                {
                  id: 1,
                  datapoints: [
                    {
                      timestamp: 1000,
                      stateAggregates: [
                        { numericValue: 0, stringValue: 'OFF', stateDuration: 1 },
                        { numericValue: 1, stringValue: 'ON', stateDuration: 2 },
                      ],
                    },
                  ],
                },
              ],
            },
            config: { data: { aggregates: 'stateDuration' } },
          },
          metadata: {
            labels: ['Pump'],
            target,
            type: 'data',
          },
        },
      ];

      const reduced = reduceTimeseries(metaResponses, [0, 5000]);
      expect(reduced.map((s) => s.target)).toEqual(['Pump', 'Pump']);
    });

    it('always uses string state name in suffix, even when displayAsNumeric is set', () => {
      const target = {
        tab: Tab.CogniteTimeSeriesSearch,
        aggregation: 'stateDuration',
        cogniteTimeSeries: {
          ...defaultCogniteTimeSeries,
          type: 'state' as const,
          instanceId: { space: 's1', externalId: 'ts1' },
          displayAsNumeric: true,
        },
      };

      const metaResponses: any[] = [
        {
          result: {
            data: {
              items: [
                {
                  id: 1,
                  datapoints: [
                    {
                      timestamp: 1000,
                      stateAggregates: [
                        { numericValue: 1, stringValue: 'ON', stateDuration: 5 },
                        { numericValue: 0, stringValue: 'OFF', stateDuration: 3 },
                      ],
                    },
                  ],
                },
              ],
            },
            config: { data: { aggregates: 'stateDuration' } },
          },
          metadata: {
            labels: ['base'],
            target,
            type: 'data',
          },
        },
      ];

      const [a, b] = reduceTimeseries(metaResponses, [0, 5000]);
      expect(a.target).toBe('base - OFF');
      expect(b.target).toBe('base - ON');
    });

    it('pulls stateCount from each state entry', () => {
      const target = {
        tab: Tab.CogniteTimeSeriesSearch,
        aggregation: 'stateCount',
        cogniteTimeSeries: {
          ...defaultCogniteTimeSeries,
          type: 'state' as const,
          instanceId: { space: 's1', externalId: 'ts1' },
        },
      };

      const metaResponses: any[] = [
        {
          result: {
            data: {
              items: [
                {
                  id: 1,
                  datapoints: [
                    {
                      timestamp: 500,
                      stateAggregates: [
                        { numericValue: 0, stringValue: 'A', stateCount: 2 },
                        { numericValue: 2, stringValue: 'B', stateCount: 7 },
                      ],
                    },
                  ],
                },
              ],
            },
            config: { data: { aggregates: 'stateCount' } },
          },
          metadata: {
            labels: ['lbl'],
            target,
            type: 'data',
          },
        },
      ];

      const out = reduceTimeseries(metaResponses, [0, 1000]);
      expect(out).toHaveLength(2);
      expect(out.map((s) => s.target)).toEqual(['lbl - A', 'lbl - B']);
      expect(out[0].datapoints).toEqual([[2, 500]]);
      expect(out[1].datapoints).toEqual([[7, 500]]);
    });
  });

  describe('concurrent', () => {
    it('should return failures and successes', async () => {
      const queries = [0, 1, 2, 3];
      const results = await concurrent(queries, async (number) => {
        if (number % 2) {
          return new Err(number);
        }
        return new Ok(number);
      });
      expect(results).toEqual({
        succeded: [0, 2],
        failed: [1, 3],
      });
    });
  });

  describe('label contains {{}}', () => {
    test('{{prop}}', () => {
      expect(labelContainsVariableProps('anything {{prop}}')).toEqual(true);
    });

    test('{{id}}', () => {
      expect(labelContainsVariableProps('{{id}}')).toEqual(true);
    });

    test('no props', () => {
      expect(labelContainsVariableProps('pure text')).toEqual(false);
    });
  });

  describe('CogniteTimeSeriesSearch label interpolation', () => {
    it('interpolates fields, JSONifies objects, invalid root, null, nested typos', () => {
      const props = {
        space: 'inst_s',
        externalId: 'inst_e',
        name: 'TS-A',
        unit: { externalId: 'kg' },
        nullableField: null,
        nested: { ok: 1 },
      };
      const viewProps = ['name', 'unit', 'nullableField', 'nested'];

      const out = interpolateCogniteTimeSeriesInstanceLabel(
        '{{name}} | {{nope}} | {{unit}} | {{nullableField}} | {{nested.bad}} | {{nested.ok}}',
        props,
        viewProps
      );

      expect(out).toBe('TS-A | :nope | {"externalId":"kg"} | null | :nested.bad | 1');
    });

    it('allows {{space}} and {{externalId}} from instance node', () => {
      const props = { space: 'inst_s', externalId: 'inst_e', name: 'N' };
      const viewProps = ['name'];

      const out = interpolateCogniteTimeSeriesInstanceLabel(
        '{{space}}/{{externalId}}/{{name}}',
        props,
        viewProps
      );

      expect(out).toBe('inst_s/inst_e/N');
    });

    it('preserves reserved {{$state}} through interpolation alongside view props', () => {
      const props = { space: 'inst_s', externalId: 'inst_e', name: 'Pump' };
      const viewProps = ['name'];

      const out = interpolateCogniteTimeSeriesInstanceLabel(
        '{{name}} {{$state}}',
        props,
        viewProps
      );

      expect(out).toBe('Pump {{$state}}');
    });
  });

  describe('convert items to table', () => {
    test('date and null values', () => {
      const items = [
        { id: 1, name: 'name1', metadata: { prop: 1 }, startTime: 100 },
        { id: 2, name: 'name2' },
      ];
      const columns = ['name', 'metadata.prop', 'startTime'];
      const table = convertItemsToTable(items, columns, "table");
      expect(table).toEqual({
        rows: [
          ['name1', 1, new Date(100)],
          ['name2', undefined, undefined],
        ],
        type: 'table',
        name: "table",
        columns: [
          {
            text: 'name',
          },
          {
            text: 'metadata.prop',
          },
          {
            text: 'startTime',
          },
        ],
      });
    });
  });
});
