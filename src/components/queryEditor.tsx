import defaults from 'lodash/defaults';
import _ from 'lodash';

import React, { ChangeEvent, useCallback, useMemo, useState, useEffect, FormEvent } from 'react';
import {
  LegacyForms,
  Tab,
  TabsBar,
  TabContent,
  Select,
  InlineFormLabel,
  Popover,
  PopoverContent,
  Checkbox,
} from '@grafana/ui';
import { QueryEditorProps, SelectableValue } from '@grafana/data';
import CogniteDatasource from '../datasource';
import { defaultQuery, CogniteDataSourceOptions, MyQuery, Tab as Tabs } from '../types';

const { FormField } = LegacyForms;
type Props = QueryEditorProps<CogniteDatasource, MyQuery, CogniteDataSourceOptions>;

const getOptions = (props: Props, query: string, type: string) => {
  const [result, setResult] = React.useState([]);
  const { datasource } = props;
  useEffect(() => {
    datasource
      .getOptionsForDropdown(query || '', type)
      .then((options) => {
        return options;
      })
      .then((res) =>
        res.map<SelectableValue<string>>((x) => ({
          label: x.text,
          description: x.text,
          value: x.value.toString(),
        }))
      )
      .then((res) => setResult(res));
  }, [query]);

  return result;
};

const aggregation = [
  { value: 'none', name: 'None' },
  { value: 'average', name: 'Average' },
  { value: 'max', name: 'Max' },
  { value: 'min', name: 'Min' },
  { value: 'count', name: 'Count' },
  { value: 'sum', name: 'Sum' },
  { value: 'interpolation', name: 'Interpolation' },
  { value: 'stepInterpolation', name: 'Step Interpolation' },
  { value: 'continuousVariance', name: 'Continuous Variance' },
  { value: 'discreteVariance', name: 'Discrete Variance' },
  { value: 'totalVariation', name: 'Total Variation' },
];

const options = aggregation.map<SelectableValue<string>>((agg) => ({
  value: agg.value,
  label: agg.name,
  description: undefined,
}));

const onAggregationChange = (props: Props, aggregation: string) => {
  const { query } = props;
  props.onChange({ ...query, aggregation });
};

const onGranularityChange = (props: Props, granularity: string) => {
  const { query } = props;
  props.onChange({ ...query, granularity });
};

const onLabelChange = (props: Props, label: string) => {
  const { query } = props;
  props.onChange({ ...query, label });
};

const onTagChange = (props: Props, tag: number) => {
  const { query } = props;
  props.onChange({ ...query, target: tag });
};

const GranularityEditor = (props: Props) => {
  const { query } = props;
  if (query.aggregation && query.aggregation !== 'none') {
    return (
      <div
        className="gf-form"
        /* ng-if="ctrl.target.aggregation && ctrl.target.aggregation !== 'none'" */
      >
        <FormField
          label="Granularity"
          labelWidth={6}
          inputWidth={10}
          onChange={(ev) => onGranularityChange(props, ev.target.value)}
          value={query.granularity}
          placeholder="default"
          tooltip="The granularity of the aggregate values. Valid entries are: 'day' (or 'd'), 'hour' (or 'h'), 'minute' (or 'm'), 'second' (or 's'). Example: 12h."
        />
      </div>
    );
  }
  return <div />;
};

