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
dqstring -> "\"" dstrchar:* "\"" {% function(d) {return d[1].join(""); } %}
sqstring -> "'"  sstrchar:* "'"  {% function(d) {return d[1].join(""); } %}

dstrchar -> [\\] {% d => "\\" %}
    | [^\\"\n] {% id %}
    | "\\" strescape {%
    function(d) {
        return JSON.parse("\""+d.join("")+"\"");
    }
%}

sstrchar -> [\\] {% d => "\\" %}
    | [^\\'\n] {% id %}
    | "\\" strescape
        {% function(d) { return JSON.parse("\""+d.join("")+"\""); } %}
    | "\\'"
        {% function(d) {return "'"; } %}

strescape -> ["/bfnrt] {% id %}
    | "u" [a-fA-F0-9] [a-fA-F0-9] [a-fA-F0-9] [a-fA-F0-9] {%
    function(d) {
        return d.join("");
    }
%}

# space
_ -> [\s]:*  {% null %}
