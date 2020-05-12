@builtin "number.ne"

@{%
const formatQuery = ([type, query]) => ({type, query});
const emptyObject = () => ({});
const emptyArray = () => ([]);
%}

# comparators and props
regexp -> "=~" {% id %}
  | "!~" {% id %}
equals -> "=" {% id %}
not_equals -> "!=" {% id %}
prop_name -> [A-Za-z0-9_]:+ {% join %}

# number
number -> decimal {% id %}

# strings
dqstring -> "\"" dstrchar:* "\"" {% d => d[1].join("") %}
sqstring -> "'"  sstrchar:* "'"  {% d => d[1].join("") %}
dqregexp -> "\"" ndstrchar:* "\"" {% d => d[1].join("") %}
sqregexp -> "'"  nsstrchar:* "'"  {% d => d[1].join("") %}

dstrchar -> [^\\"\n] {% id %}
    | backslash strescape {% d => JSON.parse("\""+d.join("")+"\"") %}
	| "\\\"" {% d => "\"" %}

sstrchar -> [^\\'\n] {% id %}
    | backslash strescape {% d => JSON.parse("\""+d.join("")+"\"") %}
    | "\\'" {% d => "'" %}

ndstrchar -> [^\\"\n] {% id %}
	| backslash unicode {% d => JSON.parse("\""+d.join("")+"\"") %}
	| "\\\"" {% d => "\\\"" %}
	| backslash {% id %} 

nsstrchar -> [^\\'\n] {% id %}
	| backslash unicode {% d => JSON.parse("\""+d.join("")+"\"") %}
    | "\\'" {% d => "\\'" %}
	| backslash {% id %}

strescape -> ["\\/bfnrt] {% id %}
    | unicode {% id %}

backslash -> "\\" {% d => "\\" %}

unicode -> "u" [a-fA-F0-9] [a-fA-F0-9] [a-fA-F0-9] [a-fA-F0-9] {% d => d.join("") %}

# space
_ -> [\s]:*  {% null %}

# complex tokens
value -> object {% id %}
  | array {% id %}
  | primitive {% id %}
primitive -> number {% id %}
  | string {% id %}
  | "true" {% () => true %}
  | "false" {% () => false %}
  | "null" {% () => null %}