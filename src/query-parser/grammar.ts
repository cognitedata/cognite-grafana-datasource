// Generated automatically by nearley, version 2.19.1
// http://github.com/Hardmath123/nearley
// Bypasses TS6133. Allow declared but unused functions.
// @ts-ignore
function id(d: any[]): any {
  return d[0];
}

const join = ([d]) => d.join('');
const formatQuery = ([type, query]) => ({ type, query });
const extractPair = d => {
  return d.length > 2 ? { [d[0]]: { filter: d[1], value: d[2] } } : { [d[0]]: d[1] };
};
const extractConditionPair = ([key, filter, value]) => {
  return key ? { key, filter, value } : {};
};

const extract = (extraxtor, d) => {
  let output = { ...extraxtor(d[1]) };

  for (const i in d[2]) {
    output = { ...output, ...extraxtor(d[2][i][2]) };
  }

  return output;
};
const extractConditionToArray = d => {
  if (!d.length) return [];
  const output = [extractPair(d[1])];

  for (const i in d[2]) {
    output.push(extractPair(d[2][i][2]));
  }

  return output;
};
// const extractObject = extract.bind(null, extractPair);
const extractObject = d => {
  let output = { ...extractPair(d[1]) };

  for (const i in d[2]) {
    output = { ...output, ...extractPair(d[2][i][2]) };
  }

  return output;
};
const extractCodition = extract.bind(null, extractConditionPair);
const extractArray = d => {
  const output = [d[1]];

  for (const i in d[2]) {
    output.push(d[2][i][2]);
  }

  return output;
};

const emptyObject = () => ({});
const emptyArray = () => [];

interface NearleyToken {
  value: any;
  [key: string]: any;
}

interface NearleyLexer {
  reset: (chunk: string, info: any) => void;
  next: () => NearleyToken | undefined;
  save: () => any;
  formatError: (token: NearleyToken) => string;
  has: (tokenType: string) => boolean;
}

interface NearleyRule {
  name: string;
  symbols: NearleySymbol[];
  postprocess?: (d: any[], loc?: number, reject?: {}) => any;
}

type NearleySymbol = string | { literal: any } | { test: (token: any) => boolean };

interface Grammar {
  Lexer: NearleyLexer | undefined;
  ParserRules: NearleyRule[];
  ParserStart: string;
}

