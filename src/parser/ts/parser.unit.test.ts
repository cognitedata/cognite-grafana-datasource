import { cloneDeep } from 'lodash';
import {
  STSQueryItem,
  getReferencedTimeseries,
  getServerFilters,
  flattenServerQueryFilters,
  parse,
  composeSTSQuery,
  generateAllPossiblePermutations,
  STSFunction,
  injectTSIdsInExpression,
  STSFilter,
  STSReference,
  getIndicesOfMultiaryFunctionArgs,
  convertExpressionToLabel,
  Operator,
  getClientFilters,
  WrappedConst,
  STSQuery,
  enrichWithDefaultAggregates,
} from './index';
import { FilterTypes } from '../types';
import { TimeSeriesResponseItem } from '../../cdf/types';

const { NotEquals, Equals, RegexEquals } = FilterTypes;
const STS = STSReference;
const Filter = STSFilter;

function Constant(constant: number | 'pi()'): WrappedConst {
  return { constant };
}

function STSFunc(func: STSFunction['func'], args: STSFunction['args']): STSFunction {
  return {
    func,
    args,
  } as STSFunction;
}

const testSeries: STSQueryItem[] = [
  STS([Filter('id', 2), Filter('hey', 'other', NotEquals)]),
  STS(),
  STS([Filter('id', 2, NotEquals), Filter('name', 'value')]),
];

describe('get timeseries filters from parsed data', () => {
  it('get referenced timeseries', () => {
    expect(getReferencedTimeseries(testSeries)).toEqual([
      {
        id: 2,
      },
    ]);
  });

  it('flatten server filters', () => {
    expect(flattenServerQueryFilters([Filter('name', 'value'), Filter('name2', 'value2')])).toEqual(
      {
        name: 'value',
        name2: 'value2',
      }
    );
  });

  describe('get flat server filters', () => {
    it('basic', () => {
      expect(getServerFilters(testSeries)).toStrictEqual([{}, { name: 'value' }]);
    });

    it("don't include aggregate filters", () => {
      const aggregated = [
        STS([
          Filter('aggregate', 'average'),
          Filter('granularity', '1m'),
          Filter('alignment', 3600),
        ]),
      ];
      expect(getServerFilters(aggregated)).toStrictEqual([{}]);
    });

    it('array filter', () => {
      const nested = [STS([Filter('assetIds', [123])])];
      expect(getServerFilters(nested)).toStrictEqual([{ assetIds: [123] }]);
    });

    it('array nested filter', () => {
      const nested = [STS([Filter('assetIds', [Filter('id', 1)])])];
      expect(getServerFilters(nested)).toStrictEqual([{ assetIds: [{ id: 1 }] }]);
    });

    it('nested', () => {
      const nested = [STS([Filter('a', [Filter('b', 'c', '!~')])])];
      expect(getServerFilters(nested)).toStrictEqual([{}]);
    });

    it('nested with merge', () => {
      const nested = [STS([Filter('a', [Filter('b', 'c')]), Filter('a', [Filter('d', 'e')])])];
      expect(getServerFilters(nested)).toStrictEqual([{ a: { b: 'c', d: 'e' } }]);
    });

    it('nested with client filter', () => {
      const nested = [STS([Filter('a', [[Filter('b', 'c', '!~'), Filter('d', 'e')]])])];
      expect(getServerFilters(nested)).toStrictEqual([{ a: [{ d: 'e' }] }]);
    });

    it('nested with ids', () => {
      const nested = [STS([Filter('ids', [[Filter('id', 0)], [Filter('id', 1)]])])];
      expect(getServerFilters(nested)).toStrictEqual([{ ids: [{ id: 0 }, { id: 1 }] }]);
    });
  });

  describe('flatten nested server filters', () => {
    it('basic', () => {
      expect(flattenServerQueryFilters([Filter('a', [Filter('b', 'c')])])).toStrictEqual({
        a: {
          b: 'c',
        },
      });
    });

    it('with arrays', () => {
      expect(flattenServerQueryFilters([Filter('a', [[Filter('b', 'c')]])])).toStrictEqual({
        a: [
          {
            b: 'c',
          },
        ],
      });
    });
  });

  describe('get client filters', () => {
    it('void', () => {
      const nested = [STS([]), STS([])];
      expect(getClientFilters(nested)).toStrictEqual([[], []]);
    });

    it('empty', () => {
      const nested = [STS([Filter('b', 'c')])];
      expect(getClientFilters(nested)).toStrictEqual([[]]);
    });

    it('basic', () => {
      const nested = [STS([Filter('b', 'c', '!~')])];
      expect(getClientFilters(nested)).toStrictEqual([[Filter('b', 'c', '!~')]]);
    });

    it('nested', () => {
      const nested = [STS([Filter('a', [Filter('b', 'c', '!~')])])];
      expect(getClientFilters(nested)).toStrictEqual([[Filter('a.b', 'c', '!~')]]);
    });

    it('nested with duplicates', () => {
      const nested = [
        STS([Filter('a', [Filter('b', 'c', '!~')]), Filter('a', [Filter('d', 'e')])]),
      ];
      expect(getClientFilters(nested)).toStrictEqual([[Filter('a.b', 'c', '!~')]]);
    });

    it("don't include aggregate filters", () => {
      const aggregated = STS([
        Filter('aggregate', 'average'),
        Filter('granularity', '1m'),
        Filter('alignment', 3600),
      ]);
      expect(getClientFilters(aggregated)).toStrictEqual([[]]);
    });
  });
});

