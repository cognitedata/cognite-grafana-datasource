@preprocessor typescript

@builtin "number.ne"
@builtin "string.ne"

@{%
const join = ([d]) => d.join('');
const formatQuery = ([type, query]) => ({type, query});
const extractPair = d => {
	return d.length > 2 ? {[d[0]]:{ filter: d[1], value: d[2]}} : {[d[0]]: d[1]}
}
const extractConditionPair = ([key, filter, value]) => {
	return key ? {key, filter, value} : {}
}

const extract = (extraxtor, d) => {
	let output = {...extraxtor(d[1])};

  for (let i in d[2]) {
      output = {...output, ...extraxtor(d[2][i][2])};
  }

	return output;
}
const extractConditionToArray = d => {
  if(!d.length) return [];
  const output = [extractPair(d[1])];

  for (let i in d[2]) {
  	output.push(extractPair(d[2][i][2]))
  }

  return output

}
// const extractObject = extract.bind(null, extractPair);
const extractObject = (d) => {
  let output = {...extractPair(d[1])};

  for (let i in d[2]) {
      output = {...output, ...extractPair(d[2][i][2])};
  }

  return output;
}
const extractCodition = extract.bind(null, extractConditionPair);
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

query -> rule {% id %}
rule -> type condition {% formatQuery %}
type -> "assets" {% id %}
  | "timeseries" {% id %}

condition -> "{" "}" {% emptyArray %}
  | "{" pair ("," _ pair):* "}" {% extractConditionToArray %}

filter -> "!=" {% id %}
  | "=~" {% id %}
  | "!~" {% id %}
equals -> "=" {% id %}
prop_name -> [A-z0-9\._]:+ {% join %}

string -> sqstring {% id %}
number -> unsigned_int {% id %}
array -> "[" "]" {% emptyArray %}
  | "[" value ("," _ value):* "]" {% extractArray %}
object -> "{" "}" {% emptyObject %}
	| "{" pair ("," _ pair):* "}" {% extractObject %}
pair -> prop_name equals value {% function(d) { return [d[0], d[2]]; } %}
 | prop_name filter string
value ->
    object {% id %}
  | array {% id %}
  | number {% id %}
  | string {% id %}
  | "true" {% function(d) { return true; } %}
  | "false" {% function(d) { return false; } %}
  | "null" {% function(d) { return null; } %}
_ -> null | " " {% null %}
