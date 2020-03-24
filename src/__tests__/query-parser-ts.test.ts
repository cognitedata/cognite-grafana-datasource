import {
  STSQueryItem,
  getReferencedTimeseries,
  getServerFilters,
  flattenServerQueryFilters,
  parse,
  reverse,
  generateAllPossiblePermutations,
  STSFunction,
  injectTSIdsInExpression,
  FilterQueryItem,
  STSRefQueryItem,
  getIndicesOfMultiaryFunctionArgs,
  convertExpressionToLabel,
  Operator,
} from '../query-parser/ts/parser';
import { FilterType } from '../query-parser/types';
import { TimeSeriesResponseItem } from '../types';
import { cloneDeep } from 'lodash';

const { NotEquals } = FilterType;

function STSFunction(func: STSFunction['func'], args: STSFunction['args']): STSFunction {
  return {
    func,
    args,
  } as STSFunction;
}

const testSeries: STSQueryItem[] = [
  STSRefQueryItem([FilterQueryItem('id', 2), FilterQueryItem('hey', 'other', NotEquals)]),
  STSRefQueryItem(),
  STSRefQueryItem([FilterQueryItem('id', 2, NotEquals), FilterQueryItem('name', 'value')]),
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
    expect(
      flattenServerQueryFilters([
        FilterQueryItem('name', 'value'),
        FilterQueryItem('name2', 'value2'),
      ])
    ).toEqual({
      name: 'value',
      name2: 'value2',
    });
  });

  it('get flat server filters', () => {
    expect(getServerFilters(testSeries)).toEqual([{}, { name: 'value' }]);
  });

  it('flatten nested server filters', () => {
    expect(
      flattenServerQueryFilters([
        FilterQueryItem('a', [FilterQueryItem('b', 'c')]),
      ])
    ).toEqual({
      a: {
        b: 'c'
      },
    });
  });

  it('flatten nested server filters with arrays', () => {
    expect(
      flattenServerQueryFilters([
        FilterQueryItem('a', [[FilterQueryItem('b', 'c')]]),
      ])
    ).toEqual({
      a: [{
        b: 'c'
      }],
    });
  });
});

describe('nearley parser', () => {
  it('one time serie', () => {
    const res = parse(`ts{id=1}`);
    expect(res).toEqual(STSRefQueryItem([FilterQueryItem('id', 1)]));
  });

  it('simple arithmethics', () => {
    const res = parse(`ts{id=1} - ts{a=2}`);
    expect(res).toEqual([
      STSRefQueryItem([FilterQueryItem('id', 1)]),
      Operator('-'),
      STSRefQueryItem([FilterQueryItem('a', 2)]),
    ]);
  });

  it('function with arithmetics and filters', () => {
    const res = parse(`sin(ts{assetSubtreeIds=[{id=1}], aggregate="average"} / 10)`);
    expect(res).toEqual(
      STSFunction('sin', [
        STSRefQueryItem([
          FilterQueryItem('assetSubtreeIds', [[FilterQueryItem('id', 1)]]),
          FilterQueryItem('aggregate', 'average'),
        ]),
        Operator('/'),
        {
          constant: 10,
        },
      ])
    );
  });

  it('template variables', () => {
    const res = parse(`ts{id=[[asset]]}`);
    expect(res).toEqual(STSRefQueryItem([FilterQueryItem('id', '$asset')]));
  });
});

describe('nearley reverse', () => {
  it('simple arithmethics', () => {
    const res = reverse([
      STSRefQueryItem([FilterQueryItem('id', 1)]),
      Operator('-'),
      STSRefQueryItem([FilterQueryItem('a', 2)]),
    ]);
    expect(res).toEqual('ts{id=1} - ts{a=2}');
  });

  it('sin function with arithmetics', () => {
    const func = STSFunction('sin', [
      STSRefQueryItem([FilterQueryItem('id', 1)]),
      Operator('/'),
      {
        constant: 10,
      },
    ]);
    const res = reverse(func);
    expect(res).toEqual('sin(ts{id=1} / 10)');
  });

  it('average function', () => {
    const func = STSFunction('avg', [
      STSRefQueryItem([FilterQueryItem('id', 1)]),
      STSRefQueryItem([FilterQueryItem('id', 2)]),
    ]);
    const res = reverse(func);
    expect(res).toEqual('avg(ts{id=1}, ts{id=2})');
  });

  it('nested filters', () => {
    const func = STSRefQueryItem(
      [FilterQueryItem(
        'metadata',
        [FilterQueryItem('nested', [[FilterQueryItem('a', 'b')], [FilterQueryItem('c', [])]])]
      )]
    )
    const res = reverse(func);
    expect(res).toEqual('ts{metadata={nested=[{a="b"}, {c=[]}]}}');
  })
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
    'ts{assetSubtreeIds=[{id=1}]}',
  ];
  inputs.map(input => it(input, () => {
    expect(reverse(parse(input))).toBe(input);
  }));
})