describe('nearley parser', () => {
  it('one time serie', () => {
    const res = parse(`ts{id=1}`);
    expect(res).toEqual(STS([Filter('id', 1)]));
  });

  it('simple arithmethics', () => {
    const res = parse(`ts{id=1} - ts{a=2}`);
    expect(res).toEqual([STS([Filter('id', 1)]), Operator('-'), STS([Filter('a', 2)])]);
  });

  it('number scientific notation', () => {
    const res = parse(`10e-100 - ts{id=1}`);
    expect(res).toEqual([Constant(10e-100), Operator('-'), STS([Filter('id', 1)])]);
  });

  it('number supports 20 digits after comma', () => {
    const res = parse(`0.00000000000000007203 - ts{id=1}`);
    expect(res).toEqual([Constant(0.00000000000000007203), Operator('-'), STS([Filter('id', 1)])]);
  });

  it('function with arithmetics and filters', () => {
    const res = parse(`sin(ts{assetSubtreeIds=[{id=1}], aggregate="average"} / 10)`);
    expect(res).toEqual(
      STSFunc('sin', [
        STS([Filter('assetSubtreeIds', [[Filter('id', 1)]]), Filter('aggregate', 'average')]),
        Operator('/'),
        Constant(10),
      ])
    );
  });

  it('template variables', () => {
    const res = parse(`ts{id=[[asset]]}`);
    expect(res).toEqual(STS([Filter('id', '[[asset]]')]));
  });

  it('advanced template variable', () => {
    const res = parse('ts{id=${asset:json}}'); // eslint-disable-line no-template-curly-in-string
    expect(res).toEqual(STS([Filter('id', '${asset:json}')])); // eslint-disable-line no-template-curly-in-string
  });

  it('empty filter with aligned aggregate', () => {
    const res = parse(`ts{alignment=3600, granularity='1m', aggregate='average'}`);
    expect(res).toEqual(
      STS([Filter('alignment', 3600), Filter('granularity', '1m'), Filter('aggregate', 'average')])
    );
  });

  it('template variables for regexp filter', () => {
    const res = parse('ts{name=~$name}');
    expect(res).toEqual(STS([Filter('name', '$name', RegexEquals)]));
  });

  it('not equals filter with boolean', () => {
    const res = parse('ts{isString!=true}');
    expect(res).toEqual(STS([Filter('isString', true, NotEquals)]));
  });

  it('not equals filter with number', () => {
    const res = parse('ts{id!=1}');
    expect(res).toEqual(STS([Filter('id', 1, NotEquals)]));
  });

  it('not equals filter with null', () => {
    const res = parse('ts{metadata={something!=null}}');
    expect(res).toEqual(STS([Filter('metadata', [Filter('something', null, NotEquals)], Equals)]));
  });
});

describe('nearley reverse', () => {
  it('simple arithmethics', () => {
    const res = composeSTSQuery([STS([Filter('id', 1)]), Operator('-'), STS([Filter('a', 2)])]);
    expect(res).toEqual('ts{id=1} - ts{a=2}');
  });

  it('sin function with arithmetics', () => {
    const func = STSFunc('sin', [STS([Filter('id', 1)]), Operator('/'), Constant(10)]);
    const res = composeSTSQuery(func);
    expect(res).toEqual('sin(ts{id=1} / 10)');
  });

  it('average function', () => {
    const func = STSFunc('avg', [STS([Filter('id', 1)]), STS([Filter('id', 2)])]);
    const res = composeSTSQuery(func);
    expect(res).toEqual('avg(ts{id=1}, ts{id=2})');
  });

  it('nested filters', () => {
    const func = STS([
      Filter('metadata', [Filter('nested', [[Filter('a', 'b')], [Filter('c', [])]])]),
    ]);
    const res = composeSTSQuery(func);
    expect(res).toEqual('ts{metadata={nested=[{a="b"}, {c=[]}]}}');
  });
});

