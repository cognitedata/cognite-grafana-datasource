// Generated automatically by nearley, version 2.19.1
// http://github.com/Hardmath123/nearley
// Bypasses TS6133. Allow declared but unused functions.
// @ts-ignore
function id(d: any[]): any { return d[0]; }

const formatQuery = ([type, query]) => ({type, query});
const emptyObject = () => ({});
const emptyArray = () => ([]);


const join = ([d]) => joinArr(d);
const joinArr = (d) => d.join('');
const extractPair = d => {
  return {
	  path: d[0],
	  filter: d[1],
	  value: d[2]
  }
}
const extractConditionPair = ([path, filter, value]) => {
  return path ? {path, filter, value} : {}
}

const extract = (extractor, d) => {
  let output = {...extractor(d[1])};

  for (let i in d[2]) {
    output = {...output, ...extractor(d[2][i][2])};
  }

  return output;
}
const extractConditionToArray = d => {
  if(!d.length) return [];
  const output = [extractPair(d[1])];

  for (let i in d[2]) {
    output.push(extractPair(d[2][i][1]))
  }

  return output
}
const extractObject = d => {
  let output = [extractPair(d[1])];

  for (let i in d[2]) {
    output.push(extractPair(d[2][i][1]));
  }

  return output;
}
const extractArray = d => {
  const output = [d[1]];

  for (let i in d[2]) {
    output.push(d[2][i][1]);
  }

  return output;
}
const extractOperationsArray = d => {
  const output = Array.isArray(d[0]) ? [...d[0]] : [d[0]];

  for (let i in d[1]) {
    const flatten = [].concat(...d[1][i])
    output.push(...flatten);
  }

  return output;
}
const extractCommaSeparatedArray = d => {
  const output = [d[0]];

  for (let i in d[1]) {
    output.push(d[1][i][1]);
  }
  return output;
}
const extractMapFuncArgs = d => {
  return d.filter(d => d !== ',')
}
const extract2Elements = d => {
	return [d[0], d[2]]
}
const extractOperator = ([s, operator, S]) => {
  return { operator }
}
const extractNumber = ([constant]) => {
  return { constant }
}
const extractPI = d => {
  return { constant: d[0] + d[2] }
}
const extractFunction = ([func, br, args, BR]) => {
  if (args && args.length) {
    return { func: func || '', args }
  }
  return { func }
}
const extractUnaryOperator = ([operator, element]) => operator ? [operator[0], element] : element;

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
    {"name": "query", "symbols": ["_", "trimmed", "_"], "postprocess": d => d[1]},
    {"name": "trimmed", "symbols": ["compositeElement"], "postprocess": id},
    {"name": "trimmed", "symbols": ["function"], "postprocess": id},
    {"name": "function", "symbols": ["unary", "br", "arithmeticElements", "BR"], "postprocess": extractFunction},
    {"name": "function", "symbols": ["unary", "br", "oneElement", "BR"], "postprocess": extractFunction},
    {"name": "function", "symbols": ["binary", "br", "twoElements", "BR"], "postprocess": extractFunction},
    {"name": "function", "symbols": ["n_ary", "br", "commaSeparatedElements", "BR"], "postprocess": extractFunction},
    {"name": "function$string$1", "symbols": [{"literal":"m"}, {"literal":"a"}, {"literal":"p"}], "postprocess": (d) => d.join('')},
    {"name": "function", "symbols": ["function$string$1", "br", "map_func_args", "BR"], "postprocess": extractFunction},
    {"name": "oneElement", "symbols": ["arithmeticElement"], "postprocess": ([d]) => Array.isArray(d) ? d : [d]},
    {"name": "twoElements", "symbols": ["compositeElement", "comma", "compositeElement"], "postprocess": extract2Elements},
    {"name": "commaSeparatedElements$ebnf$1", "symbols": []},
    {"name": "commaSeparatedElements$ebnf$1$subexpression$1", "symbols": ["comma", "compositeElement"]},
    {"name": "commaSeparatedElements$ebnf$1", "symbols": ["commaSeparatedElements$ebnf$1", "commaSeparatedElements$ebnf$1$subexpression$1"], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "commaSeparatedElements", "symbols": ["compositeElement", "commaSeparatedElements$ebnf$1"], "postprocess": extractCommaSeparatedArray},
    {"name": "arithmeticElements$ebnf$1$subexpression$1", "symbols": ["operator", "arithmeticElement"]},
    {"name": "arithmeticElements$ebnf$1", "symbols": ["arithmeticElements$ebnf$1$subexpression$1"]},
    {"name": "arithmeticElements$ebnf$1$subexpression$2", "symbols": ["operator", "arithmeticElement"]},
    {"name": "arithmeticElements$ebnf$1", "symbols": ["arithmeticElements$ebnf$1", "arithmeticElements$ebnf$1$subexpression$2"], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "arithmeticElements", "symbols": ["arithmeticElement", "arithmeticElements$ebnf$1"], "postprocess": extractOperationsArray},
    {"name": "map_func_args", "symbols": ["compositeElement", {"literal":","}, "array", {"literal":","}, "array", "comma", "number"], "postprocess": extractMapFuncArgs},
    {"name": "compositeElement", "symbols": ["arithmeticElement"], "postprocess": id},
    {"name": "compositeElement", "symbols": ["arithmeticElements"], "postprocess": id},
    {"name": "arithmeticElement$ebnf$1$subexpression$1", "symbols": ["unary_operator"]},
    {"name": "arithmeticElement$ebnf$1", "symbols": ["arithmeticElement$ebnf$1$subexpression$1"], "postprocess": id},
    {"name": "arithmeticElement$ebnf$1", "symbols": [], "postprocess": () => null},
    {"name": "arithmeticElement", "symbols": ["arithmeticElement$ebnf$1", "element"], "postprocess": extractUnaryOperator},
    {"name": "element", "symbols": ["function"], "postprocess": id},
    {"name": "element", "symbols": ["type", "condition"], "postprocess": formatQuery},
    {"name": "element", "symbols": ["number"], "postprocess": extractNumber},
    {"name": "element$string$1", "symbols": [{"literal":"p"}, {"literal":"i"}, {"literal":"("}], "postprocess": (d) => d.join('')},
    {"name": "element", "symbols": ["element$string$1", "_", {"literal":")"}], "postprocess": extractPI},
    {"name": "type$string$1", "symbols": [{"literal":"t"}, {"literal":"s"}], "postprocess": (d) => d.join('')},
    {"name": "type", "symbols": ["type$string$1"], "postprocess": id},
    {"name": "type$string$2", "symbols": [{"literal":"T"}, {"literal":"S"}], "postprocess": (d) => d.join('')},
    {"name": "type", "symbols": ["type$string$2"], "postprocess": ([d]) => d.toLowerCase()},
    {"name": "condition", "symbols": ["curl", "CURL"], "postprocess": emptyArray},
    {"name": "condition$ebnf$1", "symbols": []},
    {"name": "condition$ebnf$1$subexpression$1", "symbols": ["comma", "pair"]},
    {"name": "condition$ebnf$1", "symbols": ["condition$ebnf$1", "condition$ebnf$1$subexpression$1"], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "condition", "symbols": ["curl", "pair", "condition$ebnf$1", "CURL"], "postprocess": extractConditionToArray},
    {"name": "string", "symbols": ["sqstring"], "postprocess": id},
    {"name": "string", "symbols": ["dqstring"], "postprocess": id},
    {"name": "string", "symbols": ["variable"], "postprocess": id},
    {"name": "regexp_string", "symbols": ["sqregexp"], "postprocess": id},
    {"name": "regexp_string", "symbols": ["dqregexp"], "postprocess": id},
    {"name": "regexp_string", "symbols": ["variable"], "postprocess": id},
    {"name": "array", "symbols": ["sqr", "SQR"], "postprocess": emptyArray},
    {"name": "array$ebnf$1", "symbols": []},
    {"name": "array$ebnf$1$subexpression$1", "symbols": ["comma", "value"]},
    {"name": "array$ebnf$1", "symbols": ["array$ebnf$1", "array$ebnf$1$subexpression$1"], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "array", "symbols": ["sqr", "value", "array$ebnf$1", "SQR"], "postprocess": extractArray},
    {"name": "object", "symbols": ["curl", "CURL"], "postprocess": emptyObject},
    {"name": "object$ebnf$1", "symbols": []},
    {"name": "object$ebnf$1$subexpression$1", "symbols": ["comma", "pair"]},
    {"name": "object$ebnf$1", "symbols": ["object$ebnf$1", "object$ebnf$1$subexpression$1"], "postprocess": (d) => d[0].concat([d[1]])},
    {"name": "object", "symbols": ["curl", "pair", "object$ebnf$1", "CURL"], "postprocess": extractObject},
    {"name": "pair", "symbols": ["prop_name", "_", "equals", "_", "value"], "postprocess": d => ([d[0], d[2], d[4]])},
    {"name": "pair", "symbols": ["prop_name", "_", "not_equals", "_", "primitive"], "postprocess": d => ([d[0], d[2], d[4]])},
    {"name": "pair", "symbols": ["prop_name", "_", "regexp", "_", "regexp_string"], "postprocess": d => ([d[0], d[2], d[4]])},
    {"name": "variable", "symbols": [{"literal":"$"}, "prop_name"], "postprocess": joinArr},
    {"name": "variable$string$1", "symbols": [{"literal":"["}, {"literal":"["}], "postprocess": (d) => d.join('')},
    {"name": "variable$string$2", "symbols": [{"literal":"]"}, {"literal":"]"}], "postprocess": (d) => d.join('')},
    {"name": "variable", "symbols": ["variable$string$1", "prop_name", "variable$string$2"], "postprocess": joinArr},
    {"name": "variable", "symbols": [{"literal":"$"}, "advanced_variable"], "postprocess": joinArr},
    {"name": "advanced_variable", "symbols": [{"literal":"{"}, "prop_name", {"literal":":"}, "prop_name", {"literal":"}"}], "postprocess": joinArr},
    {"name": "unary_operator", "symbols": ["_", {"literal":"-"}, "_"], "postprocess": extractOperator},
    {"name": "operator", "symbols": ["_", {"literal":"+"}, "_"], "postprocess": extractOperator},
    {"name": "operator", "symbols": ["_", {"literal":"-"}, "_"], "postprocess": extractOperator},
    {"name": "operator", "symbols": ["_", {"literal":"/"}, "_"], "postprocess": extractOperator},
    {"name": "operator", "symbols": ["_", {"literal":"*"}, "_"], "postprocess": extractOperator},
    {"name": "comma", "symbols": ["_", {"literal":","}, "_"], "postprocess": d => d[1]},
    {"name": "unary$string$1", "symbols": [{"literal":"s"}, {"literal":"i"}, {"literal":"n"}], "postprocess": (d) => d.join('')},
    {"name": "unary", "symbols": ["unary$string$1"], "postprocess": id},
    {"name": "unary$string$2", "symbols": [{"literal":"c"}, {"literal":"o"}, {"literal":"s"}], "postprocess": (d) => d.join('')},
    {"name": "unary", "symbols": ["unary$string$2"], "postprocess": id},
    {"name": "unary$string$3", "symbols": [{"literal":"l"}, {"literal":"n"}], "postprocess": (d) => d.join('')},
    {"name": "unary", "symbols": ["unary$string$3"], "postprocess": id},
    {"name": "unary$string$4", "symbols": [{"literal":"s"}, {"literal":"q"}, {"literal":"r"}, {"literal":"t"}], "postprocess": (d) => d.join('')},
    {"name": "unary", "symbols": ["unary$string$4"], "postprocess": id},
    {"name": "unary$string$5", "symbols": [{"literal":"e"}, {"literal":"x"}, {"literal":"p"}], "postprocess": (d) => d.join('')},
    {"name": "unary", "symbols": ["unary$string$5"], "postprocess": id},
    {"name": "unary$string$6", "symbols": [{"literal":"a"}, {"literal":"b"}, {"literal":"s"}], "postprocess": (d) => d.join('')},
    {"name": "unary", "symbols": ["unary$string$6"], "postprocess": id},
    {"name": "unary", "symbols": [], "postprocess": id},
    {"name": "binary$string$1", "symbols": [{"literal":"p"}, {"literal":"o"}, {"literal":"w"}], "postprocess": (d) => d.join('')},
    {"name": "binary", "symbols": ["binary$string$1"], "postprocess": id},
    {"name": "binary$string$2", "symbols": [{"literal":"r"}, {"literal":"o"}, {"literal":"u"}, {"literal":"n"}, {"literal":"d"}], "postprocess": (d) => d.join('')},
    {"name": "binary", "symbols": ["binary$string$2"], "postprocess": id},
    {"name": "binary$string$3", "symbols": [{"literal":"o"}, {"literal":"n"}, {"literal":"_"}, {"literal":"e"}, {"literal":"r"}, {"literal":"r"}, {"literal":"o"}, {"literal":"r"}], "postprocess": (d) => d.join('')},
    {"name": "binary", "symbols": ["binary$string$3"], "postprocess": id},
    {"name": "n_ary$string$1", "symbols": [{"literal":"m"}, {"literal":"a"}, {"literal":"x"}], "postprocess": (d) => d.join('')},
    {"name": "n_ary", "symbols": ["n_ary$string$1"], "postprocess": id},
    {"name": "n_ary$string$2", "symbols": [{"literal":"m"}, {"literal":"i"}, {"literal":"n"}], "postprocess": (d) => d.join('')},
    {"name": "n_ary", "symbols": ["n_ary$string$2"], "postprocess": id},
    {"name": "n_ary$string$3", "symbols": [{"literal":"a"}, {"literal":"v"}, {"literal":"g"}], "postprocess": (d) => d.join('')},
    {"name": "n_ary", "symbols": ["n_ary$string$3"], "postprocess": id},
    {"name": "n_ary$string$4", "symbols": [{"literal":"s"}, {"literal":"u"}, {"literal":"m"}], "postprocess": (d) => d.join('')},
    {"name": "n_ary", "symbols": ["n_ary$string$4"], "postprocess": id},
    {"name": "br", "symbols": ["_", {"literal":"("}], "postprocess": null},
    {"name": "BR", "symbols": ["_", {"literal":")"}], "postprocess": null},
    {"name": "curl", "symbols": ["_", {"literal":"{"}], "postprocess": null},
    {"name": "CURL", "symbols": ["_", {"literal":"}"}], "postprocess": null},
    {"name": "sqr", "symbols": ["_", {"literal":"["}], "postprocess": null},
    {"name": "SQR", "symbols": ["_", {"literal":"]"}], "postprocess": null}
  ],
  ParserStart: "query",
};

export default grammar;
