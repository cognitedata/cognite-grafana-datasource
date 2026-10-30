# A variable's filter on the view's properties: the pairs that used to sit inside
# ts{...}, without the braces. An empty filter selects every instance of the view.
@preprocessor typescript

@include "../common.ne"
@include "./pairs.ne"

@{%
const extractFilterList = (d) => [extractPair(d[1]), ...d[2].map((item) => extractPair(item[1]))];
%}

filters -> _ pair (comma pair):* _ {% extractFilterList %}
  | _ {% () => [] %}