describe('parse & reverse', () => {
  const inputs = [
    '1 / pi()',
    'sin(pi())',
    'max(ts{}, pi())',
    'exp(ts{} - pi())',
    'exp(pi()) + sin(ts{})',
    '(1 + 2 + ts{})',
    'pow(ts{externalId="VAL_23"}, 2)',
    'round(pi(), 2)',
    'on_error(ts{} / 0, 2)',
    'round(pi() + 1, 2 * 2)',
    'pow(ts{externalId="VAL_23"} + 1, 2)',
    '(1 + 2 + ts{}) / sum(ts{}, avg(ts{}), on_error(ts{}, 0))',
    'sin((1 + 2 + 3))',
    'map(ts{}, ["one"], [1], 0)',
    'avg(map(ts{}, [], [], 0), 1)',
    'ts{metadata={nestedArr=[{a="b"}], nested={a="b"}}}',
    'ts{arr=["a", 1]}',
    'ts{assetSubtreeIds=[{id=1}, {id=2}]}',
    'ts{externalIds="escaped quote \\" here"}',
  ];
  inputs.map((input) =>
    it(input, () => {
      expect(composeSTSQuery(parse(input))).toBe(input);
    })
  );
});

describe('escape characters parsing', () => {
  const { raw: r } = String;
  const inputs = [
    r`ts{name=~"\d some"}`,
    r`ts{name=~"\\d some"}`,
    r`ts{name=~"\\d \" some"}`,
    r`ts{name=~"\\d \\" some"}`,
    r`ts{name =~ "dude"}`,
    r`ts{name=~"\n some"}`,
  ];
  const outputs = [
    STS([Filter('name', r`\d some`, RegexEquals)]),
    STS([Filter('name', r`\\d some`, RegexEquals)]),
    STS([Filter('name', r`\\d \" some`, RegexEquals)]),
    STS([Filter('name', r`\\d \\" some`, RegexEquals)]),
    STS([Filter('name', r`dude`, RegexEquals)]),
    STS([Filter('name', r`\n some`, RegexEquals)]),
  ];

  inputs.map((input, index) =>
    it(input, () => {
      expect(parse(input)).toEqual(outputs[index]);
    })
  );
});

describe('inject ids in queries', () => {
  it('function with arithmetics', () => {
    const func = STSFunc('sin', [
      STS([Filter('assetSubtreeIds', [Filter('id', 1)])]),
      Operator('/'),
      Constant(10),
    ]);
    const res = injectTSIdsInExpression(func, [[{ id: 1 } as TimeSeriesResponseItem]]);
    expect(res).toEqual('sin(ts{id=1} / 10)');
  });

  it('multiary function', () => {
    const func = STSFunc('avg', [STS([Filter('assetSubtreeIds', [Filter('id', 1)])])]);
    const res = injectTSIdsInExpression(func, [
      [{ id: 1 }, { id: 2 }, { id: 3 }],
    ] as TimeSeriesResponseItem[][]);
    expect(res).toEqual('avg(ts{id=1}, ts{id=2}, ts{id=3})');
  });

  it('sum function with one filter', () => {
    const func = STSFunc('sum', [STS([Filter('assetSubtreeIds', [Filter('id', 1)])])]);
    const res = injectTSIdsInExpression(func, [
      [{ id: 1 }, { id: 2 }, { id: 3 }],
    ] as TimeSeriesResponseItem[][]);
    expect(res).toEqual('(ts{id=1} + ts{id=2} + ts{id=3})');
  });
});

