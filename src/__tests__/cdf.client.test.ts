import { TimeSeries } from '@grafana/data';
import { Err, Ok } from '../types';
import {
  datapoints2Tuples,
  reduceTimeseries,
  labelContainsVariableProps,
  labelReferencesProp,
  interpolateCogniteTimeSeriesInstanceLabel,
  concurrent,
  convertItemsToTable,
  getTimeSeriesPropertiesBatch,
  retryOnTransientError,
} from '../cdf/client';
import { getDataqueryResponse, getMeta } from '../test_utils';

describe('CDF client', () => {
  describe('retryOnTransientError', () => {
    const failing = (status: number) => jest.fn().mockRejectedValue({ status });

    beforeEach(() => jest.spyOn(console, 'warn').mockImplementation(() => undefined));
    afterEach(() => jest.restoreAllMocks());

    it.each([408, 425, 429, 502, 503, 504])(
      'retries a %i and returns the result',
      async (status) => {
        const fn = jest.fn().mockRejectedValueOnce({ status }).mockResolvedValue('ok');
        await expect(retryOnTransientError(fn, 3, 0)).resolves.toBe('ok');
        expect(fn).toHaveBeenCalledTimes(2);
      }
    );

    it('tries a rate limited request up to the maximum, and other failures once more', async () => {
      const limited = failing(429);
      await expect(retryOnTransientError(limited, 2, 0)).rejects.toEqual({ status: 429 });
      expect(limited).toHaveBeenCalledTimes(3);
      const unavailable = failing(503);
      await expect(retryOnTransientError(unavailable, 2, 0)).rejects.toEqual({ status: 503 });
      expect(unavailable).toHaveBeenCalledTimes(2);
    });

    it.each([400, 401, 403, 404, 409, 500, 501, 505])('does not retry a %i', async (status) => {
      const fn = failing(status);
      await expect(retryOnTransientError(fn, 3, 0)).rejects.toEqual({ status });
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('does not retry an error without a status', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('boom'));
      await expect(retryOnTransientError(fn, 3, 0)).rejects.toThrow('boom');
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

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
      const [reduced] = reduceTimeseries(metaResponses, [1549336675000, 1549337275000]) as TimeSeries[];
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
      const [reduced] = reduceTimeseries(metaResponses, [1549337270000, 1549337275000]) as TimeSeries[];
      expect(reduced.datapoints).toEqual([[0, 1549336675000]]);
      expect(reduced.target).toEqual(`${id}`);
    });
  });

  describe('reduce timeseries: the bucket at the range start', () => {
    // CDF aligns a 1h granularity to the hour: a range from 10:30 gets a 10:00 bucket first.
    const [h10, h11, h12] = [36_000_000, 39_600_000, 43_200_000];
    const range: [number, number] = [h10 + 1_800_000, h12];
    const response = (aggregate: string, datapoints: any[]): any => ({
      result: {
        data: { items: [{ id: 1, datapoints }] },
        config: { data: { aggregates: [aggregate], granularity: '1h' } },
      },
      metadata: { labels: ['phase'], type: 'data', kind: 'string', target: { aggregation: aggregate } },
    });

    it('keeps the bucket a string value holds from', () => {
      const [frame] = reduceTimeseries(
        [
          response('interpolation', [
            { timestamp: h10, interpolation: 'IDLE' },
            { timestamp: h11, interpolation: 'FILLING' },
            { timestamp: h12, interpolation: 'HEATING' },
          ]),
        ],
        range
      ) as any[];
      expect(frame.fields[0].values).toEqual([h10, h11, h12]);
      expect(frame.fields[1].values).toEqual(['IDLE', 'FILLING', 'HEATING']);
    });

    it('keeps it for any aggregate, since its interval overlaps the range', () => {
      const [series] = reduceTimeseries(
        [
          response('count', [
            { timestamp: h10, count: 1 },
            { timestamp: h11, count: 2 },
          ]),
        ],
        range
      ) as TimeSeries[];
      expect(series.datapoints).toEqual([[1, h10], [2, h11]]);
    });

    it('drops a bucket that ends before the range', () => {
      const [series] = reduceTimeseries(
        [response('count', [{ timestamp: h10 - 3_600_000, count: 1 }, { timestamp: h11, count: 2 }])],
        range
      ) as TimeSeries[];
      expect(series.datapoints).toEqual([[2, h11]]);
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

    test('tolerates whitespace inside the braces, as the GraphQL tab does', () => {
      expect(labelContainsVariableProps('{{ prop }}')).toEqual(true);
      expect(labelReferencesProp('{{ unit.symbol }}', 'unit')).toEqual(true);
      expect(
        interpolateCogniteTimeSeriesInstanceLabel('{{ name }}', { name: 'TS-A' }, ['name'])
      ).toEqual('TS-A');
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

    it('resolves unit properties injected by the caller, even if absent from the view', () => {
      const props = {
        space: 'inst_s',
        externalId: 'inst_e',
        name: 'TS-A',
        unit: {
          space: 'cdf_cdm_units',
          externalId: 'volume_flow_rate:ft3-per-hr',
          name: 'Cubic Foot Per Hour',
          symbol: 'ft\u00b3/h',
          quantity: 'Volume Flow Rate',
        },
      };

      const out = interpolateCogniteTimeSeriesInstanceLabel(
        '{{name}} - {{unit.symbol}} ({{unit.quantity}})',
        props,
        ['name']
      );

      expect(out).toBe('TS-A - ft\u00b3/h (Volume Flow Rate)');
    });

    it('does not treat inherited object properties as caller-injected props', () => {
      const out = interpolateCogniteTimeSeriesInstanceLabel(
        '{{toString}}/{{constructor}}',
        { name: 'TS-A' },
        ['name']
      );

      expect(out).toBe(':toString/:constructor');
    });

    it('serializes a bare {{unit}} so the available dot-notation props are discoverable', () => {
      const unit = {
        space: 'cdf_cdm_units',
        externalId: 'volume_flow_rate:ft3-per-hr',
        name: 'Cubic Foot Per Hour',
        symbol: 'ft\u00b3/h',
        quantity: 'Volume Flow Rate',
      };

      expect(interpolateCogniteTimeSeriesInstanceLabel('{{unit}}', { unit }, ['unit'])).toBe(
        JSON.stringify(unit)
      );
    });
  });

  describe('labelReferencesProp', () => {
    test.each([
      ['{{unit}}', true],
      ['{{unit.symbol}}', true],
      ['{{name}} - {{unit.symbol}}', true],
      ['{{name}}', false],
      ['{{unitless}}', false],
      ['', false],
    ])('%s -> %s', (label, expected) => {
      expect(labelReferencesProp(label, 'unit')).toBe(expected);
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

describe('reduceTimeseries: the {{state}} label token', () => {
  it('shows as a missing field on a series that is not per state', () => {
    const [series] = reduceTimeseries(
      [
        {
          result: { data: { items: [{ id: 1, datapoints: [{ timestamp: 1, count: 2 }] }] }, config: { data: { aggregates: ['count'] } } },
          metadata: { labels: ['Pump {{state}}'], type: 'data', kind: 'numeric', target: { aggregation: 'count' } },
        } as any,
      ],
      [0, 10]
    ) as TimeSeries[];
    expect(series.target).toBe('Pump :state');
  });
});

describe('getTimeSeriesPropertiesBatch', () => {
  const node = (externalId: string) => ({
    space: 's',
    externalId,
    properties: { cdf_cdm: { 'CogniteTimeSeries/v1': { type: 'string' } } },
  });

  it('looks up every instance once, in pages of 1000, keyed by space and externalId', async () => {
    const fetchItems = jest.fn().mockImplementation(async ({ data }) => data.items.map(({ externalId }: any) => node(externalId)));
    const ids = Array.from({ length: 1001 }, (_, i) => ({ space: 's', externalId: `ts${i}` }));
    const properties = await getTimeSeriesPropertiesBatch({ fetchItems } as any, [...ids, ids[0]]);
    expect(fetchItems.mock.calls.map(([request]) => request.data.items.length)).toEqual([1000, 1]);
    expect(properties.size).toBe(1001);
    expect(properties.get('s:ts1000')).toEqual({ type: 'string', unit: undefined });
  });

  it('asks for the same rows in the same order, however they arrive, so the request is cached', async () => {
    const fetchItems = jest.fn().mockResolvedValue([]);
    const ids = [{ space: 's', externalId: 'b' }, { space: 's', externalId: 'a' }];
    await getTimeSeriesPropertiesBatch({ fetchItems } as any, ids);
    await getTimeSeriesPropertiesBatch({ fetchItems } as any, [...ids].reverse());
    const [first, second] = fetchItems.mock.calls.map(([request]) => request.data);
    expect(first).toEqual(second);
    expect(first.items.map(({ externalId }: any) => externalId)).toEqual(['a', 'b']);
  });

  it('fails when a request fails', async () => {
    const fetchItems = jest.fn().mockRejectedValue(new Error('boom'));
    await expect(getTimeSeriesPropertiesBatch({ fetchItems } as any, [{ space: 's', externalId: 'a' }])).rejects.toThrow(
      'boom'
    );
  });
});
