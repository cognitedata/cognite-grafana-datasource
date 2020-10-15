import defaults from 'lodash/defaults';
import _ from 'lodash';

import React, { ChangeEvent, useCallback, useMemo, useState, useEffect } from 'react';
import { LegacyForms, Tab, TabsBar, TabContent, Select, Label, InlineFormLabel } from '@grafana/ui';
import { QueryEditorProps, SelectableValue } from '@grafana/data';
import CogniteDatasource from '../datasource';
import { defaultQuery, CogniteDataSourceOptions, MyQuery, Tab as Tabs } from '../types';

const { FormField } = LegacyForms;
type Props = QueryEditorProps<CogniteDatasource, MyQuery, CogniteDataSourceOptions>;

export function TimeseriesTab(props: Props) {
  const { query, datasource } = props;
  const [tagQuery, setTagQuery] = React.useState('');

  const onGranularityChange = (granularity: string) => {
    props.onChange({ ...query, granularity });
  };

  const onLabelChange = (label: string) => {
    props.onChange({ ...query, label });
  };

  const onAggregationChange = (aggregation: string) => {
    props.onChange({ ...query, aggregation });
  };

  const onTagChange = (tag: number) => {
    props.onChange({ ...query, target: tag });
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

  const getOptions = (query: string, type: string) => {
    const [result, setResult] = React.useState([]);

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

  export function AssetTab(props: Props) {
    return (
      <div class="gf-form-inline">
        <div class="gf-form">
          <label class="gf-form-label query-keyword fix-query-keyword">Asset Tag</label>
          <gf-form-dropdown model="ctrl.target.assetQuery.target"
            class="gf-dropdown-wrapper"
            placeholder="Start typing asset tag"
            css-class="gf-size-auto"
            allow-custom="false"
            lookup-text="true"
            get-options="ctrl.getOptions($query,'Asset')"
            on-change="ctrl.refreshData()">
          </gf-form-dropdown>
        </div>
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
        </div>
      </div>
    )
  }

  return (
    <div className="gf-form-inline">
      <div className="gf-form">
        <InlineFormLabel width={6}>Tag</InlineFormLabel>
        <Select
          onChange={(ev) => onTagChange(+ev.value)}
          options={getOptions(tagQuery, 'Timeseries')}
          defaultValue={tagQuery}
          placeholder="Start typing tag id here"
          onInputChange={(text) => setTagQuery(text)}
          className="width-20"
        />
      </div>
      <div className="gf-form">
        <InlineFormLabel width={6}>Aggregation</InlineFormLabel>
        <Select
          onChange={(ev) => onAggregationChange(ev.value)}
          options={options}
          defaultValue={query.aggregation}
          className="width-10"
        />
      </div>
      <div
        className="gf-form"
        ng-if="ctrl.target.aggregation && ctrl.target.aggregation !== 'none'"
      >
        <FormField
          label="Granularity"
          labelWidth={6}
          inputWidth={10}
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
          inputWidth={10}
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
        {activeTab === Tabs.Custom && <div>Custom tab content</div>}
      </TabContent>
    </div>
  );
}