describe('find multiary function indices', () => {
  const funcWithOneParam = STSFunc('avg', [STS()]);
  const funcWithFewParams = STSFunc('avg', [STS(), STS()]);
  const funcComposition = [
    funcWithFewParams,
    Operator('+'),
    funcWithOneParam,
    Operator('/'),
    funcWithOneParam,
  ];
  const nestedComposition = [
    STSFunc('sin', funcComposition),
    Operator('+'),
    STSFunc('avg', funcComposition),
  ];
  const indices = getIndicesOfMultiaryFunctionArgs;

  it('valid for single param', () => {
    const res = indices(cloneDeep(funcWithOneParam));
    expect(res).toEqual([0]);
  });

  it('invalid if multiple params', () => {
    const res = indices(cloneDeep(funcWithFewParams));
    expect(res).toEqual([]);
  });

  it('works with composition of functions', () => {
    const res = indices(cloneDeep(funcComposition));
    expect(res).toEqual([2, 3]);
  });

  it('works with nested composition of functions', () => {
    const res = indices(cloneDeep(STSFunc('sin', funcComposition)));
    expect(res).toEqual([2, 3]);
  });

  it('works with complex nested composition of functions', () => {
    const res = indices(cloneDeep(nestedComposition));
    expect(res).toEqual([2, 3, 6, 7]);
  });

  it("map() is a special case, doesn't work as multiary", () => {
    const mapFunc = STSFunc('map', [STS(), ['1'], [1], 1]);
    const res = indices(mapFunc);
    expect(res).toEqual([]);
  });
});

describe('permutations', () => {
  const gen = generateAllPossiblePermutations;

  it('one element', () => {
    expect(gen([['a']])).toEqual([[['a']]]);
  });

  it('multiple elements', () => {
    expect(gen([['a'], ['1', '2', '3'], ['å', 'æ']])).toEqual([
      [['a'], ['1'], ['å']],
      [['a'], ['1'], ['æ']],
      [['a'], ['2'], ['å']],
      [['a'], ['2'], ['æ']],
      [['a'], ['3'], ['å']],
      [['a'], ['3'], ['æ']],
    ]);
  });

  it('1 lock', () => {
    expect(
      gen(
        [
          ['a', 'b'],
          ['1', '2', '3'],
          ['å', 'æ'],
        ],
        [1]
      )
    ).toEqual([
      [['a'], ['1', '2', '3'], ['å']],
      [['a'], ['1', '2', '3'], ['æ']],
      [['b'], ['1', '2', '3'], ['å']],
      [['b'], ['1', '2', '3'], ['æ']],
    ]);
  });

  it('multiple locks', () => {
    expect(gen([['a'], ['1', '2', '3'], ['å', 'æ']], [0, 1])).toEqual([
      [['a'], ['1', '2', '3'], ['å']],
      [['a'], ['1', '2', '3'], ['æ']],
    ]);
  });

  it('all locked', () => {
    expect(gen([['a'], ['1', '2', '3'], ['å', 'æ'], ['b']], [0, 1, 2, 3])).toEqual([
      [['a'], ['1', '2', '3'], ['å', 'æ'], ['b']],
    ]);
  });

  it('single elements locked', () => {
    expect(gen([['a'], ['1'], ['å'], ['b']], [0, 3])).toEqual([[['a'], ['1'], ['å'], ['b']]]);
  });

  it('single element locked', () => {
    expect(gen([['a'], ['b'], ['c']], [0])).toEqual([[['a'], ['b'], ['c']]]);
  });
});

describe('convert expression to label', () => {
  const convert = convertExpressionToLabel;

  it('1 ts and default label str', () => {
    const res = convert('ts{id=1}', '', {
      '1': { externalId: 'one' } as TimeSeriesResponseItem,
    });
    expect(res).toEqual('one');
  });

  it('2 ts and specified label', () => {
    const res = convert('ts{id=1} + ts{id=2}', '{{id}}', {
      '1': { id: 1, externalId: 'one' } as TimeSeriesResponseItem,
      '2': { id: 2, externalId: 'two' } as TimeSeriesResponseItem,
    });
    expect(res).toEqual('1 + 2');
  });

  it('parenthesis', () => {
    const res = convert('(ts{id=1} + ts{id=2})', '', {
      '1': { id: 1 } as TimeSeriesResponseItem,
      '2': { id: 2 } as TimeSeriesResponseItem,
    });
    expect(res).toEqual('(1 + 2)');
  });

  it('map(...)', () => {
    const res = convert(`map(ts{id=1}, ['one'], [1], 0)`, '', {
      '1': { id: 1 } as TimeSeriesResponseItem,
    });
    expect(res).toEqual(`map(1, ["one"], [1], 0)`);
  });
});

