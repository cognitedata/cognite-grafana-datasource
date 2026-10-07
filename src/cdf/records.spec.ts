import { FieldType } from '@grafana/data';
import {
  buildFilter,
  buildRecordsAggregateRequest,
  buildRecordsFilterRequest,
  buildRequestPreviewParts,
  buildSort,
  unmappedSortRows,
  deriveResultShape,
  formatDurationHuman,
  computeAutoInterval,
  formatFixedInterval,
  normalizeInterval,
  operatorsForType,
  parseIsoDurationMs,
  recordsAggregateToDataFrames,
  recordsToDataFrame,
  resolveTimeWindow,
  validateMetricName,
} from '../cdf/records';
import { RecordsQuery } from '../types';
import { RecordViewDefinition } from '../types/records';

const view = {
  space: 'alarm_schema',
  externalId: 'AlarmEvent',
  version: 'v1',
  streamId: 'alarms_live',
};

const viewPath = (prop: string) => ['alarm_schema', 'AlarmEvent/v1', prop];

const baseQuery = (overrides: Partial<RecordsQuery> = {}): RecordsQuery => ({
  view,
  mode: 'list',
  filters: [],
  sort: [],
  limit: 1000,
  columns: [],
  buckets: [],
  metrics: [],
  timeFilterMode: 'dashboard',
  ...overrides,
});

const RANGE: [number, number] = [1756112400000, 1756198800000];


