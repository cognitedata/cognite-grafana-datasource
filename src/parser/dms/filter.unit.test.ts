import {
  buildDmsFilter,
  parseFilter,
  splitRefFilters,
  validateFilter,
  viewPropertyPath,
} from './filterCompiler';
import { composeSTSQuery, STSFilter, STSReference } from '../shared';
import { applyFilters } from '../../utils';
import { interpolateFilterVariables, listPropertiesOf } from '../../cdf/filterVariables';

const view = { space: 'cdf_cdm', externalId: 'CogniteTimeSeries', version: 'v1' };
const viewProp = (prop: string) => ['cdf_cdm', 'CogniteTimeSeries/v1', prop];

describe('filter grammar', () => {
  const roundTrip = [
    'name="escaped \\" quote"',
    'name^="PT_"',
    'value>=1.5',
    'value>1',
    'value<=10',
    'sourceCreatedTime>="2024-01-01"',
    'name!="x"',
    'name=~"PT_.*"',
    'name!~".*temp.*"',
    'unit!=null',
    'unit=null',
    'isStep=false',
    'name=["a", "b"]',
    'unit={space="cdf_cdm_units", externalId="pressure:bar"}',
    'unit.externalId=~".*bar"',
    'name^="PT_", isStep=false, type="numeric"',
  ];
  roundTrip.forEach((filter) => {
    it(`round trips: ${filter}`, () => {
      expect(composeSTSQuery(STSReference(parseFilter(filter)))).toEqual(`ts{${filter}}`);
    });
  });

  it('parses an empty filter as no pairs', () => {
    expect(parseFilter('')).toEqual([]);
    expect(parseFilter('   ')).toEqual([]);
  });

  it('parses template variables as string values', () => {
    expect(parseFilter('name=$tag')).toEqual([STSFilter('name', '$tag')]);
    expect(parseFilter('name=~${tags:regex}')).toEqual([STSFilter('name', '${tags:regex}', '=~')]);
  });

  it('reports syntax errors with an offset', () => {
    expect(() => parseFilter('name~"x"')).toThrow(/Syntax error/);
    expect(validateFilter('name~"x"')).toEqual(
      expect.objectContaining({ message: 'Syntax error' })
    );
    expect(validateFilter('')).toBeNull();
    expect(validateFilter("name^='PT'")).toBeNull();
  });
});

describe('splitRefFilters + buildDmsFilter', () => {
  const serverOf = (filter: string) => splitRefFilters(STSReference(parseFilter(filter))).server;

  it('classifies filters into synthetic/server/client', () => {
    const { synthetic, server, client } = splitRefFilters(
      STSReference(
        parseFilter(
          'name^="PT", isStep=false, unit!=null, description!="x", name=~"P.*", unit.externalId!="u", aggregate="average"'
        )
      )
    );
    expect(synthetic.map((f) => f.path)).toEqual(['aggregate']);
    expect(server.map((f) => f.path)).toEqual(['name', 'isStep', 'unit', 'description']);
    expect(client.map((f) => f.path)).toEqual(['name', 'unit.externalId']);
  });

  it('scopes reserved props through the node and the rest through the view', () => {
    expect(viewPropertyPath(view, 'space')).toEqual(['node', 'space']);
    expect(viewPropertyPath(view, 'name')).toEqual(viewProp('name'));
  });

  it('compiles != as the negated equality, keeping instances without a value', () => {
    expect(buildDmsFilter(view, serverOf('description!="x"'))).toEqual({
      not: { equals: { property: viewProp('description'), value: 'x' } },
    });
    expect(
      buildDmsFilter(view, serverOf('tags!="obsolete"'), { listProperties: new Set(['tags']) })
    ).toEqual({
      not: { containsAny: { property: viewProp('tags'), values: ['obsolete'] } },
    });
  });

  it('compiles != with a list or a relation as the negated equality', () => {
    expect(buildDmsFilter(view, serverOf('name!=["a", "b"]'))).toEqual({
      not: { in: { property: viewProp('name'), values: ['a', 'b'] } },
    });
    expect(buildDmsFilter(view, serverOf('unit!={space="u", externalId="x"}'))).toEqual({
      not: { equals: { property: viewProp('unit'), value: { space: 'u', externalId: 'x' } } },
    });
    const listProperties = new Set(['assets']);
    expect(
      buildDmsFilter(
        view,
        serverOf('assets!=[{space="s", externalId="a1"}, {space="s", externalId="a2"}]'),
        {
          listProperties,
        }
      )
    ).toEqual({
      not: {
        containsAny: {
          property: viewProp('assets'),
          values: [
            { space: 's', externalId: 'a1' },
            { space: 's', externalId: 'a2' },
          ],
        },
      },
    });
    expect(() => buildDmsFilter(view, serverOf('name!=[]'))).toThrow(
      'The list for "name" is empty.'
    );
  });

  it('compiles equals, in, direct relations, prefix, ranges and exists', () => {
    expect(buildDmsFilter(view, serverOf('name="x"'))).toEqual({
      equals: { property: viewProp('name'), value: 'x' },
    });
    expect(buildDmsFilter(view, serverOf('name=["a", "b"]'))).toEqual({
      in: { property: viewProp('name'), values: ['a', 'b'] },
    });
    expect(buildDmsFilter(view, serverOf('unit={space="u", externalId="pressure:bar"}'))).toEqual({
      equals: { property: viewProp('unit'), value: { space: 'u', externalId: 'pressure:bar' } },
    });
    expect(buildDmsFilter(view, serverOf('name^="PT_"'))).toEqual({
      prefix: { property: viewProp('name'), value: 'PT_' },
    });
    expect(buildDmsFilter(view, serverOf('value>=1, value<5'))).toEqual({
      range: { property: viewProp('value'), gte: 1, lt: 5 },
    });
    expect(buildDmsFilter(view, serverOf('unit!=null'))).toEqual({
      exists: { property: viewProp('unit') },
    });
    expect(buildDmsFilter(view, serverOf('unit=null'))).toEqual({
      not: { exists: { property: viewProp('unit') } },
    });
  });

  it('compiles equality on a list property to containsAny', () => {
    const listProperties = new Set(['assets']);
    expect(
      buildDmsFilter(view, serverOf('assets={space="s", externalId="a1"}'), { listProperties })
    ).toEqual({
      containsAny: { property: viewProp('assets'), values: [{ space: 's', externalId: 'a1' }] },
    });
    expect(
      buildDmsFilter(
        view,
        serverOf('assets=[{space="s", externalId="a1"}, {space="s", externalId="a2"}]'),
        {
          listProperties,
        }
      )
    ).toEqual({
      containsAny: {
        property: viewProp('assets'),
        values: [
          { space: 's', externalId: 'a1' },
          { space: 's', externalId: 'a2' },
        ],
      },
    });
  });

  it('rejects conflicting bounds and dotted server paths', () => {
    expect(() => buildDmsFilter(view, serverOf('value>=1, value>=2'))).toThrow(
      /"value" has two ">=" conditions/
    );
    expect(() => buildDmsFilter(view, serverOf('unit.externalId="bar"'))).toThrow(
      /"unit.externalId" only works with !=, =~ and !~/
    );
  });

  it('an empty filter compiles to no filter', () => {
    expect(buildDmsFilter(view, [])).toBeUndefined();
  });
});