export function AssetTab(props: Props) {
  const { query, datasource } = props;
  const [tagQuery, setTagQuery] = React.useState('');

  const IncludeSubAssetsCheckbox = () => {
    const { includeSubtrees } = query.assetQuery;

    const onIncludeSubassetsChange = (event: FormEvent<HTMLInputElement>) => {
      const { checked } = event.currentTarget;
      props.onChange({ ...query, assetQuery: { ...query.assetQuery, includeSubtrees: checked } });
    };
    // FIXME: Styling of checkbox component
    return (
      <div className="gf-form">
        <Checkbox
          label="Include Subassets"
          value={includeSubtrees}
          onChange={onIncludeSubassetsChange}
        />
      </div>
    );
  };

  return (
    <div className="gf-form-inline">
      <div className="gf-form">
        <InlineFormLabel width={6}>Asset Tag</InlineFormLabel>
        <Select
          onChange={(ev) => onTagChange(props, +ev.value)}
          options={getOptions(props, tagQuery, 'Asset')}
          defaultValue={tagQuery}
          placeholder="Start typing asset tag"
          onInputChange={(text) => setTagQuery(text)}
          className="width-20"
        />
      </div>
      {/* TODO: Include Subassets box */}
      <IncludeSubAssetsCheckbox />
      {/* TODO: Aggregation */}
      <div className="gf-form">
        <InlineFormLabel width={6}>Aggregation</InlineFormLabel>
        <Select
          onChange={(ev) => onAggregationChange(props, ev.value)}
          options={options}
          defaultValue={query.aggregation}
          className="width-10"
        />
      </div>
      {GranularityEditor(props)}
      {/* TODO: Label} */}
      <div className="gf-form gf-form--grow">
        <FormField
          label="Label"
          labelWidth={6}
          inputWidth={10}
          onChange={(ev) => onLabelChange(props, ev.target.value)}
          value={query.label}
          placeholder="default"
          tooltip="Set the label for each timeseries. Can also access timeseries properties via {{property}}. Eg: {{description}}-{{metadata.key}}"
        />
      </div>

      {/*
      <div class="gf-form">
        <gf-form-switch class="gf-form"
          label="Include Subassets" label-class="width-9 query-keyword fix-query-keyword"
          checked="ctrl.target.assetQuery.includeSubtrees" on-change="ctrl.refreshData()">
        </gf-form-switch>
      </div>
      <div class="gf-form">
        <label class="gf-form-label query-keyword fix-query-keyword">Aggregation</label>
        <select class="gf-form-input" ng-model="ctrl.target.aggregation" ng-change="ctrl.refreshData()">
        <option ng-repeat="fn in ctrl.aggregation" value="{{fn.value}}">{{fn.name}}</option>
        </select>
      </div>
      <div class="gf-form" ng-if="ctrl.target.aggregation && ctrl.target.aggregation !== 'none'">
        <label class="gf-form-label query-keyword fix-query-keyword">Granularity</label>
        <input type="text" class="gf-form-input width-8" ng-model="ctrl.target.granularity" ng-blur="ctrl.refreshData()" placeholder="default"/>
        <info-popover mode="right-absolute">
          The granularity of the aggregate values. Valid entries are: 'day' (or 'd'), 'hour' (or 'h'), 'minute' (or 'm'), 'second' (or 's'). Example: 12h.
        </info-popover>
      </div>
      <div class="gf-form gf-form--grow">
          <label class="gf-form-label query-keyword fix-query-keyword">Label</label>
          <input type="text" class="gf-form-input" ng-model="ctrl.target.label" ng-blur="ctrl.refreshData()" placeholder=""/>
          <info-popover mode="right-absolute">
            <span ng-non-bindable>
              Set the label for the timeseries. Can also access timeseries properties via {{property}}. Eg: {{description}}-{{metadata.key}}
            </span>
          </info-popover>
      </div> */}
    </div>
  );
}

export function TimeseriesTab(props: Props) {
  const { query, datasource } = props;
  const [tagQuery, setTagQuery] = React.useState('');

  return (
    <div className="gf-form-inline">
      <div className="gf-form">
        <InlineFormLabel width={6}>Tag</InlineFormLabel>
        <Select
          onChange={(ev) => onTagChange(props, +ev.value)}
          options={getOptions(props, tagQuery, 'Timeseries')}
          defaultValue={tagQuery}
          placeholder="Start typing tag id here"
          onInputChange={(text) => setTagQuery(text)}
          className="width-20"
        />
      </div>
      <div className="gf-form">
        <InlineFormLabel width={6}>Aggregation</InlineFormLabel>
        <Select
          onChange={(ev) => onAggregationChange(props, ev.value)}
          options={options}
          defaultValue={query.aggregation}
          className="width-10"
        />
      </div>
      {GranularityEditor(props)}
      <div className="gf-form gf-form--grow">
        <FormField
          label="Label"
          labelWidth={6}
          inputWidth={10}
          onChange={(ev) => onLabelChange(props, ev.target.value)}
          value={query.label}
          placeholder="default"
          tooltip="Set the label for each timeseries. Can also access timeseries properties via {{property}}. Eg: {{description}}-{{metadata.key}}"
        />
      </div>
    </div>
  );
}