describe('records request builders', () => {
  describe('buildFilter', () => {
    it('builds a single leaf without wrapping it in "and"', () => {
      const filter = buildFilter(
        baseQuery({
          filters: [
            { property: 'severity', propertyType: 'enum', operator: 'in', values: ['Critical', 'High'] },
          ],
        })
      );
      expect(filter).toEqual({
        in: { property: viewPath('severity'), values: ['Critical', 'High'] },
      });
    });

    it('wraps a negated row in "not", whatever its operator', () => {
      const cases = [
        [
          { property: 'severity', propertyType: 'enum', operator: 'equals', value: 'Critical', negate: true },
          { not: { equals: { property: viewPath('severity'), value: 'Critical' } } },
        ],
        [
          { property: 'severity', propertyType: 'enum', operator: 'in', values: ['High'], negate: true },
          { not: { in: { property: viewPath('severity'), values: ['High'] } } },
        ],
        [
          { property: 'comment', propertyType: 'text', operator: 'exists', negate: true },
          { not: { exists: { property: viewPath('comment') } } },
        ],
        [
          { property: 'message', propertyType: 'text', operator: 'prefix', value: 'Compressor', negate: true },
          { not: { prefix: { property: viewPath('message'), value: 'Compressor' } } },
        ],
        [
          { property: 'severity', propertyType: 'int64', operator: 'range', gte: '70', negate: true },
          { not: { range: { property: viewPath('severity'), gte: 70 } } },
        ],
      ] as const;
      cases.forEach(([row, expected]) => {
        expect(buildFilter(baseQuery({ filters: [row as any] }))).toEqual(expected);
      });
    });

    it('keeps negated and plain rows AND-joined side by side', () => {
      const filter = buildFilter(
        baseQuery({
          filters: [
            { property: 'severity', propertyType: 'enum', operator: 'equals', value: 'Critical' },
            { property: 'message', propertyType: 'text', operator: 'prefix', value: 'Test', negate: true },
          ],
        })
      );
      expect(filter).toEqual({
        and: [
          { equals: { property: viewPath('severity'), value: 'Critical' } },
          { not: { prefix: { property: viewPath('message'), value: 'Test' } } },
        ],
      });
    });

    it('skips an incomplete negated row instead of sending "not nothing"', () => {
      const filter = buildFilter(
        baseQuery({
          filters: [{ property: 'severity', propertyType: 'enum', operator: 'equals', negate: true }],
        })
      );
      expect(filter).toBeUndefined();
    });

    it('combines multiple rows with "and"', () => {
      const filter = buildFilter(
        baseQuery({
          filters: [
            { property: 'severity', propertyType: 'enum', operator: 'equals', value: 'Critical' },
            { property: 'message', propertyType: 'text', operator: 'prefix', value: 'Overpressure' },
          ],
        })
      );
      expect(filter).toEqual({
        and: [
          { equals: { property: viewPath('severity'), value: 'Critical' } },
          { prefix: { property: viewPath('message'), value: 'Overpressure' } },
        ],
      });
    });

    it('coerces numeric and boolean values by property type', () => {
      const filter = buildFilter(
        baseQuery({
          filters: [
            { property: 'value', propertyType: 'float64', operator: 'range', gte: '4.5', lte: '12' },
            { property: 'acknowledged', propertyType: 'boolean', operator: 'equals', value: 'false' },
          ],
        })
      );
      expect(filter).toEqual({
        and: [
          { range: { property: viewPath('value'), gte: 4.5, lte: 12 } },
          { equals: { property: viewPath('acknowledged'), value: false } },
        ],
      });
    });

    it('passes an instance reference through as a node reference', () => {
      const filter = buildFilter(
        baseQuery({
          filters: [
            {
              property: 'asset',
              propertyType: 'direct',
              operator: 'equals',
              // externalIds may contain colons, which is why the encoding is JSON
              value: '{"space":"my_space","externalId":"asset:equip:pump-001"}',
            },
          ],
        })
      );
      expect(filter).toEqual({
        equals: {
          property: viewPath('asset'),
          value: { space: 'my_space', externalId: 'asset:equip:pump-001' },
        },
      });
    });

    it('reports a malformed reference instead of querying for nothing', () => {
      // The API answers a malformed reference with 200 and zero rows, so this has to
      // fail loudly or the user just sees an empty panel.
      const build = (value: string) =>
        buildFilter(
          baseQuery({
            filters: [{ property: 'asset', propertyType: 'direct', operator: 'equals', value }],
          })
        );
      expect(() => build('my_space:pump-001')).toThrow(/asset/);
      expect(() => build('my_space:pump-001')).toThrow(/instance reference/);
      expect(() => build('{"space":"my_space"}')).toThrow(/instance reference/);
      expect(() => build('not json')).toThrow(/instance reference/);
    });

    it('drops extra keys, which the API would reject', () => {
      const filter = buildFilter(
        baseQuery({
          filters: [
            {
              property: 'asset',
              propertyType: 'direct',
              operator: 'equals',
              value: '{"space":"s","externalId":"e","name":"Pump 1"}',
            },
          ],
        })
      );
      expect(filter).toEqual({
        equals: { property: viewPath('asset'), value: { space: 's', externalId: 'e' } },
      });
    });

    it('expands each reference of an "is any of" row', () => {
      const filter = buildFilter(
        baseQuery({
          filters: [
            {
              property: 'asset',
              propertyType: 'direct',
              operator: 'in',
              values: [
                '{"space":"s","externalId":"a"}',
                '{"space":"s","externalId":"b"}',
              ],
            },
          ],
        })
      );
      expect(filter).toEqual({
        in: {
          property: viewPath('asset'),
          values: [
            { space: 's', externalId: 'a' },
            { space: 's', externalId: 'b' },
          ],
        },
      });
    });

    it('sends timestamp range bounds in the form each property takes', () => {
      const filter = buildFilter(
        baseQuery({
          filters: [
            // $__from / $__to interpolate to epoch-ms digits
            { property: 'createdTime', propertyType: 'timestamp', operator: 'range', gte: '1756112400000' },
            { property: 'raisedAt', propertyType: 'timestamp', operator: 'range', lte: '1756198800000' },
          ],
        })
      );
      expect(filter).toEqual({
        and: [
          { range: { property: ['createdTime'], gte: 1756112400000 } },
          { range: { property: viewPath('raisedAt'), lte: '2025-08-26T09:00:00.000Z' } },
        ],
      });
    });

    it('skips incomplete rows so a half-edited filter cannot break the panel', () => {
      const filter = buildFilter(
        baseQuery({
          filters: [
            { property: '', operator: 'equals', value: 'x' },
            { property: 'severity', operator: 'equals', value: '' },
            { property: 'source', operator: 'in', values: [] },
            { property: 'message', propertyType: 'text', operator: 'exists' },
          ],
        })
      );
      expect(filter).toEqual({ exists: { property: viewPath('message') } });
    });

    it('returns undefined when no row is complete', () => {
      expect(buildFilter(baseQuery({ filters: [{ property: '', operator: 'equals' }] }))).toBeUndefined();
    });
  });

  describe('buildSort', () => {
    const viewDef = {
      properties: {
        timestamp: {
          type: { type: 'timestamp' },
          container: { type: 'container', space: 'alarm_schema', externalId: 'alarm_common' },
          containerPropertyIdentifier: 'startTime',
        },
      },
    } as unknown as RecordViewDefinition;

    it('uses the container path stored on the row, not the view path', () => {
      const sort = buildSort([
        {
          property: 'timestamp',
          direction: 'desc',
          containerSpace: 'alarm_schema',
          containerExternalId: 'alarm_common',
          containerPropertyIdentifier: 'startTime',
        },
      ]);
      expect(sort).toEqual([
        { property: ['alarm_schema', 'alarm_common', 'startTime'], direction: 'descending' },
      ]);
    });

    it('drops a row with no stored container mapping, and reports it', () => {
      // Resolving from a view definition here would make the request preview
      // disagree with the request sent, since the datasource has no view definition.
      const unmapped = [{ property: 'timestamp', direction: 'asc' as const }];
      expect(buildSort(unmapped)).toBeUndefined();
      expect(unmappedSortRows(unmapped)).toEqual(['timestamp']);
    });

    it('does not report top-level properties, which need no mapping', () => {
      expect(unmappedSortRows([{ property: 'createdTime', direction: 'asc' }])).toEqual([]);
    });

    it('drops rows whose container mapping cannot be resolved', () => {
      expect(buildSort([{ property: 'unknown', direction: 'asc' }])).toBeUndefined();
    });
  });

  describe('buildRecordsFilterRequest', () => {
    it('binds the dashboard range to lastUpdatedTime and requests all properties', () => {
      const request = buildRecordsFilterRequest(baseQuery(), RANGE);
      expect(request.lastUpdatedTime).toEqual({ gte: RANGE[0], lte: RANGE[1] });
      expect(request.sources).toEqual([
        {
          source: { type: 'view', space: 'alarm_schema', externalId: 'AlarmEvent', version: 'v1' },
          properties: ['*'],
        },
      ]);
      expect(request.includeTyping).toBe(true);
    });

    it('omits lastUpdatedTime when the range is not bound', () => {
      const request = buildRecordsFilterRequest(baseQuery({ timeFilterMode: 'none' }), RANGE);
      expect(request.lastUpdatedTime).toBeUndefined();
    });

    it('sends the selected columns when the user picked any', () => {
      const request = buildRecordsFilterRequest(
        baseQuery({ columns: ['severity', 'message'] }),
        RANGE
      );
      expect(request.sources[0].properties).toEqual(['severity', 'message']);
    });

    it('clamps the limit to the API maximum', () => {
      expect(buildRecordsFilterRequest(baseQuery({ limit: 5000 }), RANGE).limit).toBe(1000);
      expect(buildRecordsFilterRequest(baseQuery({ limit: 10 }), RANGE).limit).toBe(10);
    });
  });

  describe('top-level record properties', () => {
    it('references them with a single-segment path, not a view path', () => {
      const filter = buildFilter(
        baseQuery({
          filters: [
            { property: 'space', propertyType: 'text', operator: 'equals', value: 'my_space' },
            { property: 'externalId', propertyType: 'text', operator: 'prefix', value: 'alarm-' },
          ],
        })
      );
      expect(filter).toEqual({
        and: [
          { equals: { property: ['space'], value: 'my_space' } },
          { prefix: { property: ['externalId'], value: 'alarm-' } },
        ],
      });
    });

    it('never sends them as selected properties, since the API 400s on reserved ids', () => {
      // The API rejects reserved identifiers in sources[].properties and returns them
      // on every record regardless, so selecting one must not reach the request.
      const request = buildRecordsFilterRequest(
        baseQuery({ columns: ['severity', 'externalId', 'lastUpdatedTime'] }),
        RANGE
      );
      expect(request.sources[0].properties).toEqual(['severity']);

      // Selecting only top-level properties falls back to every view property
      const onlyTopLevel = buildRecordsFilterRequest(
        baseQuery({ columns: ['externalId', 'space'] }),
        RANGE
      );
      expect(onlyTopLevel.sources[0].properties).toEqual(['*']);
    });

    it('sorts on them directly, with no container resolution', () => {
      expect(buildSort([{ property: 'createdTime', direction: 'desc' }])).toEqual([
        { property: ['createdTime'], direction: 'descending' },
      ]);
    });

    it('offers only the operators the API accepts for each one', () => {
      // exists / containsAll / containsAny are container-only
      expect(operatorsForType('text', false, 'space')).toEqual(['equals', 'in', 'prefix']);
      expect(operatorsForType('text', false, 'externalId')).toEqual(['equals', 'in', 'prefix']);
      expect(operatorsForType('timestamp', false, 'createdTime')).toEqual([
        'range',
        'equals',
        'in',
      ]);
      // A view property of the same type still gets the full set
      expect(operatorsForType('text', false, 'message')).toContain('exists');
    });

    it('buckets a time histogram on createdTime', () => {
      const { request } = buildRecordsAggregateRequest(
        baseQuery({
          mode: 'aggregate',
          buckets: [{ kind: 'timeHistogram', property: 'createdTime', interval: '1h' }],
          metrics: [{ name: 'count', function: 'count' }],
        }),
        RANGE
      );
      expect((request.aggregates.bucket_0 as any).timeHistogram.property).toEqual([
        'createdTime',
      ]);
    });

    it('groups uniqueValues by space', () => {
      const { request } = buildRecordsAggregateRequest(
        baseQuery({
          mode: 'aggregate',
          buckets: [{ kind: 'uniqueValues', property: 'space', size: 5 }],
          metrics: [{ name: 'count', function: 'count' }],
        }),
        RANGE
      );
      expect((request.aggregates.bucket_0 as any).uniqueValues.property).toEqual(['space']);
    });
  });

  describe('time filter modes', () => {
    const withMode = (over: Partial<RecordsQuery>) =>
      baseQuery({ mode: 'aggregate', metrics: [{ name: 'c', function: 'count' }], ...over });

    it('uses the dashboard range by default', () => {
      expect(resolveTimeWindow(withMode({}), RANGE)).toEqual({ gte: RANGE[0], lte: RANGE[1] });
    });

    it('omits the window entirely in "none" mode', () => {
      expect(resolveTimeWindow(withMode({ timeFilterMode: 'none' }), RANGE)).toBeUndefined();
    });

  });

  describe('buildRecordsAggregateRequest', () => {
    it('resolves an auto interval and bounds the histogram to the panel window', () => {
      const { request } = buildRecordsAggregateRequest(
        baseQuery({
          mode: 'aggregate',
          buckets: [{ kind: 'timeHistogram', property: 'timestamp', interval: 'auto' }],
          metrics: [{ name: 'count', function: 'count' }],
        }),
        RANGE,
        { maxDataPoints: 100 }
      );
      const hist = (request.aggregates.bucket_0 as any).timeHistogram;
      expect(hist.fixedInterval).toMatch(/^[1-9][0-9]*(ms|s|m|h|d)$/);
      // Without bounds an open-ended property blows past the bucket ceiling
      expect(hist.hardBounds).toEqual({
        min: new Date(RANGE[0]).toISOString(),
        max: new Date(RANGE[1]).toISOString(),
      });
    });

    it('sends a unique-values size the API accepts', () => {
      const sizes = [20000, 0, -5, 2.7, 25].map((size) => {
        const { request } = buildRecordsAggregateRequest(
          baseQuery({
            mode: 'aggregate',
            buckets: [{ kind: 'uniqueValues', property: 'severity', size }],
            metrics: [{ name: 'count', function: 'count' }],
          }),
          RANGE
        );
        return (request.aggregates.bucket_0 as any).uniqueValues.size;
      });
      // Above 10,000 the API answers "Size is too large"
      expect(sizes).toEqual([10000, 10, 10, 2, 25]);
    });

    it('honours an explicit interval instead of deriving one', () => {
      const { request } = buildRecordsAggregateRequest(
        baseQuery({
          mode: 'aggregate',
          buckets: [{ kind: 'timeHistogram', property: 'timestamp', interval: '15m' }],
          metrics: [{ name: 'count', function: 'count' }],
        }),
        RANGE,
        { maxDataPoints: 100 }
      );
      expect((request.aggregates.bucket_0 as any).timeHistogram.fixedInterval).toBe('15m');
    });

    it('omits hardBounds when the time range is not bound', () => {
      const { request } = buildRecordsAggregateRequest(
        baseQuery({
          mode: 'aggregate',
          timeFilterMode: 'none',
          buckets: [{ kind: 'timeHistogram', property: 'timestamp', interval: '1h' }],
          metrics: [{ name: 'count', function: 'count' }],
        }),
        RANGE
      );
      expect((request.aggregates.bucket_0 as any).timeHistogram.hardBounds).toBeUndefined();
    });

    it('nests buckets outermost-first with the metrics at the innermost level', () => {
      const { request } = buildRecordsAggregateRequest(
        baseQuery({
          mode: 'aggregate',
          buckets: [
            { kind: 'timeHistogram', property: 'timestamp', interval: '1h' },
            { kind: 'uniqueValues', property: 'severity', size: 10 },
          ],
          metrics: [
            { name: 'alarmCount', function: 'count' },
            { name: 'avgPressure', function: 'avg', property: 'value' },
          ],
        }),
        RANGE
      );

      expect(request.aggregates).toEqual({
        bucket_0: {
          timeHistogram: {
            property: viewPath('timestamp'),
            fixedInterval: '1h',
            hardBounds: {
              min: new Date(RANGE[0]).toISOString(),
              max: new Date(RANGE[1]).toISOString(),
            },
            aggregates: {
              bucket_1: {
                uniqueValues: {
                  property: viewPath('severity'),
                  size: 10,
                  aggregates: {
                    alarmCount: { count: {} },
                    avgPressure: { avg: { property: viewPath('value') } },
                  },
                },
              },
            },
          },
        },
      });
    });

    it('keeps a time bucket with an invalid interval in the tree, at the auto interval', () => {
      // The response walker finds levels by index: a dropped level would misalign it
      // and lose every level below.
      const { request, warnings } = buildRecordsAggregateRequest(
        baseQuery({
          mode: 'aggregate',
          buckets: [
            { kind: 'timeHistogram', property: 'raisedAt', interval: '1.5h' },
            { kind: 'uniqueValues', property: 'site', size: 10 },
          ],
          metrics: [{ name: 'n', function: 'count' }],
        }),
        RANGE,
        { maxDataPoints: 100 }
      );
      const outer = (request.aggregates as any).bucket_0;
      expect(outer.timeHistogram.fixedInterval).toBe(computeAutoInterval(RANGE[1] - RANGE[0], 100));
      expect(outer.timeHistogram.aggregates.bucket_1.uniqueValues.property).toEqual(viewPath('site'));
      expect(warnings.join(' ')).toMatch(/1\.5h.*\(auto\) instead/);
    });

    it('warns and skips metrics with invalid names', () => {
      const { request, warnings } = buildRecordsAggregateRequest(
        baseQuery({
          mode: 'aggregate',
          metrics: [
            { name: '_count', function: 'count' },
            { name: 'ok', function: 'count' },
          ],
        }),
        RANGE
      );
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('_count');
      expect(Object.keys(request.aggregates)).toEqual(['ok']);
    });

    it('warns and skips a metric that needs a property but has none', () => {
      const { warnings } = buildRecordsAggregateRequest(
        baseQuery({ mode: 'aggregate', metrics: [{ name: 'avgX', function: 'avg' }] }),
        RANGE
      );
      expect(warnings[0]).toContain('requires a property');
    });

    it('falls back to a count aggregate when no metric survives', () => {
      const { request } = buildRecordsAggregateRequest(
        baseQuery({ mode: 'aggregate', metrics: [] }),
        RANGE
      );
      expect(request.aggregates).toEqual({ count: { count: {} } });
    });
  });

  describe('helpers', () => {
    it('normalizes intervals the API does not accept directly', () => {
      // The API rejects w/M/y outright: [1-9][0-9]*(ms|s|m|h|d)
      expect(normalizeInterval('1h')).toEqual({ interval: '1h' });
      expect(normalizeInterval('2w')).toEqual({ interval: '14d' });
      expect(normalizeInterval('1y')).toEqual({ interval: '365d' });
      expect(normalizeInterval('bogus').warning).toBeDefined();
      expect(normalizeInterval('').warning).toBeDefined();
      expect(normalizeInterval('0s').warning).toBeDefined();
    });

    it('formats durations with the largest unit that divides evenly', () => {
      expect(formatFixedInterval(1000)).toBe('1s');
      expect(formatFixedInterval(90 * 1000)).toBe('90s');
      expect(formatFixedInterval(15 * 60 * 1000)).toBe('15m');
      expect(formatFixedInterval(6 * 3600 * 1000)).toBe('6h');
      expect(formatFixedInterval(7 * 24 * 3600 * 1000)).toBe('7d');
      expect(formatFixedInterval(250)).toBe('250ms');
    });

    it('derives an auto interval that scales with the time range', () => {
      const HOUR = 3600 * 1000;
      // Every result must satisfy the API grammar
      const grammar = /^[1-9][0-9]*(ms|s|m|h|d)$/;
      [1 * HOUR, 6 * HOUR, 24 * HOUR, 30 * 24 * HOUR, 365 * 24 * HOUR].forEach(
        (span) => {
          const interval = computeAutoInterval(span, 1000);
          expect(interval).toMatch(grammar);
        }
      );

      // Wider range -> coarser bucket
      const oneHour = computeAutoInterval(HOUR, 1000);
      const oneYear = computeAutoInterval(365 * 24 * HOUR, 1000);
      expect(oneHour).not.toEqual(oneYear);
      expect(normalizeInterval(oneHour).interval).toBeDefined();
      expect(normalizeInterval(oneYear).interval).toBeDefined();
    });

    it('never asks for more buckets than the API allows', () => {
      const HOUR = 3600 * 1000;
      const unitMs: Record<string, number> = {
        ms: 1, s: 1000, m: 60000, h: 3600000, d: 86400000,
      };
      const toMs = (v: string) => {
        const [, n, u] = /^([0-9]+)(ms|s|m|h|d)$/.exec(v)!;
        return Number(n) * unitMs[u];
      };
      // Even with an absurd resolution request, stay under the ceiling
      [HOUR, 24 * HOUR, 365 * 24 * HOUR, 10 * 365 * 24 * HOUR].forEach((span) => {
        const interval = computeAutoInterval(span, 1_000_000);
        expect(span / toMs(interval)).toBeLessThanOrEqual(10000);
      });
    });

    it('validates aggregate identifiers against the API rules', () => {
      expect(validateMetricName('alarmCount')).toBeNull();
      expect(validateMetricName('')).toBe('Name is required');
      expect(validateMetricName('a.b')).toContain('cannot contain');
      expect(validateMetricName('_count')).toContain('reserved');
      expect(validateMetricName('dup', ['dup'])).toBe('Names must be unique');
    });

    it('renders stream limits in human terms rather than ISO-8601', () => {
      expect(formatDurationHuman('PT168H')).toBe('7 days');
      expect(formatDurationHuman('P7D')).toBe('7 days');
      expect(formatDurationHuman('P1Y')).toBe('365 days');
      expect(formatDurationHuman('PT12H')).toBe('12 hours');
      expect(formatDurationHuman('PT1H')).toBe('1 hour');
      expect(formatDurationHuman('PT30M')).toBe('30 minutes');
      // Unparseable input is echoed rather than swallowed
      expect(formatDurationHuman('nonsense')).toBe('nonsense');
      expect(formatDurationHuman(undefined)).toBeUndefined();
    });

    it('parses ISO-8601 durations used by maxFilteringInterval', () => {
      expect(parseIsoDurationMs('P7D')).toBe(7 * 24 * 3600 * 1000);
      expect(parseIsoDurationMs('P1Y')).toBe(365 * 24 * 3600 * 1000);
      expect(parseIsoDurationMs('PT12H')).toBe(12 * 3600 * 1000);
      expect(parseIsoDurationMs('nonsense')).toBeNull();
      expect(parseIsoDurationMs(undefined)).toBeNull();
    });

    it('renders a request preview naming the resolved endpoint', () => {
      const listPreview = buildRequestPreviewParts(baseQuery(), RANGE)!;
      expect(listPreview.path).toBe(
        'POST /api/v1/projects/{project}/streams/alarms_live/records/filter'
      );
      expect(listPreview.body).toContain('"includeTyping": true');

      const aggPreview = buildRequestPreviewParts(
        baseQuery({
          mode: 'aggregate',
          buckets: [{ kind: 'timeHistogram', property: 'timestamp', interval: '1h' }],
          metrics: [{ name: 'alarmCount', function: 'count' }],
        }),
        RANGE
      )!;
      expect(aggPreview.path).toContain('/streams/alarms_live/records/aggregate');
      expect(aggPreview.body).toContain('timeHistogram');
    });

    it('applies the stream rules the datasource applies, so the body is the one sent', () => {
      const immutable = { externalId: 'alarms_live', type: 'Immutable' as const };
      const parts = buildRequestPreviewParts(
        baseQuery({ timeFilterMode: 'none' }),
        RANGE,
        {},
        immutable
      )!;
      // An immutable stream rejects an unbounded request, so the dashboard range is sent.
      expect(JSON.parse(parts.body).lastUpdatedTime).toEqual({ gte: RANGE[0], lte: RANGE[1] });
    });

    it('renders no preview when no view is selected', () => {
      expect(buildRequestPreviewParts(baseQuery({ view: undefined }), RANGE)).toBeNull();
    });

    it('splits the preview into path and body parts', () => {
      const parts = buildRequestPreviewParts(baseQuery(), RANGE)!;
      expect(parts.path).toBe(
        'POST /api/v1/projects/{project}/streams/alarms_live/records/filter'
      );
      // With a project known, the preview shows the URL that will actually be called
      expect(
        buildRequestPreviewParts(baseQuery(), RANGE, { project: 'my-project' })!.path
      ).toBe('POST /api/v1/projects/my-project/streams/alarms_live/records/filter');
      expect(parts.body).toContain('"includeTyping": true');
      expect(parts.error).toBeUndefined();
      expect(buildRequestPreviewParts(baseQuery({ view: undefined }), RANGE)).toBeNull();
    });

    it('offers only operators the API accepts for the property type', () => {
      expect(operatorsForType('enum')).toEqual(['in', 'equals', 'exists']);
      expect(operatorsForType('boolean')).toEqual(['equals', 'exists']);
      expect(operatorsForType('float64')).toContain('range');
      expect(operatorsForType('text')).toContain('prefix');
      expect(operatorsForType('text', true)).toEqual(['containsAny', 'containsAll', 'exists']);
    });
  });
});