describe('text variables in filters', () => {
  const srv = (current: unknown) =>
    ({
      getVariables: () => [{ name: 'tag', current: { value: current } }],
      replace: (s: string) => s,
    }) as any;
  const render = (filter: string, current: unknown) =>
    interpolateFilterVariables(filter, srv(current));

  it('quotes a single value and makes a list of several, escaping quotes', () => {
    expect(render('name=$tag', "it's")).toEqual("name='it\\'s'");
    expect(render('name=${tag}', ['a', 'b'])).toEqual("name=['a', 'b']");
    expect(render('name!=[[tag]]', ['a', 'b'])).toEqual("name!=['a', 'b']");
    expect(render('name^=$tag', 'PT_')).toEqual("name^='PT_'");
  });

  it('joins a list it sits in instead of nesting one, with every variable syntax', () => {
    expect(render("name=[$tag, 'c']", ['a', 'b'])).toEqual("name=['a', 'b', 'c']");
    expect(render("name=[[[tag]], 'c']", ['a', 'b'])).toEqual("name=['a', 'b', 'c']");
    expect(render('name=[$tag, [[tag]]], description=$tag', ['a', 'b'])).toEqual(
      "name=['a', 'b', 'a', 'b'], description=['a', 'b']"
    );
  });

  it('drops an empty selection from the list it sits in', () => {
    expect(render("name=[$tag, 'c']", [])).toEqual("name=['c']");
    expect(render("name=['c', $tag]", [])).toEqual("name=['c']");
    expect(render('name=[$tag]', [])).toEqual('name=[]');
  });

  it('keeps numbers bare only after a range operator, and quotes number-like text elsewhere', () => {
    expect(render('minValue>=$tag', '5')).toEqual('minValue>=5');
    expect(render('name=$tag', '1001')).toEqual("name='1001'");
    expect(render('name=$tag', ['1', '2'])).toEqual("name=['1', '2']");
    expect(parseFilter(render('name=$tag', '1001'))).toEqual([
      { path: 'name', filter: '=', value: '1001' },
    ]);
  });

  it('turns the values into one pattern after =~ and !~ that matches them literally', () => {
    const items = [{ name: 'pump.1' }, { name: 'pumpX1' }, { name: 'a+b' }, { name: "it's" }];
    const matching = (filter: string, current: unknown) =>
      applyFilters(items, parseFilter(render(filter, current)) as any).map((item) => item.name);
    expect(matching('name=~$tag', 'pump.1')).toEqual(['pump.1']);
    expect(matching('name=~$tag', ['pump.1', 'a+b'])).toEqual(['pump.1', 'a+b']);
    expect(matching('name=~$tag', "it's")).toEqual(["it's"]);
    expect(matching('name!~ $tag', 'pump.1')).toEqual(['pumpX1', 'a+b', "it's"]);
  });

  it('refuses several values after ^= or a range operator', () => {
    const server = (filter: string) => splitRefFilters(STSReference(parseFilter(filter))).server;
    expect(() => buildDmsFilter(view, server(render('name^=$tag', ['a', 'b'])))).toThrow(
      '"^=" takes one value, but "name" has several.'
    );
    expect(() => buildDmsFilter(view, server(render('minValue>=$tag', ['1', '2'])))).toThrow(
      '">=" takes one value, but "minValue" has several.'
    );
  });

  it('renders "All" with a custom value as that text, or as a pattern after =~', () => {
    const allSrv = {
      getVariables: () => [{ name: 'tag', current: { value: ['$__all'] }, allValue: '.*' }],
      replace: (x: string) => x,
    } as any;
    expect(interpolateFilterVariables('name=$tag', allSrv)).toEqual("name='.*'");
    expect(interpolateFilterVariables('name=~$tag', allSrv)).toEqual("name=~'.*'");
    expect(
      applyFilters(
        [{ name: 'any' }],
        parseFilter(interpolateFilterVariables('name=~$tag', allSrv)) as any
      )
    ).toHaveLength(1);
  });

  it('leaves variables inside quotes to Grafana', () => {
    expect(render('name=\'$tag\', description="$tag"', 'a')).toEqual(
      'name=\'$tag\', description="$tag"'
    );
  });

  it('renders an empty selection as an empty list, which the filter then refuses', () => {
    const rendered = render('name=$tag', []);
    expect(rendered).toEqual('name=[]');
    expect(() =>
      buildDmsFilter(view, splitRefFilters(STSReference(parseFilter(rendered))).server)
    ).toThrow('The list for "name" is empty.');
  });

  it('parses every rendered form', () => {
    for (const [filter, current] of [
      ['name=$tag', 'a'],
      ['name!=$tag', ['a', 'b']],
      ["name=[$tag, 'c']", ['a', 'b']],
      ['name=~$tag', ['a', 'b']],
      ['minValue>=$tag', '5'],
      ["name=[[[tag]], 'c']", ['a', 'b']],
      ["name=[$tag, 'c']", []],
      ['name^=$tag', ['a', 'b']],
    ] as Array<[string, unknown]>) {
      expect(() => parseFilter(render(filter, current))).not.toThrow();
    }
  });
});