describe('parse unary "-" operator', () => {
  const long_expression = [];
  const long_expression_parsed = [];

  for (let i = 0; i < 19; i++) {
    long_expression.push('ts{id=1234567890}');
    long_expression_parsed.push(STS([Filter('id', 1234567890)]));
    long_expression_parsed.push(Operator('+'));
  }

  long_expression_parsed.pop();

  
  
  const queries: Array<[string, STSQuery]> = [
    ['-ts{name="test"}', [Operator('-'), STS([Filter('name', 'test')])]],
    [
      'ts{name="test1"} + - ts{name="test2"}',
      [
        STS([Filter('name', 'test1')]),
        Operator('+'),
        Operator('-'),
        STS([Filter('name', 'test2')]),
      ],
    ],
    [
      'ts{name="test1"} * (-ts{name="test2"})',
      [
        STS([Filter('name', 'test1')]),
        Operator('*'),
        STSFunc('', [Operator('-'), STS([Filter('name', 'test2')])]),
      ],
    ],
    [
      'ts{name="test1"} * ( - ts{name="test2"} + -5)',
      [
        STS([Filter('name', 'test1')]),
        Operator('*'),
        STSFunc('', [Operator('-'), STS([Filter('name', 'test2')]), Operator('+'), Operator('-'), Constant(5)])        
      ],
    ],
    [
      long_expression.join(' + '),
      long_expression_parsed,
    ],
  ];

  

  queries.map(([query, expected], index) =>
    it(query, () => {
      const startTime = Date.now(); // get current time
      expect(parse(query)).toEqual(expected);
      const endTime = Date.now(); // get current time
      const timeDiff = endTime - startTime; // in ms
      expect(timeDiff).toBeLessThan(10); // expect test to pass in 1 second
    },1000)
  );

  
});
describe('check if default aggregation and granularity will be added', () => {
  const defaults = { aggregate: 'average', granularity: '1h' };
  const defaultOnlyAggregate = { aggregate: 'average', granularity: '' };
  const defaultInterval = '6h';
  it('should add default aggregate and granularity', () => {
    const stsWithoutAggregation = STS([Filter('name', 'name')]);
    const withAggregates = enrichWithDefaultAggregates(
      stsWithoutAggregation,
      defaults,
      defaultInterval
    );

    expect(withAggregates).toEqual(
      STS([Filter('name', 'name'), Filter('aggregate', 'average'), Filter('granularity', '1h')])
    );
  });
  it('should add default granularity only', () => {
    const stsWithAggregate = STS([Filter('name', 'name'), Filter('aggregate', 'interpolation')]);
    const withAggregates = enrichWithDefaultAggregates(stsWithAggregate, defaults, defaultInterval);

    expect(withAggregates).toEqual(
      STS([
        Filter('name', 'name'),
        Filter('aggregate', 'interpolation'),
        Filter('granularity', '1h'),
      ])
    );
  });
  it('should add default aggregation only', () => {
    const stsWithGranularity = STS([Filter('name', 'name'), Filter('granularity', '1m')]);
    const withGranularity = enrichWithDefaultAggregates(
      stsWithGranularity,
      defaults,
      defaultInterval
    );

    expect(withGranularity).toEqual(
      STS([Filter('name', 'name'), Filter('granularity', '1m'), Filter('aggregate', 'average')])
    );
  });
  it('should ignore default values', () => {
    const stsWithAggregateAndGranularity = STS([
      Filter('name', 'name'),
      Filter('granularity', '1m'),
      Filter('aggregate', 'interpolation'),
    ]);
    const withAggregatesAndGranularity = enrichWithDefaultAggregates(
      stsWithAggregateAndGranularity,
      defaults,
      defaultInterval
    );

    expect(withAggregatesAndGranularity).toEqual(stsWithAggregateAndGranularity);
  });
  it('should not add default values in case of default aggregate is none', () => {
    const sts = STS([Filter('name', 'name')]);
    const stsWithInjected = enrichWithDefaultAggregates(
      sts,
      { aggregate: 'none', granularity: '2h' },
      defaultInterval
    );

    expect(stsWithInjected).toEqual(sts);
  });
  it('should set default interval if is is not provided in defaults', () => {
    const sts = STS([Filter('name', 'name')]);
    const stsWithInjected = enrichWithDefaultAggregates(sts, defaultOnlyAggregate, defaultInterval);

    expect(stsWithInjected).toEqual(
      STS([Filter('name', 'name'), Filter('aggregate', 'average'), Filter('granularity', '6h')])
    );
  });
});