describe('moveItem', () => {
  const { moveItem } = jest.requireActual('../components/records/shared');

  it('swaps adjacent items and returns a new array', () => {
    const items = ['a', 'b', 'c'];
    expect(moveItem(items, 1, -1)).toEqual(['b', 'a', 'c']);
    expect(moveItem(items, 1, 1)).toEqual(['a', 'c', 'b']);
    expect(items).toEqual(['a', 'b', 'c']);
  });

  it('is a no-op at the boundaries', () => {
    const items = ['a', 'b'];
    expect(moveItem(items, 0, -1)).toBe(items);
    expect(moveItem(items, 1, 1)).toBe(items);
    expect(moveItem(items, 5, 1)).toBe(items);
  });
});

describe('deriveResultShape', () => {
  it('is single-row with no complete buckets', () => {
    expect(deriveResultShape([])).toEqual({ kind: 'single' });
    expect(
      deriveResultShape([{ kind: 'timeHistogram', property: '', interval: '1h' }])
    ).toEqual({ kind: 'single' });
  });

  it('is a time series when a time bucket exists, labeled by uniqueValues buckets', () => {
    expect(
      deriveResultShape([{ kind: 'timeHistogram', property: 'timestamp', interval: '1h' }])
    ).toEqual({ kind: 'timeseries', seriesBy: [] });
    expect(
      deriveResultShape([
        { kind: 'timeHistogram', property: 'timestamp', interval: '1h' },
        { kind: 'uniqueValues', property: 'severity', size: 10 },
      ])
    ).toEqual({ kind: 'timeseries', seriesBy: ['severity'] });
  });

  it('is a table when only uniqueValues buckets exist', () => {
    expect(
      deriveResultShape([{ kind: 'uniqueValues', property: 'severity', size: 10 }])
    ).toEqual({ kind: 'table', groupBy: ['severity'] });
  });

  it('ignores incomplete rows exactly like the frame converter does', () => {
    expect(
      deriveResultShape([
        { kind: 'timeHistogram', property: '', interval: '1h' },
        { kind: 'uniqueValues', property: 'severity', size: 10 },
      ])
    ).toEqual({ kind: 'table', groupBy: ['severity'] });
  });
});