const grammar: Grammar = {
  Lexer: undefined,
  ParserRules: [
    { name: 'unsigned_int$ebnf$1', symbols: [/[0-9]/] },
    {
      name: 'unsigned_int$ebnf$1',
      symbols: ['unsigned_int$ebnf$1', /[0-9]/],
      postprocess: d => d[0].concat([d[1]]),
    },
    {
      name: 'unsigned_int',
      symbols: ['unsigned_int$ebnf$1'],
      postprocess(d) {
        return parseInt(d[0].join(''));
      },
    },
    { name: 'int$ebnf$1$subexpression$1', symbols: [{ literal: '-' }] },
    { name: 'int$ebnf$1$subexpression$1', symbols: [{ literal: '+' }] },
    { name: 'int$ebnf$1', symbols: ['int$ebnf$1$subexpression$1'], postprocess: id },
    { name: 'int$ebnf$1', symbols: [], postprocess: () => null },
    { name: 'int$ebnf$2', symbols: [/[0-9]/] },
    { name: 'int$ebnf$2', symbols: ['int$ebnf$2', /[0-9]/], postprocess: d => d[0].concat([d[1]]) },
    {
      name: 'int',
      symbols: ['int$ebnf$1', 'int$ebnf$2'],
      postprocess(d) {
        if (d[0]) {
          return parseInt(d[0][0] + d[1].join(''));
        }
        return parseInt(d[1].join(''));
      },
    },
    { name: 'unsigned_decimal$ebnf$1', symbols: [/[0-9]/] },
    {
      name: 'unsigned_decimal$ebnf$1',
      symbols: ['unsigned_decimal$ebnf$1', /[0-9]/],
      postprocess: d => d[0].concat([d[1]]),
    },
    { name: 'unsigned_decimal$ebnf$2$subexpression$1$ebnf$1', symbols: [/[0-9]/] },
    {
      name: 'unsigned_decimal$ebnf$2$subexpression$1$ebnf$1',
      symbols: ['unsigned_decimal$ebnf$2$subexpression$1$ebnf$1', /[0-9]/],
      postprocess: d => d[0].concat([d[1]]),
    },
    {
      name: 'unsigned_decimal$ebnf$2$subexpression$1',
      symbols: [{ literal: '.' }, 'unsigned_decimal$ebnf$2$subexpression$1$ebnf$1'],
    },
    {
      name: 'unsigned_decimal$ebnf$2',
      symbols: ['unsigned_decimal$ebnf$2$subexpression$1'],
      postprocess: id,
    },
    { name: 'unsigned_decimal$ebnf$2', symbols: [], postprocess: () => null },
    {
      name: 'unsigned_decimal',
      symbols: ['unsigned_decimal$ebnf$1', 'unsigned_decimal$ebnf$2'],
      postprocess(d) {
        return parseFloat(d[0].join('') + (d[1] ? '.' + d[1][1].join('') : ''));
      },
    },
    { name: 'decimal$ebnf$1', symbols: [{ literal: '-' }], postprocess: id },
    { name: 'decimal$ebnf$1', symbols: [], postprocess: () => null },
    { name: 'decimal$ebnf$2', symbols: [/[0-9]/] },
    {
      name: 'decimal$ebnf$2',
      symbols: ['decimal$ebnf$2', /[0-9]/],
      postprocess: d => d[0].concat([d[1]]),
    },
    { name: 'decimal$ebnf$3$subexpression$1$ebnf$1', symbols: [/[0-9]/] },
    {
      name: 'decimal$ebnf$3$subexpression$1$ebnf$1',
      symbols: ['decimal$ebnf$3$subexpression$1$ebnf$1', /[0-9]/],
      postprocess: d => d[0].concat([d[1]]),
    },
    {
      name: 'decimal$ebnf$3$subexpression$1',
      symbols: [{ literal: '.' }, 'decimal$ebnf$3$subexpression$1$ebnf$1'],
    },
    { name: 'decimal$ebnf$3', symbols: ['decimal$ebnf$3$subexpression$1'], postprocess: id },
    { name: 'decimal$ebnf$3', symbols: [], postprocess: () => null },
    {
      name: 'decimal',
      symbols: ['decimal$ebnf$1', 'decimal$ebnf$2', 'decimal$ebnf$3'],
      postprocess(d) {
        return parseFloat((d[0] || '') + d[1].join('') + (d[2] ? '.' + d[2][1].join('') : ''));
      },
    },
    {
      name: 'percentage',
      symbols: ['decimal', { literal: '%' }],
      postprocess(d) {
        return d[0] / 100;
      },
    },
    { name: 'jsonfloat$ebnf$1', symbols: [{ literal: '-' }], postprocess: id },
    { name: 'jsonfloat$ebnf$1', symbols: [], postprocess: () => null },
    { name: 'jsonfloat$ebnf$2', symbols: [/[0-9]/] },
    {
      name: 'jsonfloat$ebnf$2',
      symbols: ['jsonfloat$ebnf$2', /[0-9]/],
      postprocess: d => d[0].concat([d[1]]),
    },
    { name: 'jsonfloat$ebnf$3$subexpression$1$ebnf$1', symbols: [/[0-9]/] },
    {
      name: 'jsonfloat$ebnf$3$subexpression$1$ebnf$1',
      symbols: ['jsonfloat$ebnf$3$subexpression$1$ebnf$1', /[0-9]/],
      postprocess: d => d[0].concat([d[1]]),
    },
    {
      name: 'jsonfloat$ebnf$3$subexpression$1',
      symbols: [{ literal: '.' }, 'jsonfloat$ebnf$3$subexpression$1$ebnf$1'],
    },
    { name: 'jsonfloat$ebnf$3', symbols: ['jsonfloat$ebnf$3$subexpression$1'], postprocess: id },
    { name: 'jsonfloat$ebnf$3', symbols: [], postprocess: () => null },
    { name: 'jsonfloat$ebnf$4$subexpression$1$ebnf$1', symbols: [/[+-]/], postprocess: id },
    { name: 'jsonfloat$ebnf$4$subexpression$1$ebnf$1', symbols: [], postprocess: () => null },
    { name: 'jsonfloat$ebnf$4$subexpression$1$ebnf$2', symbols: [/[0-9]/] },
    {
      name: 'jsonfloat$ebnf$4$subexpression$1$ebnf$2',
      symbols: ['jsonfloat$ebnf$4$subexpression$1$ebnf$2', /[0-9]/],
      postprocess: d => d[0].concat([d[1]]),
    },
    {
      name: 'jsonfloat$ebnf$4$subexpression$1',
      symbols: [
        /[eE]/,
        'jsonfloat$ebnf$4$subexpression$1$ebnf$1',
        'jsonfloat$ebnf$4$subexpression$1$ebnf$2',
      ],
    },
    { name: 'jsonfloat$ebnf$4', symbols: ['jsonfloat$ebnf$4$subexpression$1'], postprocess: id },
    { name: 'jsonfloat$ebnf$4', symbols: [], postprocess: () => null },
    {
      name: 'jsonfloat',
      symbols: ['jsonfloat$ebnf$1', 'jsonfloat$ebnf$2', 'jsonfloat$ebnf$3', 'jsonfloat$ebnf$4'],
      postprocess(d) {
        return parseFloat(
          (d[0] || '') +
            d[1].join('') +
            (d[2] ? '.' + d[2][1].join('') : '') +
            (d[3] ? 'e' + (d[3][1] || '+') + d[3][2].join('') : '')
        );
      },
    },
    { name: 'dqstring$ebnf$1', symbols: [] },
    {
      name: 'dqstring$ebnf$1',
      symbols: ['dqstring$ebnf$1', 'dstrchar'],
      postprocess: d => d[0].concat([d[1]]),
    },
    {
      name: 'dqstring',
      symbols: [{ literal: '"' }, 'dqstring$ebnf$1', { literal: '"' }],
      postprocess(d) {
        return d[1].join('');
      },
    },
    { name: 'sqstring$ebnf$1', symbols: [] },
    {
      name: 'sqstring$ebnf$1',
      symbols: ['sqstring$ebnf$1', 'sstrchar'],
      postprocess: d => d[0].concat([d[1]]),
    },
    {
      name: 'sqstring',
      symbols: [{ literal: "'" }, 'sqstring$ebnf$1', { literal: "'" }],
      postprocess(d) {
        return d[1].join('');
      },
    },
    { name: 'btstring$ebnf$1', symbols: [] },
    {
      name: 'btstring$ebnf$1',
      symbols: ['btstring$ebnf$1', /[^`]/],
      postprocess: d => d[0].concat([d[1]]),
    },
    {
      name: 'btstring',
      symbols: [{ literal: '`' }, 'btstring$ebnf$1', { literal: '`' }],
      postprocess(d) {
        return d[1].join('');
      },
    },
    { name: 'dstrchar', symbols: [/[^\\"\n]/], postprocess: id },
    {
      name: 'dstrchar',
      symbols: [{ literal: '\\' }, 'strescape'],
      postprocess(d) {
        return JSON.parse('"' + d.join('') + '"');
      },
    },
    { name: 'sstrchar', symbols: [/[^\\'\n]/], postprocess: id },
    {
      name: 'sstrchar',
      symbols: [{ literal: '\\' }, 'strescape'],
      postprocess(d) {
        return JSON.parse('"' + d.join('') + '"');
      },
    },
    {
      name: 'sstrchar$string$1',
      symbols: [{ literal: '\\' }, { literal: "'" }],
      postprocess: d => d.join(''),
    },
    {
      name: 'sstrchar',
      symbols: ['sstrchar$string$1'],
      postprocess(d) {
        return "'";
      },
    },
    { name: 'strescape', symbols: [/["\\/bfnrt]/], postprocess: id },
    {
      name: 'strescape',
      symbols: [{ literal: 'u' }, /[a-fA-F0-9]/, /[a-fA-F0-9]/, /[a-fA-F0-9]/, /[a-fA-F0-9]/],
      postprocess(d) {
        return d.join('');
      },
    },
    { name: 'query', symbols: ['rule'], postprocess: id },
    { name: 'rule', symbols: ['type', 'condition'], postprocess: formatQuery },
    {
      name: 'type$string$1',
      symbols: [
        { literal: 'a' },
        { literal: 's' },
        { literal: 's' },
        { literal: 'e' },
        { literal: 't' },
        { literal: 's' },
      ],
      postprocess: d => d.join(''),
    },
    { name: 'type', symbols: ['type$string$1'], postprocess: id },
    {
      name: 'type$string$2',
      symbols: [
        { literal: 't' },
        { literal: 'i' },
        { literal: 'm' },
        { literal: 'e' },
        { literal: 's' },
        { literal: 'e' },
        { literal: 'r' },
        { literal: 'i' },
        { literal: 'e' },
        { literal: 's' },
      ],
      postprocess: d => d.join(''),
    },
    { name: 'type', symbols: ['type$string$2'], postprocess: id },
    { name: 'condition', symbols: [{ literal: '{' }, { literal: '}' }], postprocess: emptyArray },
    { name: 'condition$ebnf$1', symbols: [] },
    { name: 'condition$ebnf$1$subexpression$1', symbols: [{ literal: ',' }, '_', 'pair'] },
    {
      name: 'condition$ebnf$1',
      symbols: ['condition$ebnf$1', 'condition$ebnf$1$subexpression$1'],
      postprocess: d => d[0].concat([d[1]]),
    },
    {
      name: 'condition',
      symbols: [{ literal: '{' }, 'pair', 'condition$ebnf$1', { literal: '}' }],
      postprocess: extractConditionToArray,
    },
    {
      name: 'filter$string$1',
      symbols: [{ literal: '!' }, { literal: '=' }],
      postprocess: d => d.join(''),
    },
    { name: 'filter', symbols: ['filter$string$1'], postprocess: id },
    {
      name: 'filter$string$2',
      symbols: [{ literal: '=' }, { literal: '~' }],
      postprocess: d => d.join(''),
    },
    { name: 'filter', symbols: ['filter$string$2'], postprocess: id },
    {
      name: 'filter$string$3',
      symbols: [{ literal: '!' }, { literal: '~' }],
      postprocess: d => d.join(''),
    },
    { name: 'filter', symbols: ['filter$string$3'], postprocess: id },
    { name: 'equals', symbols: [{ literal: '=' }], postprocess: id },
    { name: 'prop_name$ebnf$1', symbols: [/[A-z0-9\._]/] },
    {
      name: 'prop_name$ebnf$1',
      symbols: ['prop_name$ebnf$1', /[A-z0-9\._]/],
      postprocess: d => d[0].concat([d[1]]),
    },
    { name: 'prop_name', symbols: ['prop_name$ebnf$1'], postprocess: join },
    { name: 'string', symbols: ['sqstring'], postprocess: id },
    { name: 'number', symbols: ['unsigned_int'], postprocess: id },
    { name: 'array', symbols: [{ literal: '[' }, { literal: ']' }], postprocess: emptyArray },
    { name: 'array$ebnf$1', symbols: [] },
    { name: 'array$ebnf$1$subexpression$1', symbols: [{ literal: ',' }, '_', 'value'] },
    {
      name: 'array$ebnf$1',
      symbols: ['array$ebnf$1', 'array$ebnf$1$subexpression$1'],
      postprocess: d => d[0].concat([d[1]]),
    },
    {
      name: 'array',
      symbols: [{ literal: '[' }, 'value', 'array$ebnf$1', { literal: ']' }],
      postprocess: extractArray,
    },
    { name: 'object', symbols: [{ literal: '{' }, { literal: '}' }], postprocess: emptyObject },
    { name: 'object$ebnf$1', symbols: [] },
    { name: 'object$ebnf$1$subexpression$1', symbols: [{ literal: ',' }, '_', 'pair'] },
    {
      name: 'object$ebnf$1',
      symbols: ['object$ebnf$1', 'object$ebnf$1$subexpression$1'],
      postprocess: d => d[0].concat([d[1]]),
    },
    {
      name: 'object',
      symbols: [{ literal: '{' }, 'pair', 'object$ebnf$1', { literal: '}' }],
      postprocess: extractObject,
    },
    {
      name: 'pair',
      symbols: ['prop_name', 'equals', 'value'],
      postprocess(d) {
        return [d[0], d[2]];
      },
    },
    { name: 'pair', symbols: ['prop_name', 'filter', 'string'] },
    { name: 'value', symbols: ['object'], postprocess: id },
    { name: 'value', symbols: ['array'], postprocess: id },
    { name: 'value', symbols: ['number'], postprocess: id },
    { name: 'value', symbols: ['string'], postprocess: id },
    {
      name: 'value$string$1',
      symbols: [{ literal: 't' }, { literal: 'r' }, { literal: 'u' }, { literal: 'e' }],
      postprocess: d => d.join(''),
    },
    {
      name: 'value',
      symbols: ['value$string$1'],
      postprocess(d) {
        return true;
      },
    },
    {
      name: 'value$string$2',
      symbols: [
        { literal: 'f' },
        { literal: 'a' },
        { literal: 'l' },
        { literal: 's' },
        { literal: 'e' },
      ],
      postprocess: d => d.join(''),
    },
    {
      name: 'value',
      symbols: ['value$string$2'],
      postprocess(d) {
        return false;
      },
    },
    {
      name: 'value$string$3',
      symbols: [{ literal: 'n' }, { literal: 'u' }, { literal: 'l' }, { literal: 'l' }],
      postprocess: d => d.join(''),
    },
    {
      name: 'value',
      symbols: ['value$string$3'],
      postprocess(d) {
        return null;
      },
    },
    { name: '_', symbols: [] },
    { name: '_', symbols: [{ literal: ' ' }], postprocess: null },
  ],
  ParserStart: 'query',
};

export default grammar;
