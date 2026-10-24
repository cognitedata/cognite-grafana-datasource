import React from 'react';
import { GraphqlExample } from '../graphql/GraphqlExamplesModal';

const Code = ({ children }: { children: React.ReactNode }) => (
  <code className="query-keyword">{children}</code>
);

/** How a Filter variable selects its time series: the Filter syntax dialog. */
export const SYNTHETIC_FILTER_EXAMPLES: GraphqlExample[] = [
  {
    title: 'Filter on properties',
    lead: (
      <>
        A <Code>Filter</Code> variable uses every time series in the view that matches its filter.
        Write <Code>property operator value</Code> pairs, separated by commas. A time series must
        match all of them. You can use the view&apos;s properties (the editor suggests them), and{' '}
        <Code>space</Code>, <Code>externalId</Code>, <Code>createdTime</Code>,{' '}
        <Code>lastUpdatedTime</Code> and <Code>version</Code>. Put text in quotes; write numbers and{' '}
        <Code>true</Code> / <Code>false</Code> without quotes.
      </>
    ),
    code: "name^='PT_', type='numeric', isStep=false",
  },
  {
    title: 'Numeric and string time series',
    lead: (
      <>
        Synthetic time series compute numbers, so most filters add{' '}
        <Code>type=&apos;numeric&apos;</Code>. A string time series also works, inside{' '}
        <Code>map()</Code> in the expression and with Raw data points; see Expression syntax.
      </>
    ),
    code: "name^='PT_', type='numeric'",
  },
  {
    title: 'Operators CDF filters on',
    lead: (
      <>
        CDF searches the view with these, so they decide which time series come back. Use them
        first, to narrow the filter. <Code>=</Code> is equal to, and <Code>!=</Code> is not equal
        to; with a list, such as <Code>{"['a', 'b']"}</Code>, they match any of the values or none
        of them. <Code>!=</Code> also keeps time series where the property has no value.{' '}
        <Code>^=</Code> starts with. <Code>{'>= > <= <'}</Code> compare numbers and dates; use two
        of them on the same property for a range. <Code>!=null</Code> means the property has a
        value, <Code>=null</Code> that it has none.
      </>
    ),
    code: "externalId=['pump_101.flow', 'pump_102.flow'], sourceUnit!=null, type!=['string', 'state']",
  },
  {
    title: 'Relations to other instances',
    lead: (
      <>
        A property that points to another instance, such as <Code>assets</Code> or <Code>unit</Code>
        , takes that instance as its value: <Code>{"{space='…', externalId='…'}"}</Code>. For a list
        of instances, such as <Code>assets</Code>, <Code>=</Code> means the list contains it and{' '}
        <Code>!=</Code> that it doesn&apos;t. Several instances in a list match any of them, or with{' '}
        <Code>!=</Code> none of them.
      </>
    ),
    code: "assets!={space='plant', externalId='pump-101'}, type='numeric'",
  },
  {
    title: 'Operators that can be used to further narrow down results',
    lead: (
      <>
        <Code>=~</Code> matches a pattern and <Code>!~</Code> doesn&apos;t match it. CDF can&apos;t
        search with these, so they run locally, in Grafana, on the time series CDF returned. CDF
        returns at most 100, so start the filter with an operator CDF filters on, and use these to
        narrow those results further. When CDF has more than 100 matches, the query stops with an
        error instead of showing an incomplete result.
      </>
    ),
    code: "name^='PT_', name=~'.*_PV'",
  },
  {
    title: 'Patterns',
    lead: (
      <>
        A pattern is a regular expression. It must match the whole value and is case-sensitive:{' '}
        <Code>{"'.*temp'"}</Code> matches <Code>pump.temp</Code>, but <Code>{"'temp'"}</Code>{' '}
        doesn&apos;t.
      </>
    ),
    code: "name^='PT_', name=~'.*_(PV|SP)'",
  },
  {
    title: 'Nested values',
    lead: (
      <>
        A dotted path, such as <Code>unit.externalId</Code>, reads a value inside another property.
        It works with <Code>=~</Code>, <Code>!~</Code> and <Code>!=</Code> (also with a list), and
        like them it runs locally on the time series CDF returned.
      </>
    ),
    code: "name^='PT_', unit.externalId!=['pressure:bar', 'pressure:pa']",
  },
  {
    title: 'Dashboard variables',
    lead: (
      <>
        Write a dashboard variable without quotes: <Code>name=$tag</Code> compares with the selected
        value. When several values are selected, <Code>=</Code> matches any of them and{' '}
        <Code>!=</Code> none of them; inside a list, <Code>{"[$tag, 'other']"}</Code>, the values
        join the list. After <Code>=~</Code> or <Code>!~</Code>, the variable matches any selected
        value exactly. <Code>^=</Code> and <Code>{'>= > <= <'}</Code> take one value; after a range
        operator a number stays a number, and elsewhere it is compared as text.
      </>
    ),
    code: "name=$tag, type='numeric'",
  },
  {
    title: 'Dashboard variables in quotes',
    lead: (
      <>
        Inside quotes, <Code>{"'$tag'"}</Code>, Grafana pastes in the variable&apos;s text as it is,
        which only works for a single value. Use it to build a longer text or pattern, such as{' '}
        <Code>{"name=~'$tag.*'"}</Code>.
      </>
    ),
    code: "name=~'$tag.*', type='numeric'",
  },
  {
    title: 'Dashboard variables of instances',
    lead: (
      <>
        A dashboard variable that returns instance IDs (the <Code>Instance ID</Code> value on the
        GraphQL or Assets variable tab) stands for the selected instances.{' '}
        <Code>assets=$asset</Code> matches the time series related to any of the selected assets,
        and <Code>assets!=$asset</Code> those related to none of them.
      </>
    ),
    code: "assets!=$asset, type='numeric'",
  },
  {
    title: 'How many time series a filter matches',
    lead: (
      <>
        The chip at the end of a filter row shows how many time series the filter matches. Only one
        variable in an expression can match several time series. The expression then gives one
        result for each of them. Every other variable must match one time series, or be combined
        into one with <Code>avg()</Code>, <Code>sum()</Code>, <Code>min()</Code> or{' '}
        <Code>max()</Code>. With A and B both matching several pumps, this gives one result per pump
        in A:
      </>
    ),
    code: 'A - avg(B)',
  },
  {
    title: 'Filters on large views',
    lead: (
      <>
        On a view with many instances, add <Code>space</Code> so CDF has less to search. Filters on
        other properties can be slow or time out if the property has no index, and so can filters on{' '}
        <Code>createdTime</Code> and <Code>lastUpdatedTime</Code>.
      </>
    ),
    code: "space='my_space', name^='PT_', type='numeric'",
  },
];

