// Generated automatically by nearley, version 2.19.7
// http://github.com/Hardmath123/nearley
// Bypasses TS6133. Allow declared but unused functions.
// @ts-nocheck

/* eslint-disable */
function id(d: any[]): any { return d[0]; }

const formatQuery = ([type, query]) => ({type, query});
const emptyObject = () => ({});
const emptyArray = () => ([]);


const join = ([d]) => d.join('');
const extractPair = d => {
  return d.length > 2
	? {[d[0]+d[1]]:{key: d[0], filter: d[1], value: d[2]}}
	: {[d[0]]: d[1]}
}
const extractConditionToArray = d => {
  if(!d.length) return [];
  const output = [extractPair(d[2])];

  for (let i in d[4]) {
  	output.push(extractPair(d[4][i][2]))
  }

  return output
}
const extractObject = d => {
  let output = {...extractPair(d[2])};

  for (let i in d[4]) {
    output = {...output, ...extractPair(d[4][i][2])};
  }

  return output;
}
const extractArray = d => {
  const output = [d[2]];

  for (let i in d[4]) {
    output.push(d[4][i][2]);
  }

  return output;
}

interface NearleyToken {  value: any;
  [key: string]: any;
};

interface NearleyLexer {
  reset: (chunk: string, info: any) => void;
  next: () => NearleyToken | undefined;
  save: () => any;
  formatError: (token: NearleyToken) => string;
  has: (tokenType: string) => boolean;
};

interface NearleyRule {
  name: string;
  symbols: NearleySymbol[];
  postprocess?: (d: any[], loc?: number, reject?: {}) => any;
};

type NearleySymbol = string | { literal: any } | { test: (token: any) => boolean };

interface Grammar {
  Lexer: NearleyLexer | undefined;
  ParserRules: NearleyRule[];
  ParserStart: string;
};

