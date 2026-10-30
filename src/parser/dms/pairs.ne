# Filter pairs on a data modelling view's properties, shared by filter.ne (a
# variable's filter) and expression.ne (template variables and map() arguments).
# Included after ../common.ne, which supplies the comparators, strings, numbers,
# whitespace and the value/primitive rules.

@{%
const join = ([d]) => joinArr(d);
const joinArr = (d) => d.join('');
const extractPair = d => {
  return {
	  path: d[0],
	  filter: d[1],
	  value: d[2]
  }
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
%}

string -> sqstring {% id %}
  | dqstring {% id %}
  | variable {% id %}
regexp_string -> sqregexp {% id %}
  | dqregexp {% id %}
  | variable {% id %}
array -> sqr SQR {% emptyArray %}
  | sqr value (comma value):* SQR {% extractArray %}
object -> curl CURL {% emptyObject %}
  | curl pair (comma pair):* CURL {% extractObject %}

# dms_prop allows dotted paths (e.g. unit.externalId) so client-side operators
# can address direct-relation subfields; server-side filters reject dots with a
# helpful error at compile time (see buildDmsFilter).
pair -> dms_prop _ equals _ value {% d => ([d[0], d[2], d[4]]) %}
  | dms_prop _ not_equals _ value {% d => ([d[0], d[2], d[4]]) %}
  | dms_prop _ regexp _ regexp_string {% d => ([d[0], d[2], d[4]]) %}
  | dms_prop _ range_op _ range_value {% d => ([d[0], d[2], d[4]]) %}
  | dms_prop _ prefix_op _ string {% d => ([d[0], d[2], d[4]]) %}
  # Lists only parse so that buildDmsFilter can say ^= and ranges take one value.
  | dms_prop _ prefix_op _ array {% d => ([d[0], d[2], d[4]]) %}

dms_prop -> prop_name ("." prop_name):* {% d => d[0] + d[1].map((part) => part.join('')).join('') %}

variable -> "$" prop_name {% joinArr %}
  | "[[" prop_name "]]" {% joinArr %}
  | "$" advanced_variable {% joinArr %}

advanced_variable -> "{" prop_name ":" prop_name "}" {% joinArr %}

range_op -> ">=" {% id %}
  | "<=" {% id %}
  | ">" {% id %}
  | "<" {% id %}
prefix_op -> "^=" {% id %}
range_value -> number {% id %}
  | array {% id %}
  | string {% id %}

comma -> _ "," _ {% d => d[1] %}
curl ->  _ "{" {% null %}
CURL ->  _ "}" {% null %}
sqr ->  _ "[" {% null %}
SQR ->  _ "]" {% null %}