describe('instance-reference variables in filters', () => {
  const ref = (externalId: string) => JSON.stringify({ space: 'assets', externalId });
  const templateSrv = (current: unknown, options?: unknown[]) =>
    ({
      getVariables: () => [
        {
          name: 'asset',
          current: { value: current },
          options: options?.map((value) => ({ value })),
        },
      ],
      replace: (s: string) => s,
    }) as any;

  it('renders one reference as a direct relation value', () => {
    expect(
      interpolateFilterVariables("assets=$asset, type='numeric'", templateSrv(ref('a1')))
    ).toEqual("assets={space='assets', externalId='a1'}, type='numeric'");
  });

  it('renders several references as a list, and parts as quoted strings', () => {
    const srv = templateSrv([ref('a1'), ref("a'2")]);
    expect(interpolateFilterVariables('assets=${asset}', srv)).toEqual(
      "assets=[{space='assets', externalId='a1'}, {space='assets', externalId='a\\'2'}]"
    );
    expect(interpolateFilterVariables('externalId=[${asset.externalId}]', srv)).toEqual(
      "externalId=['a1', 'a\\'2']"
    );
  });

  it('expands All to every option and leaves formatted and unknown variables to Grafana', () => {
    expect(
      interpolateFilterVariables('assets=$asset', templateSrv('$__all', [ref('a1'), ref('a2')]))
    ).toEqual("assets=[{space='assets', externalId='a1'}, {space='assets', externalId='a2'}]");
    expect(interpolateFilterVariables('name=${asset:csv}', templateSrv(ref('a1')))).toEqual(
      'name=${asset:csv}'
    );
    expect(interpolateFilterVariables('name=$other', templateSrv('x'))).toEqual('name=$other');
  });

  it('parses the rendered list into a containsAny filter on a list property', () => {
    const rendered = interpolateFilterVariables(
      'assets=$asset',
      templateSrv([ref('a1'), ref('a2')])
    );
    const { server } = splitRefFilters(STSReference(parseFilter(rendered)));
    expect(buildDmsFilter(view, server, { listProperties: new Set(['assets']) })).toEqual({
      containsAny: {
        property: viewProp('assets'),
        values: [
          { space: 'assets', externalId: 'a1' },
          { space: 'assets', externalId: 'a2' },
        ],
      },
    });
  });

  it('reads a view definition for its list properties', () => {
    expect(
      listPropertiesOf({
        ...view,
        properties: {
          assets: { type: { type: 'direct', list: true } },
          name: { type: { type: 'text' } },
        },
      })
    ).toEqual(new Set(['assets']));
    expect(listPropertiesOf(null)).toEqual(new Set());
  });
});
