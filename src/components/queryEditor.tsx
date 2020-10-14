import defaults from 'lodash/defaults';

import React, { ChangeEvent, useState } from 'react';
import { LegacyForms, Tab, TabsBar, TabContent, Select } from '@grafana/ui';
import { QueryEditorProps, SelectableValue } from '@grafana/data';
import CogniteDatasource from '../datasource';
import { defaultQuery, CogniteDataSourceOptions, MyQuery, Tab as Tabs } from '../types';

const { FormField } = LegacyForms;
type Props = QueryEditorProps<CogniteDatasource, MyQuery, CogniteDataSourceOptions>;

export function TimeseriesTab(props: Props) {
  const { query } = props;

  const onGranularityChange = (granularity: string) => {
    props.onChange({ ...query, granularity });
  };

  const onLabelChange = (label: string) => {
    props.onChange({ ...query, label });
  };

  const onAggregationChange = (aggregation: string) => {
    props.onChange({ ...query, aggregation });
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
    description: agg.name ? `This is a description of ${agg.name}` : undefined,
  }));

  return (
    <div className="gf-form-inline">
      <div className="gf-form">
        <label className="gf-form-label query-keyword fix-query-keyword">Tag</label>

        {/*  <gf-form-dropdown
          model="ctrl.target.target"
          placeholder="Start tagging here"
          class="gf-dropdown-wrapper"
          css-class="gf-size-auto"
          allow-custom="false"
          lookup-text="true"
          get-options="ctrl.getOptions($query,'Timeseries')"
          on-change="ctrl.refreshData()"
        /> */}
      </div>
      <div className="gf-form">
        <Select
          onChange={(ev) => onAggregationChange(ev.value)}
          options={options}
          defaultValue={query.aggregation}
          width={15}
        />
      </div>
      <div
        className="gf-form"
        ng-if="ctrl.target.aggregation && ctrl.target.aggregation !== 'none'"
      >
        <FormField
          label="Granularity"
          labelWidth={6}
          inputWidth={20}
          onChange={(ev) => onGranularityChange(ev.target.value)}
          value={query.granularity}
          placeholder="default"
          tooltip="The granularity of the aggregate values. Valid entries are: 'day' (or 'd'), 'hour' (or 'h'), 'minute' (or 'm'), 'second' (or 's'). Example: 12h."
        />
      </div>
      <div className="gf-form gf-form--grow">
        <FormField
          label="Label"
          labelWidth={6}
          inputWidth={20}
          onChange={(ev) => onLabelChange(ev.target.value)}
          value={query.label}
          placeholder="default"
          tooltip="Set the label for each timeseries. Can also access timeseries properties via {{property}}. Eg: {{description}}-{{metadata.key}}"
        />
      </div>
    </div>
  );
}

export function QueryEditor(props: Props) {
  const { query } = props;
  const queryOrDefault = defaults(query, defaultQuery);
  const { queryText, tab } = queryOrDefault;

  // const [activeTab, setActiveTab] = useState(tab);
  const activeTab = tab;

  /*
  const onQueryTextChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onChange, query } = this.props;
    onChange({ ...query, queryText: event.target.value });
  };

  const onConstantChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onChange, query, onRunQuery } = this.props;
    onChange({ ...query, constant: parseFloat(event.target.value) });
    // executes the query
    onRunQuery();
  };
  */

  const onSelectTab = (tab: Tabs) => {
    // setActiveTab(tab);
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
        {activeTab === Tabs.Asset && <div>Asset tab content</div>}
        {activeTab === Tabs.Timeseries && TimeseriesTab(props)}
        {activeTab === Tabs.Custom && <div>Custom tab content</div>}
      </TabContent>
    </div>
  );
}
