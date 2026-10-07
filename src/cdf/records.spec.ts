import { FieldType } from '@grafana/data';
import {
  buildFilter,
  buildRecordsFilterRequest,
  buildRequestPreviewParts,
  buildSort,
  unmappedSortRows,
  formatDurationHuman,
  operatorsForType,
  parseIsoDurationMs,
  recordsToDataFrame,
  resolveTimeWindow,
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
  filters: [],
  sort: [],
  limit: 1000,
  columns: [],
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

  });

  describe('time filter modes', () => {
    it('uses the dashboard range by default', () => {
      expect(resolveTimeWindow(baseQuery({}), RANGE)).toEqual({ gte: RANGE[0], lte: RANGE[1] });
    });

    it('omits the window entirely in "none" mode', () => {
      expect(resolveTimeWindow(baseQuery({ timeFilterMode: 'none' }), RANGE)).toBeUndefined();
    });

  });

  describe('helpers', () => {

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

});
