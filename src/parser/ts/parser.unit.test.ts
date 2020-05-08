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
  hasAggregates,
} from './index';
import { FilterType } from '../types';
import { TimeSeriesResponseItem } from '../../types';
import { cloneDeep } from 'lodash';

const { NotEquals, Equals } = FilterType;
const STS = STSReference;
const Filter = STSFilter;

function Constant(constant: number | 'pi()'): WrappedConst {
  return { constant };
}

function STSFunction(func: STSFunction['func'], args: STSFunction['args']): STSFunction {
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

  it('function with arithmetics and filters', () => {
    const res = parse(`sin(ts{assetSubtreeIds=[{id=1}], aggregate="average"} / 10)`);
    expect(res).toEqual(
      STSFunction('sin', [
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
    const res = parse('ts{id=${asset:json}}');
    expect(res).toEqual(STS([Filter('id', '${asset:json}')]));
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
    const func = STSFunction('sin', [STS([Filter('id', 1)]), Operator('/'), Constant(10)]);
    const res = composeSTSQuery(func);
    expect(res).toEqual('sin(ts{id=1} / 10)');
  });

  it('average function', () => {
    const func = STSFunction('avg', [STS([Filter('id', 1)]), STS([Filter('id', 2)])]);
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
  inputs.map(input =>
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
  ];
  const outputs = [
    STS([Filter('name', r`\d some`)]),
    STS([Filter('name', r`\\d some`)]),
    STS([Filter('name', r`\\d " some`)]),
    STS([Filter('name', r`\\d \" some`)]),
  ];

  inputs.map((input, index) =>
    it(input, () => {
      expect(parse(input)).toEqual(outputs[index]);
    })
  );
});

describe('inject ids in queries', () => {
  it('function with arithmetics', () => {
    const func = STSFunction('sin', [
      STS([Filter('assetSubtreeIds', [Filter('id', 1)])]),
      Operator('/'),
      Constant(10),
    ]);
    const res = injectTSIdsInExpression(func, [[{ id: 1 } as TimeSeriesResponseItem]]);
    expect(res).toEqual('sin(ts{id=1} / 10)');
  });

  it('multiary function', () => {
    const func = STSFunction('avg', [STS([Filter('assetSubtreeIds', [Filter('id', 1)])])]);
    const res = injectTSIdsInExpression(func, [
      [{ id: 1 }, { id: 2 }, { id: 3 }],
    ] as TimeSeriesResponseItem[][]);
    expect(res).toEqual('avg(ts{id=1}, ts{id=2}, ts{id=3})');
  });

  it('sum function with one filter', () => {
    const func = STSFunction('sum', [STS([Filter('assetSubtreeIds', [Filter('id', 1)])])]);
    const res = injectTSIdsInExpression(func, [
      [{ id: 1 }, { id: 2 }, { id: 3 }],
    ] as TimeSeriesResponseItem[][]);
    expect(res).toEqual('(ts{id=1} + ts{id=2} + ts{id=3})');
  });
});

describe('find multiary function indices', () => {
  const funcWithOneParam = STSFunction('avg', [STS()]);
  const funcWithFewParams = STSFunction('avg', [STS(), STS()]);
  const funcComposition = [
    funcWithFewParams,
    Operator('+'),
    funcWithOneParam,
    Operator('/'),
    funcWithOneParam,
  ];
  const nestedComposition = [
    STSFunction('sin', funcComposition),
    Operator('+'),
    STSFunction('avg', funcComposition),
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
    const res = indices(cloneDeep(STSFunction('sin', funcComposition)));
    expect(res).toEqual([2, 3]);
  });

  it('works with complex nested composition of functions', () => {
    const res = indices(cloneDeep(nestedComposition));
    expect(res).toEqual([2, 3, 6, 7]);
  });

  it("map() is a special case, doesn't work as multiary", () => {
    const mapFunc = STSFunction('map', [STS(), ['1'], [1], 1]);
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
    expect(gen([['a', 'b'], ['1', '2', '3'], ['å', 'æ']], [1])).toEqual([
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

describe('check if expression has aggregates', () => {
  it('works with simple expressions', () => {
    expect(hasAggregates('ts{}')).toBeFalsy();
    expect(hasAggregates('ts{id=1}')).toBeFalsy();
    expect(hasAggregates('ts{aggregate="something"}')).toBeTruthy();
    expect(hasAggregates('ts{granularity="1s"}')).toBeTruthy();
  });
});
