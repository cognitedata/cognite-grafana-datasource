/* eslint-disable no-template-curly-in-string */
import { InfoBox } from '@grafana/ui';
import React from 'react';
import { DOCS_URL } from '../constants';

type HelpParams = { onDismiss: () => void; title: string; children: React.ReactNode };

const Code = ({ children }) => <code className="query-keyword">{children}</code>;

const HelpPanel = ({ onDismiss, title, children }: HelpParams) => (
  <InfoBox
    style={{ marginTop: '10px' }}
    title={title}
    severity="info"
    url={DOCS_URL}
    onDismiss={onDismiss}
  >
    <div className="gf-form--grow help-panel">{children}</div>
  </InfoBox>
);

export const CustomQueryHelp = ({ onDismiss }: Pick<HelpParams, 'onDismiss'>) => (
  <HelpPanel title="Custom query syntax help" onDismiss={onDismiss}>
    Format: <Code>{`ts{options}`}</Code>
    <br />
    Options are of the form: <Code>PROPERTY COMPARATOR VALUE</Code>
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
    <Code>{`ts{externalId='EXTERNAL_ID', aggregate='AGGREGATE', granularity='GRANULARITY', alignment=ALIGNMENT}`}</Code>
    .<br />
    Example: <Code>{`sum(ts{metadata{type="TEMP"}}) - ts{id=12345678}`}</Code>
    <br />
    <br />
    Templating is available by using the <Code>$variable_name</Code> syntax.
    <br />
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
    Synthetic time series functions can also be applied on one or multiple time series.
    <br />
    Example: <Code>{`(ts{name=~'.*temp.*', aggregate='average'} - 32) * 5/9`}</Code>
    <br />
    <Code>{`ts{} + sin(ts{granularity='24h', aggregate='average'})`}</Code>
    <br />
    <br />
    Variable length functions (sum, max, min, avg) can also be applied to all filtered time series.
    Examples:
    <br />
    <Code>{`sum(ts{metadata={type="TEMP"}})`}</Code>
    <br />
    ↪ yields one time series that is the sum of all temperature time series
    <br />
    <Code>{"max(ts{aggregate='average'}) - min(ts{aggregate='average'})"}</Code>
    <br />
    ↪ yields the range of the time series aggregated by averages
    <br />
    <Code>{'pow(ts{} - avg(ts{}), 2)'}</Code>
    <br />
    ↪ yields the squared deviation of each time series from the average <br />
    <br />
    There is a support for some advanced functions, like <Code>round</Code>, <Code>on_error</Code>{' '}
    and <Code>map</Code>.<br />
    The documentation on how to use them can be found on{' '}
    <a
      className="query-keyword"
      href="https://docs.cognite.com/dev/concepts/resource_types/timeseries.html#synthetic-time-series"
    >
      docs.cognite.com/dev
    </a>
    .
  </HelpPanel>
);

export const EventQueryHelp = ({ onDismiss }: Pick<HelpParams, 'onDismiss'>) => (
  <HelpPanel title="Event query syntax help" onDismiss={onDismiss}>
    Event queries use the{' '}
    <a
      className="query-keyword"
      href="https://docs.cognite.com/api/v1/#operation/advancedListEvents"
      target="_blank"
      rel="noreferrer"
    >
      events/list
    </a>{' '}
    endpoint to retrieve data.
    <br />
    Format: <Code>{'events{someFilter=number, otherFilter="string"}'}</Code>
    <br />
    Example:{' '}
    <Code>{`events{externalIdPrefix='WORKORDER', assetSubtreeIds=[{id=12}, {externalId='ext_id'}]}`}</Code>
    <br />
    You can filter on these properties:
    <br />
    <Code>externalIdPrefix</Code>, <Code>metadata</Code>, <Code>assetIds</Code>,{' '}
    <Code>assetExternalIds</Code>, <Code>rootAssetIds</Code>, <Code>assetSubtreeIds</Code>,{' '}
    <Code>dataSetIds</Code>, <Code>source</Code>, <Code>type</Code>, <Code>subtype</Code>.
    <br />
    By default, the query returns events that are active in the time range. You can customize this
    with the additional time filters <Code>startTime</Code>, <Code>endTime</Code>,{' '}
    <Code>activeAtTime</Code>, <Code>createdTime</Code>, <Code>lastUpdatedTime</Code>.
    <br />
    This example shows how to get all finished events that started in the current time range:
    <br />
    <Code>{`events{startTime={min=$__from}, endTime={isNull=false}}`}</Code>
    <br />
    You can specify additional client-side filtering with the <Code>=~</Code>, <Code>!~</Code> and{' '}
    <Code>!=</Code> operators. Comma between multiple filters acts as logic <Code>AND</Code>.
    <br />
    Format:
    <br />
    <Code>=~</Code> – regex equality, returns results satisfying the regular expression.
    <br />
    <Code>!~</Code> – regex inequality, excludes results satisfying the regular expression.
    <br />
    <Code>!=</Code> – strict inequality, returns items where a property doesn&apos;t equal a given
    value.
    <br />
    <br />
    Example: <Code>{`events{type='WORKORDER', subtype=~'SUB.*'}`}</Code>
    <br />
    <span className="gf-formatted-warning">
      Note: Do not use client-side filters as the primary filtering method.
      <br />
      The filters are applied after items have been returned from CDF, and there is a risk that you
      will not see all data if CDF returned the maximum number of items (1000).
    </span>
    <br />
    Templating is available by using the <Code>$variable_name</Code> syntax.
    <br />
    Example: <Code>{`{events{type='WORKORDER', subtype=$variable}`}</Code>
  </HelpPanel>
);

export const EventAdvancedFilterHelp = ({ onDismiss }: Pick<HelpParams, 'onDismiss'>) => (
  <HelpPanel title="Event advanced filter query syntax help" onDismiss={onDismiss}>
    <a href="https://pr-ark-codegen-1444.specs.preview.cogniteapp.com/v1.json.html#operation/advancedListEvents">
      Click here for Advanced filter documentation
    </a>
  </HelpPanel>
);
