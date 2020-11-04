/* eslint-disable no-template-curly-in-string */
import React from 'react';

const Code = ({ children }) => <code className="query-keyword">{children}</code>;

export const customQueryHelp = (
  <div className="gf-form--grow">
    <pre>
      Format: <Code>{`ts{options}`}</Code>
      <br />
      Options are of the form: <Code>PROPERTY COMPARATOR VALUE</Code>
      <br />
      <br />
      Comparator can be either:
      <br />
      <Code>=</Code> (strict equality),
      <br />
      <Code>!=</Code> (strict inequality),
      <br />
      <Code>=~</Code> (regex equality),
      <br />
      <Code>!~</Code> (regex inequality)
      <br />
      <br />
      If you want to reference a specific time series, use:
      <br />
      <Code>{'ts{id=ID}'}</Code>, or{' '}
      <Code>{`ts{id=ID, aggregate='AGGREGATE', granularity='GRANULARITY'}`}</Code>.<br />
      Example: <Code>{`sum(ts{metadata{type="TEMP"}}) - ts{id=12345678}`}</Code>
      <br />
      <br />
      Templated variables can also be used with <Code>$variable</Code>.<br />
      Example:{' '}
      <Code>{`ts{assetIds=[$asset], metadata={key1=~'.*test.*'}, isStep=1, granularity='12h', aggregate='average'}`}</Code>
      <br />
      <br />
      In case of multi-value variable, return value can be formatted. To format variable value use{' '}
      <Code>{'${variable:[formatter]}'}</Code>.<br />
      Example: <Code>
        {"ts{assetIds=[${asset:csv}], granularity='12h', aggregate='average'}"}
      </Code>{' '}
      <br />
      <br />
      Check{' '}
      <a
        className="query-keyword"
        href="https://grafana.com/docs/grafana/latest/reference/templating/#advanced-formatting-options"
      >
        Grafana documentation
      </a>{' '}
      to get list of available formatters.
      <br />
      <br />
      Synthetic timeseries functions can also be applied on one or multiple timeseries.
      <br />
      Example: <Code>{`(ts{name=~'.*temp.*', aggregate='average'} - 32) * 5/9`}</Code>
      <br />
      <Code>{`ts{} + sin(ts{granularity='24h', aggregate='average'})`}</Code>
      <br />
      <br />
      Variable length functions (sum, max, min, avg) can also be applied to all filtered timeseries.
      Examples:
      <br />
      <Code>{`sum(ts{metadata={type="TEMP"}})`}</Code>
      <br />
      ↪ yields one timeseries that is thesum of all temperature timeseries
      <br />
      <Code>{"max(ts{aggregate='average'}) - min(ts{aggregate='average'})"}</Code>
      <br />
      ↪ yields the range of the timeseries aggregated by averages
      <br />
      <Code>{'pow(ts{} - avg(ts{}), 2)'}</Code>
      <br />
      ↪ yields the squared deviation of each timeseries from the average <br />
      <br />
      There is a support for some advanced functions, like <Code>round</Code>, <Code>on_error</Code>{' '}
      and <Code>map</Code>.<br />
      The documentation on how to use them can be found on{' '}
      <a
        className="query-keyword"
        href="https://docs.cognite.com/dev/concepts/resource_types/timeseries.html#synthetic-time-series"
      >
        docs.cognite.com/api
      </a>
      .<br />
      <br />
      To learn more about the querying capabilities of Cognite Data Source for Grafana, please visit
      our{' '}
      <a
        className="query-keyword"
        href="https://docs.cognite.com/cdf/dashboards/guides/grafana/getting_started.html"
      >
        documentation
      </a>
      .
    </pre>
  </div>
);
