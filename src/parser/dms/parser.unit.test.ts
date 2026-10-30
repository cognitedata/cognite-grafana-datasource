import {
  composeExpression,
  countVariableMatches,
  expandExpression,
  formQueriesForSyntheticQuery,
  getLabelsForSyntheticQuery,
  lockedVariableIndices,
  MAX_SYNTHETIC_FANOUT,
  parseExpression,
  renameVariableInExpression,
  resolveVariables,
  ResolvedVariable,
  toSyntheticGranularity,
  validateExpression,
  variableNamesIn,
} from './index';
import { nextVariableName, RESERVED_VARIABLE_NAMES, validateVariableName } from './variables';
import {
  flattenInstance,
  interpolateCdmSyntheticQuery,
  normalizeCdmSyntheticQuery,
} from '../../cdf/syntheticTimeSeries';
import {
  buildSyntheticQueryRequest,
  countSyntheticReferences,
  SYNTHETIC_ITEMS_PER_REQUEST,
} from '../../cdf/client';
import { CdmSyntheticQuery, SyntheticVariable } from '../../types';
import { DMSInstance } from '../../types/dms';

const view = { space: 'cdf_cdm', externalId: 'CogniteTimeSeries', version: 'v1' };
const viewRef = { type: 'view', ...view };
const viewProp = (prop: string) => ['cdf_cdm', 'CogniteTimeSeries/v1', prop];

const dmsInstance = (externalId: string, props: Record<string, unknown> = {}): DMSInstance => ({
  instanceType: 'node',
  space: 'pumps',
  externalId,
  version: 1,
  createdTime: 0,
  lastUpdatedTime: 0,
  properties: { cdf_cdm: { 'CogniteTimeSeries/v1': props } },
});

const inst = (externalId: string, props: Record<string, unknown> = {}) => ({
  space: 'pumps',
  externalId,
  ...props,
});

const filterVar = (
  name: string,
  filter: string,
  extra: Partial<SyntheticVariable> = {}
): SyntheticVariable => ({
  name,
  mode: 'filter',
  filter,
  ...extra,
});
const instanceVar = (
  name: string,
  externalId: string,
  extra: Partial<SyntheticVariable> = {}
): SyntheticVariable => ({
  name,
  mode: 'instance',
  instance: { space: 'pumps', externalId, name: `Series ${externalId}` },
  ...extra,
});

const aggregateOptions = { datapoints: 'aggregate' as const, granularity: '1h' };
const rawOptions = { datapoints: 'raw' as const, granularity: '1h' };

const resolvedOf = (
  entries: Array<[SyntheticVariable, Array<ReturnType<typeof inst>>]>
): Record<string, ResolvedVariable> =>
  Object.fromEntries(
    entries.map(([variable, instances]) => [variable.name, { variable, instances }])
  );

describe('synthetic request helpers', () => {
  it('counts references past a value ending in a backslash, and honours JSON escapes', () => {
    expect(countSyntheticReferences(`ts{externalId='a\\\\'} + ts{externalId='b'}`)).toEqual(2);
    expect(countSyntheticReferences(`ts{externalId="a\\"'ts{"} + ts{externalId='b'}`)).toEqual(2);
  });

  it('shares datapoints within a request for split queries, and across all otherwise', () => {
    const expressions = Array.from({ length: 100 }, (_, i) => `${i}`);
    const limitOf = (itemsPerRequest?: number) =>
      buildSyntheticQueryRequest(expressions, [0, 1], undefined, itemsPerRequest).items[0].limit;
    expect(limitOf(SYNTHETIC_ITEMS_PER_REQUEST)).toEqual(1000);
    expect(limitOf()).toEqual(100);
  });
});

