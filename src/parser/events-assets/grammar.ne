@preprocessor typescript

@include "../common.ne"

@{%
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
%}

rule -> type condition {% formatQuery %}
type -> "assets" {% id %}
  | "events" {% id %}

condition -> "{" "}" {% emptyArray %}
  | "{" _ pair _ ("," _ pair _):* _ "}" {% extractConditionToArray %}

regexp_string -> sqregexp {% id %}
  | dqregexp {% id %}

string -> sqstring {% id %}
  | dqstring {% id %}
array -> "[" _ "]" {% emptyArray %}
  | "[" _ value _ ("," _ value _):* _ "]" {% extractArray %}
object -> "{" _ "}" {% emptyObject %}
	| "{" _ pair _ ("," _ pair _):* _ "}" {% extractObject %}
pair -> prop_name _ equals _ value {% d => [d[0], d[4]] %}
  | prop_name _ regexp _ regexp_string {% d => [d[0], d[2], d[4]] %}
  | prop_name _ not_equals _ primitive {% d => [d[0], d[2], d[4]] %}