describe('grouping by a direct relation', () => {
  // uniqueValues bucket values come back as { space, externalId } objects, which
  // used to stringify to "[object Object]" in both series names and table cells.
  const REF_A = { space: 'opcua_alarms', externalId: 'asset:equip:iaa_wh_82ft4657c' };
  const REF_B = { space: 'opcua_alarms', externalId: 'asset:equip:iaa_sep_66ft9834d' };

  const timeSeriesResponse = {
    aggregates: {
      bucket_0: {
        uniqueValueBuckets: [
          {
            value: REF_A,
            aggregates: {
              bucket_1: {
                timeHistogramBuckets: [
                  { intervalStart: '2026-08-27T17:47:20.000Z', aggregates: { count: { count: 1 } } },
                ],
              },
            },
          },
          {
            value: REF_B,
            aggregates: {
              bucket_1: {
                timeHistogramBuckets: [
                  { intervalStart: '2026-08-27T17:47:20.000Z', aggregates: { count: { count: 2 } } },
                ],
              },
            },
          },
        ],
      },
    },
  };

  const timeSeriesQuery = baseQuery({
    mode: 'aggregate',
    buckets: [
      { kind: 'uniqueValues', property: 'assetRef', size: 10 },
      { kind: 'timeHistogram', property: 'Time', interval: 'auto' },
    ],
    metrics: [{ name: 'count', function: 'count' }],
  });

  it('names each series by the relation it groups, not "[object Object]"', () => {
    const frames = recordsAggregateToDataFrames(timeSeriesResponse as any, timeSeriesQuery, 'A');
    const names = frames.map((f) => f.fields[1].config?.displayNameFromDS);
    expect(names).toEqual([
      'opcua_alarms:asset:equip:iaa_wh_82ft4657c · count',
      'opcua_alarms:asset:equip:iaa_sep_66ft9834d · count',
    ]);
    expect(JSON.stringify(names)).not.toContain('[object Object]');
  });

  it('labels the series with the rendered reference', () => {
    const [frame] = recordsAggregateToDataFrames(timeSeriesResponse as any, timeSeriesQuery, 'A');
    expect(frame.fields[1].labels).toEqual({
      assetRef: 'opcua_alarms:asset:equip:iaa_wh_82ft4657c',
    });
  });

  it('renders the reference in a table cell when there is no time bucket', () => {
    const frames = recordsAggregateToDataFrames(
      {
        aggregates: {
          bucket_0: {
            uniqueValueBuckets: [
              { value: REF_A, aggregates: { count: { count: 7 } } },
              { value: REF_B, aggregates: { count: { count: 9 } } },
            ],
          },
        },
      } as any,
      baseQuery({
        mode: 'aggregate',
        buckets: [{ kind: 'uniqueValues', property: 'assetRef', size: 10 }],
        metrics: [{ name: 'count', function: 'count' }],
      }),
      'A'
    );
    const [frame] = frames;
    expect(frame.fields[0].name).toBe('assetRef');
    expect(frame.fields[0].values.toArray()).toEqual([
      'opcua_alarms:asset:equip:iaa_wh_82ft4657c',
      'opcua_alarms:asset:equip:iaa_sep_66ft9834d',
    ]);
    expect(frame.fields[1].values.toArray()).toEqual([7, 9]);
  });

  it('still renders plain scalar bucket values unchanged', () => {
    const frames = recordsAggregateToDataFrames(
      {
        aggregates: {
          bucket_0: {
            uniqueValueBuckets: [
              { value: 'CRITICAL', aggregates: { count: { count: 3 } } },
              { value: 5, aggregates: { count: { count: 4 } } },
            ],
          },
        },
      } as any,
      baseQuery({
        mode: 'aggregate',
        buckets: [{ kind: 'uniqueValues', property: 'severity', size: 10 }],
        metrics: [{ name: 'count', function: 'count' }],
      }),
      'A'
    );
    expect(frames[0].fields[0].values.toArray()).toEqual(['CRITICAL', '5']);
  });
});