describe('expression grammar', () => {
  const roundTrip = [
    'A',
    'A * 2',
    'avg(A)',
    'pow(A, B)',
    'B - A + pi()',
    'sum(A) / B',
    '(A + B) * 2',
    'on_error(A, 0)',
    'pump_speed * 1.5',
  ];
  roundTrip.forEach((expression) => {
    it(`round trips: ${expression}`, () => {
      expect(composeExpression(parseExpression(expression))).toEqual(expression);
    });
  });

  it('parses map() with its array arguments', () => {
    expect(composeExpression(parseExpression("map(A, ['on'], [1], 0)"))).toEqual(
      'map(A, ["on"], [1], 0)'
    );
  });

  it('parses a leading unary minus', () => {
    expect(composeExpression(parseExpression('-A + pi()'))).toEqual(' - A + pi()');
  });

  it('parses dashboard variables as template nodes', () => {
    expect(parseExpression('$factor')).toEqual({ type: 'var', name: '$factor', template: true });
    expect(variableNamesIn(parseExpression('$factor * A'))).toEqual(['A']);
  });

  it('rejects every function name as a variable', () => {
    RESERVED_VARIABLE_NAMES.forEach((name) => expect(() => parseExpression(name)).toThrow());
    expect(() => parseExpression('2A')).toThrow();
    expect(() => parseExpression("ts{name='x'}")).toThrow();
  });

  it('lists variable names in order of first occurrence, once', () => {
    expect(variableNamesIn(parseExpression('B - avg(A) + B * C'))).toEqual(['B', 'A', 'C']);
  });

  it('validates syntax without throwing', () => {
    expect(validateExpression('A * 2')).toBeNull();
    expect(validateExpression('A *')).toEqual(
      expect.objectContaining({ message: expect.any(String) })
    );
  });
});