export function CustomTab(props: Props) {
  const { query, datasource } = props;
  const help = (
    <div>
      Format: <code className="query-keyword">ts{'{options}'}</code><br />
      Options are of the form: <code className="query-keyword">PROPERTY COMPARATOR VALUE</code>
      <br />
      Comparator can be either
      <code className="query-keyword">=</code> (strict equality),
      <code className="query-keyword">!=</code> (strict inequality),
      <code className="query-keyword">=~</code> (regex equality),
      <code className="query-keyword">!~</code> (regex inequality)
      <br />
      If you want to reference a specific timeseries, use{' '}
      <code className="query-keyword">ts{'{id=ID}'}</code>, or{' '}
      <code className="query-keyword">
        ts{'{id=ID, aggregate=AGGREGATE, granularity=GRANULARITY}'}
      </code>
      Example:{' '}
      <code className="query-keyword">
        sum(ts{'{metadata{type="TEMP"}}'}) - ts{'{id=12345678}'}
      </code>
      Templated variables can also be used with <code className="query-keyword">$variable</code>.
      Example:{' '}
      <code className="query-keyword">
        ts
        {
          "{assetIds=[$asset], metadata={key1=~'.*test.*'}, isStep=1, granularity='12h', aggregate='average}"
        }
      </code>
      In case of multi-value variable, return value can be formatted. To format variable value use
      {"{' '}"}
      <code className="query-keyword">${'{variable:[formatter]}'}</code>. Example:{' '}
      <code className="query-keyword">
        ts
        {"{assetIds=[${asset:csv}], granularity='12h', aggregate='average'}"}
      </code>{' '}
      <br />
      Check{' '}
      <a
        className="query-keyword"
        href="https://grafana.com/docs/grafana/latest/reference/templating/#advanced-formatting-options"
        target="_blank"
        rel="noreferrer"
      >
        Grafana documentation
      </a>{' '}
      to get list of available formatters. Synthetic timeseries functions can also be applied on one
      or multiple timeseries. Example:{' '}
      <code className="query-keyword">
        (ts{"{name=~'.*temp.*', aggregate='average'}"} - 32) * 5/9
      </code>
      <code className="query-keyword">
        ts{'{}'} + sin(ts{"{granularity='24h', aggregate='average'}"})
      </code>
      <br />
      Variable length functions (sum, max, min, avg) can also be applied to all filtered timeseries.
      Examples: <code className="query-keyword">sum(ts{'{metadata={type="TEMP"}}'})</code>↪ yields
      one timeseries that is the sum of all temperature timeseries
      <code className="query-keyword">
        max(ts{"{aggregate='average'}) - min(ts{aggregate='average'}"})
      </code>
      ↪ yields the range of the timeseries aggregated by averages
      <code className="query-keyword">
        pow(ts{'{}'} - avg(ts{'{}'}), 2)
      </code>
      ↪ yields the squared deviation of each timeseries from the average <br />
      There is a support for some advanced functions, like{' '}
      <code className="query-keyword">round</code>, <code className="query-keyword">on_error</code>{' '}
      and <code className="query-keyword">map</code>. The documentation on how to use them can be
      found on{' '}
      <a
        className="query-keyword"
        href="https://docs.cognite.com/dev/concepts/resource_types/timeseries.html#synthetic-time-series"
      >
        docs.cognite.com/api
      </a>
      To learn more about the querying capabilities of Cognite Data Source for Grafana, please visit
      our{' '}
      <a
        className="query-keyword"
        href="https://docs.cognite.com/cdf/dashboards/guides/grafana/getting_started.html"
      >
        documentation
      </a>
      .
    </div>
  );

  return (
    <>
      <div className="gf-form-inline">
        <FormField
          label="Label"
          labelWidth={6}
          inputWidth={10}
          onChange={(ev) => onLabelChange(props, ev.target.value)}
          value={query.label}
          placeholder="default"
          tooltip="Set the label for each timeseries. Can also access timeseries properties via {{property}}. Eg: {{description}}-{{metadata.key}}"
        />

        <div className="gf-form">
          <InlineFormLabel
            width={6}
            tooltip="The granularity of the aggregate values. Valid entries are: 'day' (or 'd'), 'hour' (or 'h'), 'minute' (or 'm'), 'second' (or 's'). Example: 12h."
          >
            Aggregation
          </InlineFormLabel>
          <Select
            onChange={(ev) => onAggregationChange(props, ev.value)}
            options={options}
            defaultValue={query.aggregation}
            className="width-10"
          />
          {GranularityEditor(props)}
        </div>
      </div>

      <div className="gf-form gf-form--grow">
       <FormField
          label="Query"
          labelWidth={6}
          inputWidth={20}
          onChange={(ev) => onQueryChange(props, ev.target.value)}
          value={query.expr}
          placeholder="default"
          tooltip={help}
        />
      </div>
    </>
  );
}

export function QueryEditor(props: Props) {
  const { query } = props;
  const queryOrDefault = defaults(query, defaultQuery);
  const { queryText, tab } = queryOrDefault;
  const activeTab = tab;

  const onSelectTab = (tab: Tabs) => {
    props.onChange({ ...query, tab });
  };

  return (
    <div>
      <TabsBar>
        {Object.values(Tabs).map((t) => (
          <Tab
            css=""
            label={t}
            key="first"
            active={activeTab === t}
            onChangeTab={() => onSelectTab(t)}
          />
        ))}
      </TabsBar>
      <TabContent>
        {activeTab === Tabs.Asset && AssetTab(props)}
        {activeTab === Tabs.Timeseries && TimeseriesTab(props)}
        {activeTab === Tabs.Custom && CustomTab(props)}
      </TabContent>
    </div>
  );
}