describe('inject ids in queries', () => {
  it('function with arithmetics', () => {
    const func = STSFunction('sin', [
      STSRefQueryItem([FilterQueryItem('assetSubtreeIds', [FilterQueryItem('id', 1)])]),
      Operator('/'),
      {
        constant: 10,
      },
    ]);
    const res = injectTSIdsInExpression(func, [[{ id: 1 } as TimeSeriesResponseItem]]);
    expect(res).toEqual('sin(ts{id=1} / 10)');
  });

  it('multiary function', () => {
    const func = STSFunction('avg', [
      STSRefQueryItem([FilterQueryItem('assetSubtreeIds', [FilterQueryItem('id', 1)])]),
    ]);
    const res = injectTSIdsInExpression(func, [
      [{ id: 1 }, { id: 2 }, { id: 3 }],
    ] as TimeSeriesResponseItem[][]);
    expect(res).toEqual('avg(ts{id=1}, ts{id=2}, ts{id=3})');
  });

  it('sum function with one filter', () => {
    const func = STSFunction('sum', [
      STSRefQueryItem([FilterQueryItem('assetSubtreeIds', [FilterQueryItem('id', 1)])]),
    ]);
    const res = injectTSIdsInExpression(func, [
      [{ id: 1 }, { id: 2 }, { id: 3 }],
    ] as TimeSeriesResponseItem[][]);
    expect(res).toEqual('(ts{id=1} + ts{id=2} + ts{id=3})');
  });
});

describe('find multiary function indices', () => {
  const funcWithOneParam = STSFunction('avg', [STSRefQueryItem()]);
  const funcWithFewParams = STSFunction('avg', [STSRefQueryItem(), STSRefQueryItem()]);
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

  it('valid for single param', () => {
    const res = getIndicesOfMultiaryFunctionArgs(cloneDeep(funcWithOneParam));
    expect(res).toEqual([0]);
  });

  it('invalid if multiple params', () => {
    const res = getIndicesOfMultiaryFunctionArgs(cloneDeep(funcWithFewParams));
    expect(res).toEqual([]);
  });

  it('works with composition of functions', () => {
    const res = getIndicesOfMultiaryFunctionArgs(cloneDeep(funcComposition));
    expect(res).toEqual([2, 3]);
  });

  it('works with nested composition of functions', () => {
    const res = getIndicesOfMultiaryFunctionArgs(cloneDeep(STSFunction('sin', funcComposition)));
    expect(res).toEqual([2, 3]);
  });

  it('works with complex nested composition of functions', () => {
    const res = getIndicesOfMultiaryFunctionArgs(cloneDeep(nestedComposition));
    expect(res).toEqual([2, 3, 6, 7]);
  });

  it('map() is a special case, doesn\'t work as multiary', () => {
    const mapFunc = STSFunction('map', [STSRefQueryItem(), ['1'], [1], 1]);
    const res = getIndicesOfMultiaryFunctionArgs(mapFunc);
    expect(res).toEqual([]);
  });
});

describe('permutations', () => {
  it('with one element', () => {
    expect(generateAllPossiblePermutations([['a']])).toEqual([[['a']]]);
  });

  it('with multiple elements', () => {
    expect(generateAllPossiblePermutations([['a'], ['1', '2', '3'], ['å', 'æ']])).toEqual([
      [['a'], ['1'], ['å']],
      [['a'], ['1'], ['æ']],
      [['a'], ['2'], ['å']],
      [['a'], ['2'], ['æ']],
      [['a'], ['3'], ['å']],
      [['a'], ['3'], ['æ']],
    ]);
  });

  it('with 1 lock', () => {
    expect(generateAllPossiblePermutations([['a', 'b'], ['1', '2', '3'], ['å', 'æ']], [1])).toEqual(
      [
        [['a'], ['1', '2', '3'], ['å']],
        [['a'], ['1', '2', '3'], ['æ']],
        [['b'], ['1', '2', '3'], ['å']],
        [['b'], ['1', '2', '3'], ['æ']],
      ]
    );
  });

  it('with multiple locks', () => {
    expect(generateAllPossiblePermutations([['a'], ['1', '2', '3'], ['å', 'æ']], [0, 1])).toEqual([
      [['a'], ['1', '2', '3'], ['å']],
      [['a'], ['1', '2', '3'], ['æ']],
    ]);
  });

  it('with all locked', () => {
    expect(
      generateAllPossiblePermutations([['a'], ['1', '2', '3'], ['å', 'æ'], ['b']], [0, 1, 2, 3])
    ).toEqual([[['a'], ['1', '2', '3'], ['å', 'æ'], ['b']]]);
  });

  it('with single elements locked', () => {
    expect(generateAllPossiblePermutations([['a'], ['1'], ['å'], ['b']], [0, 3])).toEqual([
      [['a'], ['1'], ['å'], ['b']],
    ]);
  });

  it('with single element locked', () => {
    expect(generateAllPossiblePermutations([['a'], ['b'], ['c']], [0])).toEqual([
      [['a'], ['b'], ['c']],
    ]);
  });
});

describe('convert expression to label', () => {
  it('works with 1 ts and default label str', () => {
    const res = convertExpressionToLabel('ts{id=1}', '', {
      '1': { externalId: 'one' } as TimeSeriesResponseItem,
    });
    expect(res).toEqual('one');
  });

  it('works with 2 ts and specified label', () => {
    const res = convertExpressionToLabel('ts{id=1} + ts{id=2}', '{{id}}', {
      '1': { id: 1, externalId: 'one' } as TimeSeriesResponseItem,
      '2': { id: 2, externalId: 'two' } as TimeSeriesResponseItem,
    });
    expect(res).toEqual('1 + 2');
  });

  it('works with parenthesis', () => {
    const res = convertExpressionToLabel('(ts{id=1} + ts{id=2})', '', {
      '1': { id: 1 } as TimeSeriesResponseItem,
      '2': { id: 2 } as TimeSeriesResponseItem,
    });
    expect(res).toEqual('(1 + 2)');
  });

  it('works with map(...)', () => {
    const res = convertExpressionToLabel(`map(ts{id=1}, ['one'], [1], 0)`, '', {
      '1': { id: 1 } as TimeSeriesResponseItem
    });
    expect(res).toEqual(`map(1, ["one"], [1], 0)`);
  })
});