/** The expression over defined variables: the Expression syntax dialog. */
export const SYNTHETIC_EXPRESSION_EXAMPLES: GraphqlExample[] = [
  {
    title: 'Arithmetic',
    lead: (
      <>
        Use the variables by name, with <Code>+ - * /</Code>, parentheses and numbers. CDF computes
        the result from each variable&apos;s data points, using the aggregate and unit set in its
        row.
      </>
    ),
    code: '(A - 32) * 5 / 9',
  },
  {
    title: 'Functions',
    lead: (
      <>
        <Code>sin cos ln sqrt exp abs</Code> take one value. <Code>pow(A, 2)</Code> raises to a
        power, <Code>round(A, 1)</Code> rounds to one decimal, and <Code>pi()</Code> is π.{' '}
        <Code>max(A, B)</Code> and <Code>min(A, B)</Code> take the larger or smaller value at each
        point in time.
      </>
    ),
    code: 'round(sqrt(pow(A, 2) + pow(B, 2)), 2)',
  },
  {
    title: 'Errors',
    lead: (
      <>
        <Code>on_error(A / B, 0)</Code> gives 0 where the calculation fails, for example where B is
        0.
      </>
    ),
    code: 'on_error(A / B, 0)',
  },
  {
    title: 'String time series',
    lead: (
      <>
        <Code>map()</Code> turns the values of a string time series into numbers. Here OPEN becomes
        1, CLOSED becomes 0, and any other value -1. The values must match exactly, including upper
        and lower case. String time series only work with Raw data points.
      </>
    ),
    code: "map(A, ['OPEN', 'CLOSED'], [1, 0], -1)",
  },
  {
    title: 'A variable with several time series',
    lead: (
      <>
        When A matches several time series, the expression gives one result for each of them. With A
        matching five time series and B fixed to one, this gives five results. Only one variable can
        match several time series.
      </>
    ),
    code: 'A - B',
  },
  {
    title: 'Combine time series into one',
    lead: (
      <>
        <Code>avg(A)</Code>, <Code>min(A)</Code> and <Code>max(A)</Code> combine all of A&apos;s
        time series into one, and CDF computes them. <Code>sum(A)</Code> is not a CDF function: it
        is sent as an addition of A&apos;s time series, <Code>A1 + A2 + …</Code>. Put only the
        variable inside: write <Code>avg(A) * 2</Code>, not <Code>avg(A * 2)</Code>. CDF gives a
        value only at the times where every combined time series has one, so a time series with no
        data points in the time range leaves the result empty. Narrow the filter to the time series
        that have data.
      </>
    ),
    code: 'avg(A) - B',
  },
  {
    title: 'Dashboard variables',
    lead: (
      <>
        <Code>$factor</Code> or <Code>{'${factor}'}</Code> is replaced by the dashboard
        variable&apos;s value before CDF computes the expression.
      </>
    ),
    code: '$factor * A',
  },
  {
    title: 'Labels',
    lead: (
      <>
        In the Label field, <Code>{'{{A.name}}'}</Code> shows a property of variable A&apos;s time
        series, and <Code>{'{{B.unit.externalId}}'}</Code> a nested one.
      </>
    ),
    code: '{{A.name}} ({{A.unit.externalId}})',
  },
];