describe('aggregate series naming', () => {
  const RESPONSE = {
    typing: {
      alarm_schema: {
        'AlarmEvent/v1': {
          value: { type: { type: 'float64' } },
        },
      },
    },
    aggregates: {
      bucket_0: {
        uniqueValueBuckets: [
          {
            value: 'i=10523',
            aggregates: {
              bucket_1: {
                timeHistogramBuckets: [
                  { intervalStart: '2026-08-25T08:00:00.000Z', aggregates: { duration: { avg: 1835 } } },
                  { intervalStart: '2026-08-25T08:00:10.000Z', aggregates: { duration: { avg: 522 } } },
                ],
              },
            },
          },
          {
            value: 'i=2782',
            aggregates: {
              bucket_1: {
                timeHistogramBuckets: [
                  { intervalStart: '2026-08-25T08:00:00.000Z', aggregates: { duration: { avg: 12 } } },
                ],
              },
            },
          },
        ],
      },
    },
  };
  const QUERY = baseQuery({
    mode: 'aggregate',
    buckets: [
      { kind: 'uniqueValues', property: 'EventType', size: 10 },
      { kind: 'timeHistogram', property: 'Time', interval: 'auto' },
    ],
    metrics: [{ name: 'duration', function: 'avg', property: 'value' }],
  });
  it('names each series once, not once per source of the bucket value', () => {
    // Regression: the frame name and the field labels both carried the bucket value,
    // so Grafana composed "i=10523 duration i=10523".
    const frames = recordsAggregateToDataFrames(RESPONSE as any, QUERY, 'A');
    const names = frames.map((f) => f.fields[1].config?.displayNameFromDS);
    expect(names).toEqual(['i=10523 · duration', 'i=2782 · duration']);
  });

  it('keeps the bucket value as a label for transformations and overrides', () => {
    const [frame] = recordsAggregateToDataFrames(RESPONSE as any, QUERY, 'A');
    expect(frame.fields[1].labels).toEqual({ EventType: 'i=10523' });
  });

  it('uses the metric alone when nothing is grouped', () => {
    const ungrouped = {
      typing: RESPONSE.typing,
      aggregates: {
        bucket_0: {
          timeHistogramBuckets: [
            { intervalStart: '2026-08-25T08:00:00.000Z', aggregates: { duration: { avg: 7 } } },
          ],
        },
      },
    };
    const [frame] = recordsAggregateToDataFrames(
      ungrouped as any,
      baseQuery({
        mode: 'aggregate',
        buckets: [{ kind: 'timeHistogram', property: 'Time', interval: 'auto' }],
        metrics: [{ name: 'duration', function: 'avg', property: 'value' }],
      }),
      'A'
    );
    expect(frame.fields[1].config?.displayNameFromDS).toBe('duration');
    expect(frame.fields[1].labels).toBeUndefined();
  });

});

