@preprocessor typescript

@builtin "number.ne"
@builtin "string.ne"

@{%
const join = ([d]) => d.join('');
const formatQuery = ([type, query]) => ({type, query});
const extractPair = d => {
  return d.length > 2
	? {[d[0]]:{ filter: d[1], value: d[2]}}
	: {[d[0]]: d[1]}
}
const extractConditionToArray = d => {
  if(!d.length) return [];
  const output = [extractPair(d[1])];

  for (let i in d[2]) {
  	output.push(extractPair(d[2][i][2]))
  }

  return output
}
const extractObject = d => {
  let output = {...extractPair(d[1])};

  for (let i in d[2]) {
      output = {...output, ...extractPair(d[2][i][2])};
  }

  return output;
}
const extractArray = d => {
  const output = [d[1]];

  for (let i in d[2]) {
      output.push(d[2][i][2]);
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
  | "{" pair ("," _ pair):* "}" {% extractConditionToArray %}

filter -> "!=" {% id %}
  | "=~" {% id %}
  | "!~" {% id %}
equals -> "=" {% id %}
prop_name -> [A-z0-9_]:+ {% join %}

string -> sqstring {% id %}
number -> unsigned_int {% id %}
array -> "[" "]" {% emptyArray %}
  | "[" value ("," _ value):* "]" {% extractArray %}
object -> "{" "}" {% emptyObject %}
	| "{" pair ("," _ pair):* "}" {% extractObject %}
pair -> prop_name equals value {% d => { return [d[0], d[2]]; } %}
 | prop_name filter string
value ->
    object {% id %}
  | array {% id %}
  | number {% id %}
  | string {% id %}
  | "true" {% d => true %}
  | "false" {% d => false %}
  | "null" {% d => null %}
_ -> [\s]:*  {% null %}
