# The expression of the Synthetic time series tab: synthetic time series
# arithmetic and functions over named variables (A, pump_speed, …), which the
# pipeline replaces with ts{space=…, externalId=…} references. Forked from the
# legacy ts{} grammar; the ts{...} reference syntax itself is not accepted here.
@preprocessor typescript

@include "../common.ne"
@include "./pairs.ne"

@{%
// Mirrors RESERVED_VARIABLE_NAMES in ./variables.ts (a unit test keeps them in sync).
const FUNCTION_NAMES = new Set(['sin', 'cos', 'ln', 'sqrt', 'exp', 'abs', 'pow', 'round', 'on_error', 'max', 'min', 'avg', 'sum', 'map', 'pi']);
const extractIdentifier = ([first, rest]) => first + rest.join('');
const extractVariable = ([name], _loc, reject) => FUNCTION_NAMES.has(name) ? reject : { type: 'var', name };
// $x, ${x:fmt} and [[x]] only survive in the editor: they are interpolated before the pipeline parses.
const extractTemplate = ([name]) => ({ type: 'var', name, template: true });
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
%}

query -> _ trimmed _ {% d => d[1] %}

trimmed -> compositeElement {% id %}
  | function {% id %}

function ->  unary br arithmeticElements BR {% extractFunction %}
  | unary br oneElement BR {% extractFunction %}
  | binary br twoElements BR {% extractFunction %}
  | n_ary br commaSeparatedElements BR {% extractFunction %}
  | "map" br map_func_args BR {% extractFunction %}

oneElement -> arithmeticElement {% ([d]) => Array.isArray(d) ? d : [d] %}
twoElements -> compositeElement comma compositeElement {% extract2Elements %}
commaSeparatedElements -> compositeElement (comma compositeElement):* {% extractCommaSeparatedArray %}
arithmeticElements -> arithmeticElement (operator arithmeticElement):+ {% extractOperationsArray %}

map_func_args -> compositeElement "," array "," array comma number {% extractMapFuncArgs %}

compositeElement -> arithmeticElement {% id %}
  | arithmeticElements {% id %}

arithmeticElement -> (unary_operator):? element {% extractUnaryOperator %}

element -> function {% id %}
  | variable_ref {% id %}
  | variable {% extractTemplate %}
  | number {% extractNumber %}
  | "pi(" _ ")" {% extractPI %}

variable_ref -> identifier {% extractVariable %}
identifier -> [A-Za-z_] [A-Za-z0-9_]:* {% extractIdentifier %}

unary_operator -> _ "-" _ {% extractOperator %}
operator -> _ "+" _ {% extractOperator %}
  | _ "-" _ {% extractOperator %}
  | _ "/" _ {% extractOperator %}
  | _ "*" _ {% extractOperator %}
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