describe('records response conversion', () => {
  it('flattens view properties into typed frame fields', () => {
    const frame = recordsToDataFrame(
      [
        {
          space: 'my_space',
          externalId: 'alarm-001',
          createdTime: 1756112400000,
          lastUpdatedTime: 1756112400000,
          properties: {
            alarm_schema: {
              'AlarmEvent/v1': {
                severity: 'Critical',
                value: 9.82,
                timestamp: '2026-08-25T08:00:00.000Z',
                asset: { space: 'my_space', externalId: 'pump-001' },
              },
            },
          },
        },
      ],
      {
        alarm_schema: {
          'AlarmEvent/v1': {
            severity: { type: { type: 'enum' } },
            value: { type: { type: 'float64' } },
            timestamp: { type: { type: 'timestamp' } },
            asset: { type: { type: 'direct' } },
          },
        },
      },
      baseQuery({ columns: ['severity', 'value', 'timestamp', 'asset'] }),
      'A'
    );

    const byName = Object.fromEntries(frame.fields.map((f) => [f.name, f]));
    expect(byName.severity.type).toBe(FieldType.string);
    expect(byName.value.type).toBe(FieldType.number);
    expect(byName.timestamp.type).toBe(FieldType.time);
    expect(byName.timestamp.values.get(0)).toBe(
      new Date('2026-08-25T08:00:00.000Z').getTime()
    );
    // Direct relations render as space:externalId rather than [object Object]
    expect(byName.asset.values.get(0)).toBe('my_space:pump-001');
    // Only the selected fields are framed, so unselected record properties stay out
    expect(frame.fields.map((f: any) => f.name)).toEqual([
      'severity',
      'value',
      'timestamp',
      'asset',
    ]);
  });

  it('keeps timestamps in UTC and leaves calendar dates unshifted', () => {
    const frame = recordsToDataFrame(
      [
        {
          space: 's',
          externalId: 'a',
          createdTime: 1,
          lastUpdatedTime: 2,
          properties: {
            alarm_schema: {
              'AlarmEvent/v1': {
                // No offset designator: must still be read as UTC, not browser-local
                naive: '2026-08-25T08:00:00.000',
                zulu: '2026-08-25T08:00:00.000Z',
                day: '2026-08-25',
              },
            },
          },
        },
      ],
      {
        alarm_schema: {
          'AlarmEvent/v1': {
            naive: { type: { type: 'timestamp' } },
            zulu: { type: { type: 'timestamp' } },
            day: { type: { type: 'date' } },
          },
        },
      },
      baseQuery({ columns: ['naive', 'zulu', 'day'] }),
      'A'
    );
    const byName = Object.fromEntries(frame.fields.map((f) => [f.name, f]));
    const utc = Date.UTC(2026, 7, 25, 8, 0, 0);
    expect(byName.naive.values.get(0)).toBe(utc);
    expect(byName.zulu.values.get(0)).toBe(utc);

    // A calendar date has no instant behind it, so typing it as time would make
    // Grafana render the previous day for any viewer west of UTC.
    expect(byName.day.type).toBe(FieldType.string);
    expect(byName.day.values.get(0)).toBe('2026-08-25');
  });

  describe('column selection', () => {
    const ITEMS = [
      {
        space: 's',
        externalId: 'a',
        createdTime: 1756112400000,
        lastUpdatedTime: 1756112400001,
        properties: { alarm_schema: { 'AlarmEvent/v1': { severity: 'High', value: 3 } } },
      },
    ];
    const TYPING = {
      alarm_schema: {
        'AlarmEvent/v1': {
          severity: { type: { type: 'text' } },
          value: { type: { type: 'float64' } },
        },
      },
    };

    it('frames every view property plus the record ones when nothing is selected', () => {
      const frame = recordsToDataFrame(ITEMS, TYPING, baseQuery({ columns: [] }), 'A');
      expect(frame.fields.map((f) => f.name)).toEqual([
        'externalId',
        'space',
        'severity',
        'value',
        'lastUpdatedTime',
        'createdTime',
      ]);
    });

    it('frames exactly the selection, mixing view and record properties', () => {
      const frame = recordsToDataFrame(
        ITEMS,
        TYPING,
        baseQuery({ columns: ['severity', 'externalId', 'createdTime'] }),
        'A'
      );
      // Selection order is honoured, and unselected record properties are dropped
      expect(frame.fields.map((f) => f.name)).toEqual([
        'severity',
        'externalId',
        'createdTime',
      ]);
      const byName = Object.fromEntries(frame.fields.map((f) => [f.name, f]));
      expect(byName.externalId.type).toBe(FieldType.string);
      expect(byName.externalId.values.get(0)).toBe('a');
      expect(byName.createdTime.type).toBe(FieldType.time);
      expect(byName.createdTime.values.get(0)).toBe(1756112400000);
    });

    it('drops record properties from the request while keeping them in the frame', () => {
      const query = baseQuery({ columns: ['severity', 'lastUpdatedTime'] });
      // The API 400s on reserved identifiers, but returns them on every record
      expect(buildRecordsFilterRequest(query, RANGE).sources[0].properties).toEqual([
        'severity',
      ]);
      const frame = recordsToDataFrame(ITEMS, TYPING, query, 'A');
      expect(frame.fields.map((f) => f.name)).toEqual(['severity', 'lastUpdatedTime']);
      expect(frame.fields[1].values.get(0)).toBe(1756112400001);
    });
  });

  it('derives columns from the records when none are selected', () => {
    const frame = recordsToDataFrame(
      [
        {
          space: 's',
          externalId: 'a',
          createdTime: 1,
          lastUpdatedTime: 2,
          properties: { alarm_schema: { 'AlarmEvent/v1': { severity: 'Low' } } },
        },
      ],
      undefined,
      baseQuery(),
      'A'
    );
    expect(frame.fields.map((f) => f.name)).toEqual([
      'externalId',
      'space',
      'severity',
      'lastUpdatedTime',
      'createdTime',
    ]);
  });

  it('emits one labeled time series frame per group-by value', () => {
    const query = baseQuery({
      mode: 'aggregate',
      buckets: [
        { kind: 'timeHistogram', property: 'timestamp', interval: '1h' },
        { kind: 'uniqueValues', property: 'severity', size: 10 },
      ],
      metrics: [{ name: 'alarmCount', function: 'count' }],
    });

    const frames = recordsAggregateToDataFrames(
      {
        aggregates: {
          bucket_0: {
            timeHistogramBuckets: [
              {
                intervalStart: '2026-08-25T08:00:00.000Z',
                count: 51,
                aggregates: {
                  bucket_1: {
                    uniqueValueBuckets: [
                      { value: 'Critical', count: 14, aggregates: { alarmCount: { count: 14 } } },
                      { value: 'High', count: 37, aggregates: { alarmCount: { count: 37 } } },
                    ],
                  },
                },
              },
              {
                intervalStart: '2026-08-25T09:00:00.000Z',
                count: 9,
                aggregates: {
                  bucket_1: {
                    uniqueValueBuckets: [
                      { value: 'Critical', count: 9, aggregates: { alarmCount: { count: 9 } } },
                    ],
                  },
                },
              },
            ],
          },
        },
      },
      query,
      'A'
    );

    expect(frames).toHaveLength(2);
    const critical = frames.find((f) => f.name === 'Critical')!;
    expect(critical.fields[0].type).toBe(FieldType.time);
    expect(critical.fields[0].values.toArray()).toEqual([
      new Date('2026-08-25T08:00:00.000Z').getTime(),
      new Date('2026-08-25T09:00:00.000Z').getTime(),
    ]);
    const countField = critical.fields.find((f) => f.name === 'alarmCount')!;
    expect(countField.values.toArray()).toEqual([14, 9]);
    expect(countField.labels).toEqual({ severity: 'Critical' });
  });

  it('emits a single table frame when there is no time bucket', () => {
    const query = baseQuery({
      mode: 'aggregate',
      buckets: [{ kind: 'uniqueValues', property: 'severity', size: 10 }],
      metrics: [{ name: 'avgPressure', function: 'avg', property: 'value' }],
    });

    const frames = recordsAggregateToDataFrames(
      {
        aggregates: {
          bucket_0: {
            uniqueValueBuckets: [
              { value: 'Critical', count: 14, aggregates: { avgPressure: { avg: 9.8 } } },
              { value: 'High', count: 37, aggregates: { avgPressure: { avg: 6.4 } } },
            ],
          },
        },
      },
      query,
      'A'
    );

    expect(frames).toHaveLength(1);
    const byName = Object.fromEntries(frames[0].fields.map((f) => [f.name, f]));
    expect(byName.severity.values.toArray()).toEqual(['Critical', 'High']);
    expect(byName.avgPressure.values.toArray()).toEqual([9.8, 6.4]);
    // Only the configured metrics become columns
    expect(frames[0].fields.map((f) => f.name)).toEqual(['severity', 'avgPressure']);
  });

  it('renders min and max over a timestamp as time fields', () => {
    const query = baseQuery({
      mode: 'aggregate',
      buckets: [{ kind: 'uniqueValues', property: 'severity', size: 10 }],
      metrics: [
        { name: 'firstSeen', function: 'min', property: 'timestamp' },
        { name: 'lastCreated', function: 'max', property: 'createdTime' },
        { name: 'peak', function: 'max', property: 'value' },
      ],
    });

    const [frame] = recordsAggregateToDataFrames(
      {
        aggregates: {
          bucket_0: {
            uniqueValueBuckets: [
              {
                value: 'Critical',
                count: 14,
                aggregates: {
                  firstSeen: { min: '2026-08-24T12:34:40.000Z' },
                  lastCreated: { max: '2026-09-09T11:01:59.213Z' },
                  peak: { max: 9.8 },
                },
              },
              {
                // No record in this bucket has the property: the API reports 0
                value: 'High',
                count: 3,
                aggregates: {
                  firstSeen: { min: 0 },
                  lastCreated: { max: '2026-09-10T08:00:00.000Z' },
                  peak: { max: 0 },
                },
              },
            ],
          },
        },
        typing: {
          alarm_schema: {
            'AlarmEvent/v1': {
              timestamp: { type: { type: 'timestamp' } },
              value: { type: { type: 'float64' } },
            },
          },
        },
      } as any,
      query,
      'A'
    );

    const byName = Object.fromEntries(frame.fields.map((f) => [f.name, f]));
    expect(byName.firstSeen.type).toBe(FieldType.time);
    expect(byName.firstSeen.values.toArray()).toEqual([
      new Date('2026-08-24T12:34:40.000Z').getTime(),
      null,
    ]);
    expect(byName.lastCreated.type).toBe(FieldType.time);
    expect(byName.lastCreated.values.toArray()).toEqual([
      new Date('2026-09-09T11:01:59.213Z').getTime(),
      new Date('2026-09-10T08:00:00.000Z').getTime(),
    ]);
    // A number stays a number, its empty-bucket 0 included
    expect(byName.peak.type).toBe(FieldType.number);
    expect(byName.peak.values.toArray()).toEqual([9.8, 0]);
  });

  it('renders a timestamp metric as a time field in a time series frame', () => {
    const query = baseQuery({
      mode: 'aggregate',
      buckets: [{ kind: 'timeHistogram', property: 'createdTime', interval: '1d' }],
      metrics: [{ name: 'lastSeen', function: 'max', property: 'lastUpdatedTime' }],
    });

    const [frame] = recordsAggregateToDataFrames(
      {
        aggregates: {
          bucket_0: {
            timeHistogramBuckets: [
              {
                intervalStart: '2026-08-25T00:00:00Z',
                count: 4,
                aggregates: { lastSeen: { max: '2026-08-25T17:30:00.000Z' } },
              },
            ],
          },
        },
      },
      query,
      'A'
    );

    const lastSeen = frame.fields.find((f) => f.name === 'lastSeen')!;
    expect(lastSeen.type).toBe(FieldType.time);
    expect(lastSeen.values.toArray()).toEqual([new Date('2026-08-25T17:30:00.000Z').getTime()]);
  });

  it('emits only the configured metrics, never an extra bucket count', () => {
    const query = baseQuery({
      mode: 'aggregate',
      buckets: [{ kind: 'timeHistogram', property: 'timestamp', interval: '1h' }],
      metrics: [{ name: 'count', function: 'count' }],
    });

    const frames = recordsAggregateToDataFrames(
      {
        aggregates: {
          bucket_0: {
            timeHistogramBuckets: [
              {
                intervalStart: '2026-08-25T08:00:00.000Z',
                count: 2737,
                aggregates: { count: { count: 2737 } },
              },
            ],
          },
        },
      },
      query,
      'A'
    );

    // The bucket also reports count: 2737 — it must not surface as a second column
    expect(frames[0].fields.map((f) => f.name)).toEqual(['time', 'count']);
  });
});