describe('variable names', () => {
  it('validates names', () => {
    expect(validateVariableName('A')).toBeNull();
    expect(validateVariableName('pump_speed')).toBeNull();
    expect(validateVariableName('')).toMatch(/required/);
    expect(validateVariableName('2A')).toMatch(/letters, digits/);
    expect(validateVariableName('a b')).toMatch(/letters, digits/);
    expect(validateVariableName('x'.repeat(33))).toMatch(/32 characters/);
    expect(validateVariableName('avg')).toMatch(/function name/);
    expect(validateVariableName('A', ['A'])).toMatch(/unique/);
    expect(validateVariableName('A', ['a'])).toBeNull();
  });

  it('picks the next free name', () => {
    expect(nextVariableName([])).toEqual('A');
    expect(nextVariableName(['A', 'B'])).toEqual('C');
    expect(nextVariableName(['B'])).toEqual('A');
    expect(nextVariableName('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''))).toEqual('A1');
  });

  it('renames a variable in the expression', () => {
    expect(renameVariableInExpression('A * 2 + avg(A)', 'A', 'pump')).toEqual(
      'pump * 2 + avg(pump)'
    );
    expect(renameVariableInExpression('A*2', 'A', 'B')).toEqual('B * 2');
    expect(renameVariableInExpression('A * 2', 'B', 'C')).toEqual('A * 2');
    expect(renameVariableInExpression('A *', 'A', 'B')).toEqual('A *');
    expect(renameVariableInExpression('$A * A', 'A', 'B')).toEqual('$A * B');
  });
});

describe('flattenInstance', () => {
  it('merges node identity with view properties', () => {
    expect(flattenInstance(dmsInstance('e1', { name: 'Pump 1', isStep: false }), view)).toEqual({
      space: 'pumps',
      externalId: 'e1',
      name: 'Pump 1',
      isStep: false,
    });
  });
});

describe('lockedVariableIndices', () => {
  const locks = (expression: string) => {
    const ast = parseExpression(expression);
    const names = variableNamesIn(ast);
    return lockedVariableIndices(ast, names).map((i) => names[i]);
  };

  it('locks a variable that only appears as the sole argument of a combining function', () => {
    expect(locks('avg(A)')).toEqual(['A']);
    expect(locks('avg(A) + avg(A)')).toEqual(['A']);
    expect(locks('sum(A) / B')).toEqual(['A']);
    expect(locks('max(A) - min(B)')).toEqual(['A', 'B']);
  });

  it('does not lock a variable that also appears bare, or inside an arithmetic argument', () => {
    expect(locks('avg(A) + A')).toEqual([]);
    expect(locks('avg(A * 2)')).toEqual([]);
    expect(locks('pow(A, 2)')).toEqual([]);
    expect(locks('A - B')).toEqual([]);
  });
});

describe('expandExpression', () => {
  it('substitutes a picked series with its aggregate reference', () => {
    const A = instanceVar('A', 'e1');
    const { items, scopes } = expandExpression(
      parseExpression('A * 2'),
      resolvedOf([[A, [inst('e1', { name: 'Series e1' })]]]),
      aggregateOptions
    );
    expect(items).toEqual([
      {
        expression: "ts{space='pumps', externalId='e1', aggregate='average', granularity='1h'} * 2",
      },
    ]);
    expect(scopes).toEqual([{ A: inst('e1', { name: 'Series e1' }) }]);
  });

  it('sends the row aggregate and unit', () => {
    const A = instanceVar('A', 'e1', { aggregate: 'interpolation', targetUnit: 'pressure:bar' });
    const { items } = expandExpression(
      parseExpression('A'),
      resolvedOf([[A, [inst('e1')]]]),
      aggregateOptions
    );
    expect(items[0].expression).toEqual(
      "ts{space='pumps', externalId='e1', aggregate='interpolation', granularity='1h', targetUnit='pressure:bar'}"
    );
  });

  it('raw sends neither aggregate nor granularity, but keeps the unit system', () => {
    const A = filterVar('A', '', { aggregate: 'interpolation', targetUnitSystem: 'SI' });
    const { items } = expandExpression(
      parseExpression('A'),
      resolvedOf([[A, [inst('e1')]]]),
      rawOptions
    );
    expect(items[0].expression).toEqual(
      "ts{space='pumps', externalId='e1', targetUnitSystem='SI'}"
    );
  });

  it('fans out one series per match, sharing the instance across occurrences', () => {
    const A = filterVar('A', 'name^="PT"');
    const { items, scopes } = expandExpression(
      parseExpression('A - A / 2'),
      resolvedOf([[A, [inst('e1'), inst('e2')]]]),
      rawOptions
    );
    expect(items.map(({ expression }) => expression)).toEqual([
      "ts{space='pumps', externalId='e1'} - ts{space='pumps', externalId='e1'} / 2",
      "ts{space='pumps', externalId='e2'} - ts{space='pumps', externalId='e2'} / 2",
    ]);
    expect(scopes.map((scope) => (scope.A as any).externalId)).toEqual(['e1', 'e2']);
  });

  it('refuses an aggregate the synthetic API does not accept', () => {
    const A = instanceVar('A', 'e1');
    expect(() =>
      expandExpression(
        parseExpression('A'),
        resolvedOf([[{ ...A, aggregate: 'max' }, [inst('e1')]]]),
        aggregateOptions
      )
    ).toThrow('Variable A: synthetic time series don\'t support the "max" aggregate.');
    // Raw sends no aggregate, so a saved one does not matter.
    expect(() =>
      expandExpression(
        parseExpression('A'),
        resolvedOf([[{ ...A, aggregate: 'max' }, [inst('e1')]]]),
        rawOptions
      )
    ).not.toThrow();
  });

  it('refuses an expression over the reference cap of one request', () => {
    const many = Array.from({ length: 100 }, (_, i) => inst(`b${i}`));
    expect(() =>
      expandExpression(
        parseExpression('avg(B) - A'),
        resolvedOf([
          [instanceVar('A', 'a1'), [inst('a1')]],
          [filterVar('B', 'name^="B"'), many],
        ]),
        rawOptions
      )
    ).toThrow('The expression uses 101 time series; CDF takes at most 100 per request.');
  });

  it('refuses two variables that each fan out', () => {
    const A = filterVar('A', 'name^="A"');
    const B = filterVar('B', 'name^="B"');
    expect(() =>
      expandExpression(
        parseExpression('A / B'),
        resolvedOf([
          [A, [inst('a1'), inst('a2')]],
          [B, [inst('b1'), inst('b2'), inst('b3')]],
        ]),
        rawOptions
      )
    ).toThrow(
      'Variables A and B each match several time series (2 and 3). Only one variable can. ' +
        'Use avg(), sum(), min() or max() on the others, or narrow their filters.'
    );
  });

  it('fans out one variable while another is combined', () => {
    const A = filterVar('A', 'name^="A"');
    const B = filterVar('B', 'name^="B"');
    const { items } = expandExpression(
      parseExpression('A - avg(B)'),
      resolvedOf([
        [A, [inst('a1'), inst('a2')]],
        [B, [inst('b1'), inst('b2')]],
      ]),
      rawOptions
    );
    expect(items.map(({ expression }) => expression)).toEqual([
      "ts{space='pumps', externalId='a1'} - avg(ts{space='pumps', externalId='b1'}, ts{space='pumps', externalId='b2'})",
      "ts{space='pumps', externalId='a2'} - avg(ts{space='pumps', externalId='b1'}, ts{space='pumps', externalId='b2'})",
    ]);
  });

  it('quotes values with single quotes, and a value holding one with double quotes', () => {
    const A = instanceVar('A', "it's");
    const { items } = expandExpression(
      parseExpression('A'),
      resolvedOf([[A, [inst("it's")]]]),
      rawOptions
    );
    expect(items[0].expression).toEqual(`ts{space='pumps', externalId="it's"}`);
  });

  it('sends a combination of one time series as that time series, as CDF needs two inputs', () => {
    const A = filterVar('A', "name^='PT'");
    for (const fn of ['avg', 'min', 'max', 'sum']) {
      const { items } = expandExpression(
        parseExpression(`${fn}(A) * 2`),
        resolvedOf([[A, [inst('e1')]]]),
        aggregateOptions
      );
      expect(items[0].expression).toMatch(
        new RegExp(
          `^\\(?ts\\{space='pumps', externalId='e1', aggregate='average', granularity='1h'\\}\\)? \\* 2$`
        )
      );
    }
  });

  it('writes sum() with several arguments as an addition', () => {
    const resolved = {
      A: { variable: instanceVar('A', 'a'), instances: [inst('a')] },
      B: { variable: instanceVar('B', 'b'), instances: [inst('b')] },
    } as Record<string, ResolvedVariable>;
    const [{ expression }] = expandExpression(
      parseExpression('sum(A, B * 2)'),
      resolved,
      rawOptions
    ).items;
    expect(expression).not.toContain('sum');
    expect(expression).toEqual(
      "(ts{space='pumps', externalId='a'} + ts{space='pumps', externalId='b'} * 2)"
    );
  });

  it('refuses avg(), min() and max() over one input that is not a variable on its own', () => {
    const resolved = {
      A: { variable: instanceVar('A', 'a'), instances: [inst('a')] },
    } as Record<string, ResolvedVariable>;
    expect(() => expandExpression(parseExpression('avg(A * 2)'), resolved, rawOptions)).toThrow(
      'avg(A * 2) needs a variable on its own or at least two inputs, such as avg(A).'
    );
    expect(() => expandExpression(parseExpression('sum(A * 2)'), resolved, rawOptions)).not.toThrow();
    const several = {
      A: { variable: instanceVar('A', 'a'), instances: [inst('a'), inst('b')] },
    } as Record<string, ResolvedVariable>;
    expect(() => expandExpression(parseExpression('sum(A * 2)'), several, rawOptions)).toThrow(
      'sum(A * 2) needs a variable on its own'
    );
    expect(() => expandExpression(parseExpression('avg(A, 2)'), resolved, rawOptions)).not.toThrow();
  });

  it('combines a locked variable inside avg() and flattens sum()', () => {
    const A = filterVar('A', 'name^="PT"');
    const resolved = resolvedOf([[A, [inst('e1'), inst('e2')]]]);
    expect(expandExpression(parseExpression('avg(A) * 2'), resolved, rawOptions).items).toEqual([
      {
        expression:
          "avg(ts{space='pumps', externalId='e1'}, ts{space='pumps', externalId='e2'}) * 2",
      },
    ]);
    const summed = expandExpression(parseExpression('sum(A)'), resolved, rawOptions);
    expect(summed.items).toEqual([
      { expression: "(ts{space='pumps', externalId='e1'} + ts{space='pumps', externalId='e2'})" },
    ]);
    expect(summed.scopes).toEqual([{ A: [inst('e1'), inst('e2')] }]);
  });

  it('refuses an expression without variables or with an uninterpolated dashboard variable', () => {
    expect(() => expandExpression(parseExpression('2 * 3'), {}, rawOptions)).toThrow(
      /uses no variable/
    );
    expect(() =>
      expandExpression(
        parseExpression('$factor * A'),
        resolvedOf([[instanceVar('A', 'e1'), [inst('e1')]]]),
        rawOptions
      )
    ).toThrow(/Dashboard variable \$factor/);
  });
});

describe('resolveVariables', () => {
  const mockConnector = (...pages: DMSInstance[][]) => {
    const fetchAndPaginate = jest.fn();
    pages.forEach((items) => fetchAndPaginate.mockResolvedValueOnce(items));
    return { connector: { fetchAndPaginate } as any, fetchAndPaginate };
  };

  it('resolves a picked series without a request', async () => {
    const { connector, fetchAndPaginate } = mockConnector();
    const { resolved } = await resolveVariables([instanceVar('A', 'e1')], ['A'], view, connector);
    expect(resolved.A.instances).toEqual([inst('e1', { name: 'Series e1' })]);
    expect(fetchAndPaginate).not.toHaveBeenCalled();
  });

  it('lists the view for a filter and applies client-side operators', async () => {
    const { connector, fetchAndPaginate } = mockConnector([
      dmsInstance('e1', { name: 'PT_1', unit: { externalId: 'pressure:bar' } }),
      dmsInstance('e2', { name: 'PT_2', unit: { externalId: 'temperature:deg_c' } }),
    ]);
    const { resolved, warnings } = await resolveVariables(
      [filterVar('A', 'name^="PT", unit.externalId=~".*bar"')],
      ['A'],
      view,
      connector
    );
    expect(resolved.A.instances.map((i) => i.externalId)).toEqual(['e1']);
    expect(resolved.A.filter).toEqual({ prefix: { property: viewProp('name'), value: 'PT' } });
    expect(warnings).toEqual([]);
    expect(fetchAndPaginate.mock.calls[0][0].data).toEqual({
      sources: [{ source: viewRef }],
      instanceType: 'node',
      filter: { prefix: { property: viewProp('name'), value: 'PT' } },
      limit: MAX_SYNTHETIC_FANOUT + 1,
    });
  });

  it('compiles a filter against the types of the view it reads', async () => {
    const fetchAndPaginate = jest.fn().mockResolvedValue([dmsInstance('e1')]);
    const fetchData = jest.fn().mockResolvedValue({
      data: {
        items: [
          {
            ...view,
            properties: {
              isStep: { type: { type: 'boolean' } },
              tags: { type: { type: 'text', list: true } },
              name: { type: { type: 'text' } },
            },
          },
        ],
      },
    });
    const connector = { fetchAndPaginate, fetchData } as any;
    await resolveVariables(
      [filterVar('A', "isStep='true', tags='a', name>=5")],
      ['A'],
      view,
      connector
    );
    expect(fetchAndPaginate.mock.calls[0][0].data.filter).toEqual({
      and: [
        { equals: { property: viewProp('isStep'), value: true } },
        { containsAny: { property: viewProp('tags'), values: ['a'] } },
        { range: { property: viewProp('name'), gte: '5' } },
      ],
    });
  });

  it('checks local filters without treating a missing value as text, and names the variable', async () => {
    const connectorWith = (...items: DMSInstance[]) =>
      ({
        fetchAndPaginate: jest.fn().mockResolvedValue(items),
        fetchData: jest.fn().mockResolvedValue({ data: { items: [] } }),
      }) as any;
    const instances = [dmsInstance('e1', { description: 'new' }), dmsInstance('e2')];
    const ids = async (filter: string) => {
      const { resolved } = await resolveVariables(
        [filterVar('A', filter)],
        ['A'],
        view,
        connectorWith(...instances)
      );
      return resolved.A.instances.map((i) => i.externalId);
    };
    expect(await ids("description=~'n.*'")).toEqual(['e1']);
    expect(await ids("description!~'x.*'")).toEqual(['e1', 'e2']);
    expect(await ids("unit.externalId!='a(b'")).toEqual(['e1', 'e2']);
    expect(await ids("description!~'n|ew'")).toEqual(['e1', 'e2']);
    await expect(ids("description=~'a(b'")).rejects.toThrow(/^Variable A: .*regular expression/);
  });

  it('reports a dashboard variable left in a filter, but not one inside quotes', async () => {
    const connector = {
      fetchAndPaginate: jest.fn().mockResolvedValue([dmsInstance('e1')]),
      fetchData: jest.fn().mockResolvedValue({ data: { items: [] } }),
    } as any;
    const resolve = (filter: string) =>
      resolveVariables([filterVar('A', filter)], ['A'], view, connector);
    await expect(resolve('name=$missing')).rejects.toThrow(
      'Variable A: dashboard variable $missing is not defined.'
    );
    await expect(resolve('name=[[missing]]')).rejects.toThrow('[[missing]] is not defined');
    await expect(resolve("name='$5")).rejects.toThrow('Unexpected end of input');
    await expect(resolve('name=$__interval')).resolves.toBeDefined();
    await expect(resolve("name='$5', tag=\"[[x]]\"")).resolves.toBeDefined();
  });

  it('compares a nested != as text, as a dashboard variable renders', async () => {
    const connector = {
      fetchAndPaginate: jest
        .fn()
        .mockResolvedValue([
          dmsInstance('e1', { unit: { version: 3 } }),
          dmsInstance('e2', { unit: { version: 4 } }),
        ]),
      fetchData: jest.fn().mockResolvedValue({ data: { items: [] } }),
    } as any;
    const { resolved } = await resolveVariables(
      [filterVar('A', "unit.version!='3'")],
      ['A'],
      view,
      connector
    );
    expect(resolved.A.instances.map((i) => i.externalId)).toEqual(['e2']);
  });

  it('looks filter variables up together, and reports the first by name', async () => {
    let releaseFirst = () => {};
    const first = new Promise<DMSInstance[]>((resolve) => {
      releaseFirst = () => resolve([dmsInstance('e1')]);
    });
    const fetchAndPaginate = jest
      .fn()
      .mockReturnValueOnce(first)
      .mockResolvedValueOnce([dmsInstance('e2')]);
    const connector = {
      fetchAndPaginate,
      fetchData: jest.fn().mockResolvedValue({ data: { items: [] } }),
    } as any;
    const pending = resolveVariables(
      [filterVar('A', 'name="a"'), filterVar('B', 'name="b"')],
      ['A', 'B'],
      view,
      connector
    );
    await new Promise((resolve) => setTimeout(resolve));
    expect(fetchAndPaginate).toHaveBeenCalledTimes(2);
    releaseFirst();
    expect(Object.keys((await pending).resolved)).toEqual(['A', 'B']);
    const failing = resolveVariables(
      [
        instanceVar('A', 'x'),
        { ...instanceVar('B', 'y'), instance: undefined },
        { ...instanceVar('C', 'z'), instance: undefined },
      ],
      ['A', 'C', 'B'],
      view,
      connector
    );
    await expect(failing).rejects.toThrow('Variable C has no time series');
  });

  it('retries the view read on a temporary failure', async () => {
    const fetchData = jest
      .fn()
      .mockRejectedValueOnce({ status: 503 })
      .mockResolvedValue({ data: { items: [] } });
    const connector = {
      fetchAndPaginate: jest.fn().mockResolvedValue([dmsInstance('e1')]),
      fetchData,
    } as any;
    jest.useFakeTimers();
    const pending = resolveVariables([filterVar('A', 'name="x"')], ['A'], view, connector);
    await jest.runAllTimersAsync();
    jest.useRealTimers();
    await expect(pending).resolves.toBeDefined();
    expect(fetchData).toHaveBeenCalledTimes(2);
  });

  it('only resolves the variables the expression names', async () => {
    const { connector, fetchAndPaginate } = mockConnector();
    const { resolved } = await resolveVariables(
      [instanceVar('A', 'e1'), filterVar('B', 'name="x"')],
      ['A'],
      view,
      connector
    );
    expect(Object.keys(resolved)).toEqual(['A']);
    expect(fetchAndPaginate).not.toHaveBeenCalled();
  });

  it('rejects an empty filter without listing the view', async () => {
    const { connector, fetchAndPaginate } = mockConnector();
    await expect(
      resolveVariables([instanceVar('A', 'e1'), filterVar('B', '  ')], ['A', 'B'], view, connector)
    ).rejects.toThrow('Variable B is not defined: its filter is empty.');
    expect(fetchAndPaginate).not.toHaveBeenCalled();
  });

  it('counts a filter variable as the query resolves it', async () => {
    const { connector } = mockConnector([
      dmsInstance('e1', { name: 'PT_1' }),
      dmsInstance('e2', { name: 'PT_2' }),
      dmsInstance('e3', { name: 'XT_3' }),
    ]);
    expect(await countVariableMatches(filterVar('A', 'name=~"PT_.*"'), view, connector)).toEqual({
      count: 2,
      truncated: false,
      checkedAfterwards: true,
    });
    expect(await countVariableMatches(filterVar('A', ' '), view, connector)).toBeNull();
    await expect(countVariableMatches(filterVar('A', 'name='), view, connector)).rejects.toThrow(
      /Variable A/
    );
  });

  it('refuses local operators when CDF returned more time series than they can check', async () => {
    const many = Array.from({ length: MAX_SYNTHETIC_FANOUT + 1 }, (_, i) =>
      dmsInstance(`e${i}`)
    );
    const { connector } = mockConnector(many);
    await expect(
      resolveVariables([filterVar('A', 'externalId=~"e1.*"')], ['A'], view, connector)
    ).rejects.toThrow(
      'Variable A: CDF returned more than 100 time series, so =~, !~ and filters on nested values would only see ' +
        'the first 100 and could miss some. Narrow the filter with = or ^=, which CDF applies.'
    );
  });

  it('checks a nested != against every value of a list, and refuses an instance there', async () => {
    const { connector } = mockConnector([
      dmsInstance('e1', { unit: { externalId: 'a' } }),
      dmsInstance('e2', { unit: { externalId: 'b' } }),
      dmsInstance('e3', { unit: { externalId: 'c' } }),
    ]);
    const { resolved } = await resolveVariables(
      [filterVar('A', 'unit.externalId!=["a", "b"]')],
      ['A'],
      view,
      connector
    );
    expect(resolved.A.instances.map((i) => i.externalId)).toEqual(['e3']);
    await expect(
      resolveVariables(
        [filterVar('A', 'unit.externalId!={space="u", externalId="a"}')],
        ['A'],
        view,
        connector
      )
    ).rejects.toThrow(
      'Variable A: "unit.externalId" is a nested value and can\'t be compared with an instance.'
    );
  });

  it('keeps local operators when CDF returned everything', async () => {
    const { connector } = mockConnector([dmsInstance('e1'), dmsInstance('e2'), dmsInstance('x3')]);
    const { resolved, warnings } = await resolveVariables(
      [filterVar('A', 'externalId=~"e.*"')],
      ['A'],
      view,
      connector
    );
    expect(resolved.A.instances.map((i) => i.externalId)).toEqual(['e1', 'e2']);
    expect(warnings).toEqual([]);
  });

  it('warns when a filter is truncated', async () => {
    const many = Array.from({ length: MAX_SYNTHETIC_FANOUT + 1 }, (_, i) =>
      dmsInstance(`e${i}`)
    );
    const { connector } = mockConnector(many);
    const { resolved, warnings } = await resolveVariables(
      [filterVar('A', 'type="numeric"')],
      ['A'],
      view,
      connector
    );
    expect(resolved.A.instances).toHaveLength(MAX_SYNTHETIC_FANOUT);
    expect(warnings[0]).toMatch(/Variable A matches more than 100/);
  });

  it('reports the failing variable', async () => {
    const { connector } = mockConnector([]);
    await expect(
      resolveVariables([filterVar('A', 'name="nope"')], ['A'], view, connector)
    ).rejects.toThrow(
      "Variable A matches no time series. Check its filter with the row's {} preview."
    );
    await expect(resolveVariables([], ['A'], view, connector)).rejects.toThrow(
      /Unknown variable "A"/
    );
    await expect(
      resolveVariables([{ name: 'A', mode: 'instance' }], ['A'], view, connector)
    ).rejects.toThrow(/Variable A has no time series. Pick one/);
    await expect(
      resolveVariables([filterVar('A', 'name~"x"')], ['A'], view, connector)
    ).rejects.toThrow(/Variable A: /);
    await expect(
      resolveVariables([filterVar('A', 'aggregate="interpolation"')], ['A'], view, connector)
    ).rejects.toThrow(/Variable A: a filter can't set aggregate\. Use the variable's row/);
    await expect(
      resolveVariables([filterVar('avg', '')], ['avg'], view, connector)
    ).rejects.toThrow(/function name/);
  });

  it('runs end to end through formQueriesForSyntheticQuery', async () => {
    const { connector } = mockConnector([
      dmsInstance('e1', { name: 'PT_1' }),
      dmsInstance('e2', { name: 'PT_2' }),
    ]);
    const query: CdmSyntheticQuery = {
      version: 2,
      view,
      variables: [filterVar('A', 'name^="PT"'), instanceVar('B', 'base')],
      expression: 'avg(A) - B',
    };
    const { items, counts, scopes } = await formQueriesForSyntheticQuery(
      query,
      aggregateOptions,
      connector
    );
    expect(items).toEqual([
      {
        expression:
          "avg(ts{space='pumps', externalId='e1', aggregate='average', granularity='1h'}, ts{space='pumps', externalId='e2', aggregate='average', granularity='1h'}) - ts{space='pumps', externalId='base', aggregate='average', granularity='1h'}",
      },
    ]);
    expect(counts).toEqual({ A: 2, B: 1 });
    expect(scopes[0].B).toEqual(inst('base', { name: 'Series base' }));
    await expect(
      formQueriesForSyntheticQuery({ ...query, expression: ' ' }, aggregateOptions, connector)
    ).rejects.toThrow(/expression is empty/);
  });
});

describe('getLabelsForSyntheticQuery', () => {
  const scopes = [
    {
      A: inst('e1', { name: 'Pump 1', unit: { externalId: 'pressure:bar' }, source: null }),
      B: inst('e2'),
    },
  ];

  it('defaults to the expression with each variable replaced by its series name', () => {
    expect(getLabelsForSyntheticQuery('', 'A * 2 - B', scopes)).toEqual(['Pump 1 * 2 - e2']);
    expect(getLabelsForSyntheticQuery('', 'avg(A)', [{ A: [inst('e1'), inst('e2')] }])).toEqual([
      'avg(A)',
    ]);
  });

  it('resolves variable-qualified tokens only', () => {
    const render = (label: string) => getLabelsForSyntheticQuery(label, 'A - B', scopes)[0];
    expect(render('{{A}} vs {{B}}')).toEqual('Pump 1 vs e2');
    expect(render('{{A.name}} ({{ A.unit.externalId }})')).toEqual('Pump 1 (pressure:bar)');
    expect(render('{{A.unit}}')).toEqual('{"externalId":"pressure:bar"}');
    expect(render('{{name}}')).toEqual(':name');
    expect(render('{{C.name}}')).toEqual(':C.name');
    expect(render('{{A.missing}}')).toEqual(':A.missing');
    expect(render('{{A.source}}')).toEqual('null');
  });

  it('lists the series of a combined variable', () => {
    expect(
      getLabelsForSyntheticQuery('{{A.name}}', 'avg(A)', [
        { A: [inst('e1', { name: 'P1' }), inst('e2', { name: 'P2' })] },
      ])
    ).toEqual(['P1, P2']);
  });
});

describe('query model', () => {
  it('starts over for anything but version 2', () => {
    expect(normalizeCdmSyntheticQuery(undefined).variables).toEqual([
      { name: 'A', mode: 'instance', aggregate: 'average' },
    ]);
    expect(normalizeCdmSyntheticQuery({ version: 1, expr: 'ts{}' } as any).expression).toEqual('');
  });

  it('sanitises rows and keeps one unit field', () => {
    const normalized = normalizeCdmSyntheticQuery({
      version: 2,
      view,
      expression: 'A',
      variables: [
        {
          name: 'A',
          mode: 'bogus',
          aggregate: 'none',
          targetUnit: 'u',
          targetUnitSystem: 's',
          instance: { space: 's' },
        } as any,
        { name: 'B', mode: 'filter', filter: 'x=1', alignment: 5 } as any,
      ],
    });
    expect(normalized.variables).toEqual([
      { name: 'A', mode: 'instance', targetUnit: 'u' },
      { name: 'B', mode: 'filter', filter: 'x=1' },
    ]);
  });

  it('interpolates the expression, the view and each row', () => {
    const replace = (value: string) => value.replace(/\$(\w+)/g, (_m, name) => `<${name}>`);
    expect(
      interpolateCdmSyntheticQuery(
        {
          version: 2,
          view: { space: '$space', externalId: 'CogniteTimeSeries', version: 'v1' },
          expression: '$factor * A',
          variables: [
            { name: 'A', mode: 'filter', filter: 'name=$tag', targetUnitSystem: '$system' },
            {
              name: 'B',
              mode: 'instance',
              instance: { space: '$space', externalId: '$id', name: 'kept' },
              targetUnit: '$unit',
            },
          ],
        },
        replace
      )
    ).toEqual({
      version: 2,
      view: { space: '<space>', externalId: 'CogniteTimeSeries', version: 'v1' },
      expression: '<factor> * A',
      variables: [
        { name: 'A', mode: 'filter', filter: 'name=<tag>', targetUnitSystem: '<system>' },
        {
          name: 'B',
          mode: 'instance',
          instance: { space: '<space>', externalId: '<id>', name: 'kept' },
          targetUnit: '<unit>',
        },
      ],
    });
  });
});

describe('toSyntheticGranularity', () => {
  it('keeps what the API takes and moves an over-cap amount to a larger unit', () => {
    expect(toSyntheticGranularity('30s')).toEqual('30s');
    expect(toSyntheticGranularity('120s')).toEqual('120s');
    expect(toSyntheticGranularity('1h')).toEqual('1h');
    expect(toSyntheticGranularity('180s')).toEqual('3m');
    expect(toSyntheticGranularity('180m')).toEqual('3h');
    expect(toSyntheticGranularity('100000d')).toEqual('100000d');
  });

  it('refuses what no unit can express', () => {
    for (const granularity of ['121s', '1w', '1.5h', '', '100001d']) {
      expect(() => toSyntheticGranularity(granularity)).toThrow(
        /Synthetic time series don't support the granularity/
      );
    }
  });
});
