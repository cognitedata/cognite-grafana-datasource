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
