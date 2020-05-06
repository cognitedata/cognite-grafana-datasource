@preprocessor typescript

@builtin "number.ne"
@builtin "string.ne"

@{%
const join = ([d]) => d.join('');
const formatQuery = ([type, query]) => ({type, query});
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

const emptyObject = () => ({});
const emptyArray = () => ([]);
%}

rule -> type condition {% formatQuery %}
type -> "assets" {% id %}
  | "events" {% id %}

condition -> "{" "}" {% emptyArray %}
  | "{" _ pair _ ("," _ pair _):* _ "}" {% extractConditionToArray %}

regexp -> "=~" {% id %}
  | "!~" {% id %}
equals -> "=" {% id %}
not_equals -> "!=" {% id %}
prop_name -> [A-Za-z0-9_]:+ {% join %}

string -> sqstring {% id %}
  | dqstring {% id %}
number -> decimal {% id %}
array -> "[" _ "]" {% emptyArray %}
  | "[" _ value _ ("," _ value _):* _ "]" {% extractArray %}
object -> "{" _ "}" {% emptyObject %}
	| "{" _ pair _ ("," _ pair _):* _ "}" {% extractObject %}
pair -> prop_name _ equals _ value {% d => [d[0], d[4]] %}
  | prop_name _ regexp _ string {% d => [d[0], d[2], d[4]] %}
  | prop_name _ not_equals _ primitive {% d => [d[0], d[2], d[4]] %}
value -> object {% id %}
  | array {% id %}
  | primitive {% id %}
primitive -> number {% id %}
  | string {% id %}
  | "true" {% d => true %}
  | "false" {% d => false %}
  | "null" {% d => null %}
_ -> [\s]:*  {% null %}
