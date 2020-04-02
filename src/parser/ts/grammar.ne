@preprocessor typescript

@builtin "number.ne"
@builtin "string.ne"

@{%
const join = ([d]) => joinArr(d);
const joinArr = (d) => d.join('');
const formatQuery = ([type, query]) => ({type, query});
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
  const output = [d[0]];

  for (let i in d[1]) {
    output.push(d[1][i][0]);
	  output.push(d[1][i][1]);
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

const emptyObject = () => ({});
const emptyArray = () => ([]);
%}

query -> _ trimmed _ {% d => d[1] %}

trimmed -> compositeElement {% id %}
  | function {% id %}

function -> unary br arithmethicElements BR {% extractFunction %}
  | unary br oneElement BR {% extractFunction %}
  | binary br twoElements BR {% extractFunction %}
  | n_ary br commaSeparatedElements BR {% extractFunction %}
  | "map" br map_func_args BR {% extractFunction %}

oneElement -> element {% extractCommaSeparatedArray %}
twoElements -> compositeElement comma compositeElement {% extract2Elements %}
commaSeparatedElements -> compositeElement (comma compositeElement):* {% extractCommaSeparatedArray %}
arithmethicElements -> element (operator element):+ {% extractOperationsArray %}

map_func_args -> compositeElement "," array "," array comma number {% extractMapFuncArgs %}

compositeElement -> element {% id %}
  | arithmethicElements {% id %}

element -> function {% id %}
  | type condition {% formatQuery %}
  | number {% extractNumber %}
  | "pi(" _ ")" {% extractPI %}

type -> "ts" {% id %}
  | "TS" {% ([d]) => d.toLowerCase() %}

condition -> curl CURL {% emptyArray %}
  | curl pair (comma pair):* CURL {% extractConditionToArray %}

filter -> "!=" {% id %}
  | "=~" {% id %}
  | "!~" {% id %}
equals -> "=" {% id %}
prop_name -> [A-Za-z0-9_]:+ {% join %}

string -> sqstring {% id %}
  | dqstring {% id %}
number -> decimal {% id %}
array -> sqr SQR {% emptyArray %}
  | sqr value (comma value):* SQR {% extractArray %}
object -> curl CURL {% emptyObject %}
  | curl pair (comma pair):* CURL {% extractObject %}
pair -> prop_name equals value
  | prop_name filter string
value ->
  object {% id %}
  | array {% id %}
  | number {% id %}
  | string {% id %}
  | variable {% id %}
  | "true" {% () => true %}
  | "false" {% () => false %}
  | "null" {% () => null %}

variable -> "$" prop_name {% joinArr %}
  | "[[" prop_name "]]" {% joinArr %}
  | "$" advanced_variable {% joinArr %}
  
advanced_variable -> "{" prop_name ":" prop_name "}" {% joinArr %}

operator -> _ "+" _ {% extractOperator %}
  | _ "-" _ {% extractOperator %}
  | _ "/" _ {% extractOperator %}
  | _ "*" _ {% extractOperator %}
comma -> _ "," _ {% d => d[1] %}
unary -> "sin" {% id %}
  | "cos" {% id %}
  | "ln" {% id %}
  | "sqrt" {% id %}
  | "exp" {% id %}
  | "abs" {% id %}
  | null {% id %}
binary -> "pow" {% id %}
  | "round" {% id %}
  | "on_error" {% id %}
n_ary -> "max" {% id %}
  | "min" {% id %}
  | "avg" {% id %}
  | "sum" {% id %}
br ->  _ "(" {% null %}
BR ->  _ ")" {% null %}
curl ->  _ "{" {% null %}
CURL ->  _ "}" {% null %}
sqr ->  _ "[" {% null %}
SQR ->  _ "]" {% null %}
_ -> [\s]:*  {% null %}