const grammar: Grammar = {
  Lexer: undefined,
  ParserRules: [
    {"name": "unsigned_int$ebnf$1", "symbols": [/[0-9]/]},
    {"name": "unsigned_int$ebnf$1", "symbols": ["unsigned_int$ebnf$1", /[0-9]/], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "unsigned_int", "symbols": ["unsigned_int$ebnf$1"], "postprocess":
        function(d) {
            return parseInt(d[0].join(""));
        }
        },
    {"name": "int$ebnf$1$subexpression$1", "symbols": [{"literal":"-"}]},
    {"name": "int$ebnf$1$subexpression$1", "symbols": [{"literal":"+"}]},
    {"name": "int$ebnf$1", "symbols": ["int$ebnf$1$subexpression$1"], "postprocess": id},
    {"name": "int$ebnf$1", "symbols": [], "postprocess": () => null},
    {"name": "int$ebnf$2", "symbols": [/[0-9]/]},
    {"name": "int$ebnf$2", "symbols": ["int$ebnf$2", /[0-9]/], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "int", "symbols": ["int$ebnf$1", "int$ebnf$2"], "postprocess":
        function(d) {
            if (d[0]) {
                return parseInt(d[0][0]+d[1].join(""));
            } else {
                return parseInt(d[1].join(""));
            }
        }
        },
    {"name": "unsigned_decimal$ebnf$1", "symbols": [/[0-9]/]},
    {"name": "unsigned_decimal$ebnf$1", "symbols": ["unsigned_decimal$ebnf$1", /[0-9]/], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "unsigned_decimal$ebnf$2$subexpression$1$ebnf$1", "symbols": [/[0-9]/]},
    {"name": "unsigned_decimal$ebnf$2$subexpression$1$ebnf$1", "symbols": ["unsigned_decimal$ebnf$2$subexpression$1$ebnf$1", /[0-9]/], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "unsigned_decimal$ebnf$2$subexpression$1", "symbols": [{"literal":"."}, "unsigned_decimal$ebnf$2$subexpression$1$ebnf$1"]},
    {"name": "unsigned_decimal$ebnf$2", "symbols": ["unsigned_decimal$ebnf$2$subexpression$1"], "postprocess": id},
    {"name": "unsigned_decimal$ebnf$2", "symbols": [], "postprocess": () => null},
    {"name": "unsigned_decimal", "symbols": ["unsigned_decimal$ebnf$1", "unsigned_decimal$ebnf$2"], "postprocess":
        function(d) {
            return parseFloat(
                d[0].join("") +
                (d[1] ? "."+d[1][1].join("") : "")
            );
        }
        },
    {"name": "decimal$ebnf$1", "symbols": [{"literal":"-"}], "postprocess": id},
    {"name": "decimal$ebnf$1", "symbols": [], "postprocess": () => null},
    {"name": "decimal$ebnf$2", "symbols": [/[0-9]/]},
    {"name": "decimal$ebnf$2", "symbols": ["decimal$ebnf$2", /[0-9]/], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "decimal$ebnf$3$subexpression$1$ebnf$1", "symbols": [/[0-9]/]},
    {"name": "decimal$ebnf$3$subexpression$1$ebnf$1", "symbols": ["decimal$ebnf$3$subexpression$1$ebnf$1", /[0-9]/], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "decimal$ebnf$3$subexpression$1", "symbols": [{"literal":"."}, "decimal$ebnf$3$subexpression$1$ebnf$1"]},
    {"name": "decimal$ebnf$3", "symbols": ["decimal$ebnf$3$subexpression$1"], "postprocess": id},
    {"name": "decimal$ebnf$3", "symbols": [], "postprocess": () => null},
    {"name": "decimal", "symbols": ["decimal$ebnf$1", "decimal$ebnf$2", "decimal$ebnf$3"], "postprocess":
        function(d) {
            return parseFloat(
                (d[0] || "") +
                d[1].join("") +
                (d[2] ? "."+d[2][1].join("") : "")
            );
        }
        },
    {"name": "percentage", "symbols": ["decimal", {"literal":"%"}], "postprocess":
        function(d) {
            return d[0]/100;
        }
        },
    {"name": "jsonfloat$ebnf$1", "symbols": [{"literal":"-"}], "postprocess": id},
    {"name": "jsonfloat$ebnf$1", "symbols": [], "postprocess": () => null},
    {"name": "jsonfloat$ebnf$2", "symbols": [/[0-9]/]},
    {"name": "jsonfloat$ebnf$2", "symbols": ["jsonfloat$ebnf$2", /[0-9]/], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "jsonfloat$ebnf$3$subexpression$1$ebnf$1", "symbols": [/[0-9]/]},
    {"name": "jsonfloat$ebnf$3$subexpression$1$ebnf$1", "symbols": ["jsonfloat$ebnf$3$subexpression$1$ebnf$1", /[0-9]/], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "jsonfloat$ebnf$3$subexpression$1", "symbols": [{"literal":"."}, "jsonfloat$ebnf$3$subexpression$1$ebnf$1"]},
    {"name": "jsonfloat$ebnf$3", "symbols": ["jsonfloat$ebnf$3$subexpression$1"], "postprocess": id},
    {"name": "jsonfloat$ebnf$3", "symbols": [], "postprocess": () => null},
    {"name": "jsonfloat$ebnf$4$subexpression$1$ebnf$1", "symbols": [/[+-]/], "postprocess": id},
    {"name": "jsonfloat$ebnf$4$subexpression$1$ebnf$1", "symbols": [], "postprocess": () => null},
    {"name": "jsonfloat$ebnf$4$subexpression$1$ebnf$2", "symbols": [/[0-9]/]},
    {"name": "jsonfloat$ebnf$4$subexpression$1$ebnf$2", "symbols": ["jsonfloat$ebnf$4$subexpression$1$ebnf$2", /[0-9]/], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "jsonfloat$ebnf$4$subexpression$1", "symbols": [/[eE]/, "jsonfloat$ebnf$4$subexpression$1$ebnf$1", "jsonfloat$ebnf$4$subexpression$1$ebnf$2"]},
    {"name": "jsonfloat$ebnf$4", "symbols": ["jsonfloat$ebnf$4$subexpression$1"], "postprocess": id},
    {"name": "jsonfloat$ebnf$4", "symbols": [], "postprocess": () => null},
    {"name": "jsonfloat", "symbols": ["jsonfloat$ebnf$1", "jsonfloat$ebnf$2", "jsonfloat$ebnf$3", "jsonfloat$ebnf$4"], "postprocess":
        function(d) {
            return parseFloat(
                (d[0] || "") +
                d[1].join("") +
                (d[2] ? "."+d[2][1].join("") : "") +
                (d[3] ? "e" + (d[3][1] || "+") + d[3][2].join("") : "")
            );
        }
        },
    {"name": "regexp$string$1", "symbols": [{"literal":"="}, {"literal":"~"}], "postprocess": (d) => d.join('')},
    {"name": "regexp", "symbols": ["regexp$string$1"], "postprocess": id},
    {"name": "regexp$string$2", "symbols": [{"literal":"!"}, {"literal":"~"}], "postprocess": (d) => d.join('')},
    {"name": "regexp", "symbols": ["regexp$string$2"], "postprocess": id},
    {"name": "equals", "symbols": [{"literal":"="}], "postprocess": id},
    {"name": "not_equals$string$1", "symbols": [{"literal":"!"}, {"literal":"="}], "postprocess": (d) => d.join('')},
    {"name": "not_equals", "symbols": ["not_equals$string$1"], "postprocess": id},
    {"name": "prop_name$ebnf$1", "symbols": [/[A-Za-z0-9_]/]},
    {"name": "prop_name$ebnf$1", "symbols": ["prop_name$ebnf$1", /[A-Za-z0-9_]/], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "prop_name", "symbols": ["prop_name$ebnf$1"], "postprocess": join},
    {"name": "number", "symbols": ["decimal"], "postprocess": id},
    {"name": "dqstring$ebnf$1", "symbols": []},
    {"name": "dqstring$ebnf$1", "symbols": ["dqstring$ebnf$1", "dstrchar"], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "dqstring", "symbols": [{"literal":"\""}, "dqstring$ebnf$1", {"literal":"\""}], "postprocess": d => d[1].join("")},
    {"name": "sqstring$ebnf$1", "symbols": []},
    {"name": "sqstring$ebnf$1", "symbols": ["sqstring$ebnf$1", "sstrchar"], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "sqstring", "symbols": [{"literal":"'"}, "sqstring$ebnf$1", {"literal":"'"}], "postprocess": d => d[1].join("")},
    {"name": "dqregexp$ebnf$1", "symbols": []},
    {"name": "dqregexp$ebnf$1", "symbols": ["dqregexp$ebnf$1", "ndstrchar"], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "dqregexp", "symbols": [{"literal":"\""}, "dqregexp$ebnf$1", {"literal":"\""}], "postprocess": d => d[1].join("")},
    {"name": "sqregexp$ebnf$1", "symbols": []},
    {"name": "sqregexp$ebnf$1", "symbols": ["sqregexp$ebnf$1", "nsstrchar"], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "sqregexp", "symbols": [{"literal":"'"}, "sqregexp$ebnf$1", {"literal":"'"}], "postprocess": d => d[1].join("")},
    {"name": "dstrchar", "symbols": [/[^\\"\n]/], "postprocess": id},
    {"name": "dstrchar", "symbols": ["backslash", "strescape"], "postprocess": d => JSON.parse("\""+d.join("")+"\"")},
    {"name": "dstrchar$string$1", "symbols": [{"literal":"\\"}, {"literal":"\""}], "postprocess": (d) => d.join('')},
    {"name": "dstrchar", "symbols": ["dstrchar$string$1"], "postprocess": d => "\""},
    {"name": "sstrchar", "symbols": [/[^\\'\n]/], "postprocess": id},
    {"name": "sstrchar", "symbols": ["backslash", "strescape"], "postprocess": d => JSON.parse("\""+d.join("")+"\"")},
    {"name": "sstrchar$string$1", "symbols": [{"literal":"\\"}, {"literal":"'"}], "postprocess": (d) => d.join('')},
    {"name": "sstrchar", "symbols": ["sstrchar$string$1"], "postprocess": d => "'"},
    {"name": "ndstrchar", "symbols": [/[^\\"\n]/], "postprocess": id},
    {"name": "ndstrchar", "symbols": ["backslash", "unicode"], "postprocess": d => JSON.parse("\""+d.join("")+"\"")},
    {"name": "ndstrchar$string$1", "symbols": [{"literal":"\\"}, {"literal":"\""}], "postprocess": (d) => d.join('')},
    {"name": "ndstrchar", "symbols": ["ndstrchar$string$1"], "postprocess": d => "\\\""},
    {"name": "ndstrchar", "symbols": ["backslash"], "postprocess": id},
    {"name": "nsstrchar", "symbols": [/[^\\'\n]/], "postprocess": id},
    {"name": "nsstrchar", "symbols": ["backslash", "unicode"], "postprocess": d => JSON.parse("\""+d.join("")+"\"")},
    {"name": "nsstrchar$string$1", "symbols": [{"literal":"\\"}, {"literal":"'"}], "postprocess": (d) => d.join('')},
    {"name": "nsstrchar", "symbols": ["nsstrchar$string$1"], "postprocess": d => "\\'"},
    {"name": "nsstrchar", "symbols": ["backslash"], "postprocess": id},
    {"name": "strescape", "symbols": [/["\\/bfnrt]/], "postprocess": id},
    {"name": "strescape", "symbols": ["unicode"], "postprocess": id},
    {"name": "backslash", "symbols": [{"literal":"\\"}], "postprocess": d => "\\"},
    {"name": "unicode", "symbols": [{"literal":"u"}, /[a-fA-F0-9]/, /[a-fA-F0-9]/, /[a-fA-F0-9]/, /[a-fA-F0-9]/], "postprocess": d => d.join("")},
    {"name": "_$ebnf$1", "symbols": []},
    {"name": "_$ebnf$1", "symbols": ["_$ebnf$1", /[\s]/], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "_", "symbols": ["_$ebnf$1"], "postprocess": null},
    {"name": "value", "symbols": ["object"], "postprocess": id},
    {"name": "value", "symbols": ["array"], "postprocess": id},
    {"name": "value", "symbols": ["primitive"], "postprocess": id},
    {"name": "primitive", "symbols": ["number"], "postprocess": id},
    {"name": "primitive", "symbols": ["string"], "postprocess": id},
    {"name": "primitive$string$1", "symbols": [{"literal":"t"}, {"literal":"r"}, {"literal":"u"}, {"literal":"e"}], "postprocess": (d) => d.join('')},
    {"name": "primitive", "symbols": ["primitive$string$1"], "postprocess": () => true},
    {"name": "primitive$string$2", "symbols": [{"literal":"f"}, {"literal":"a"}, {"literal":"l"}, {"literal":"s"}, {"literal":"e"}], "postprocess": (d) => d.join('')},
    {"name": "primitive", "symbols": ["primitive$string$2"], "postprocess": () => false},
    {"name": "primitive$string$3", "symbols": [{"literal":"n"}, {"literal":"u"}, {"literal":"l"}, {"literal":"l"}], "postprocess": (d) => d.join('')},
    {"name": "primitive", "symbols": ["primitive$string$3"], "postprocess": () => null},
    {"name": "rule", "symbols": ["type", "condition"], "postprocess": formatQuery},
    {"name": "type$string$1", "symbols": [{"literal":"a"}, {"literal":"s"}, {"literal":"s"}, {"literal":"e"}, {"literal":"t"}, {"literal":"s"}], "postprocess": (d) => d.join('')},
    {"name": "type", "symbols": ["type$string$1"], "postprocess": id},
    {"name": "type$string$2", "symbols": [{"literal":"e"}, {"literal":"v"}, {"literal":"e"}, {"literal":"n"}, {"literal":"t"}, {"literal":"s"}], "postprocess": (d) => d.join('')},
    {"name": "type", "symbols": ["type$string$2"], "postprocess": id},
    {"name": "condition", "symbols": [{"literal":"{"}, {"literal":"}"}], "postprocess": emptyArray},
    {"name": "condition$ebnf$1", "symbols": []},
    {"name": "condition$ebnf$1$subexpression$1", "symbols": [{"literal":","}, "_", "pair", "_"]},
    {"name": "condition$ebnf$1", "symbols": ["condition$ebnf$1", "condition$ebnf$1$subexpression$1"], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "condition", "symbols": [{"literal":"{"}, "_", "pair", "_", "condition$ebnf$1", "_", {"literal":"}"}], "postprocess": extractConditionToArray},
    {"name": "regexp_string", "symbols": ["sqregexp"], "postprocess": id},
    {"name": "regexp_string", "symbols": ["dqregexp"], "postprocess": id},
    {"name": "string", "symbols": ["sqstring"], "postprocess": id},
    {"name": "string", "symbols": ["dqstring"], "postprocess": id},
    {"name": "array", "symbols": [{"literal":"["}, "_", {"literal":"]"}], "postprocess": emptyArray},
    {"name": "array$ebnf$1", "symbols": []},
    {"name": "array$ebnf$1$subexpression$1", "symbols": [{"literal":","}, "_", "value", "_"]},
    {"name": "array$ebnf$1", "symbols": ["array$ebnf$1", "array$ebnf$1$subexpression$1"], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "array", "symbols": [{"literal":"["}, "_", "value", "_", "array$ebnf$1", "_", {"literal":"]"}], "postprocess": extractArray},
    {"name": "object", "symbols": [{"literal":"{"}, "_", {"literal":"}"}], "postprocess": emptyObject},
    {"name": "object$ebnf$1", "symbols": []},
    {"name": "object$ebnf$1$subexpression$1", "symbols": [{"literal":","}, "_", "pair", "_"]},
    {"name": "object$ebnf$1", "symbols": ["object$ebnf$1", "object$ebnf$1$subexpression$1"], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "object", "symbols": [{"literal":"{"}, "_", "pair", "_", "object$ebnf$1", "_", {"literal":"}"}], "postprocess": extractObject},
    {"name": "pair", "symbols": ["prop_name", "_", "equals", "_", "value"], "postprocess": d => [d[0], d[4]]},
    {"name": "pair", "symbols": ["prop_name", "_", "regexp", "_", "regexp_string"], "postprocess": d => [d[0], d[2], d[4]]},
    {"name": "pair", "symbols": ["prop_name", "_", "not_equals", "_", "primitive"], "postprocess": d => [d[0], d[2], d[4]]}
  ],
  ParserStart: "rule",
};

export default grammar;
