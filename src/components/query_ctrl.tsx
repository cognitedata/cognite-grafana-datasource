import _ from 'lodash';
import React, { PureComponent } from 'react';
// import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';

// Types
import { FormLabel, Select, Switch, QueryEditorProps, DataSourceStatus, DataSourceSettings, DataSourceJsonData } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';

import CogniteDatasource from '../datasource';

import { QueryTarget, CogniteOptions, Tab } from '../types';
import { CogniteQuerySection } from './query_sections';

export type Props = QueryEditorProps<CogniteDatasource, QueryTarget, CogniteOptions>;

// const FORMAT_OPTIONS: Array<SelectableValue<string>> = [
//   { label: 'Time series', value: 'time_series' },
//   { label: 'Table', value: 'table' },
//   { label: 'Heatmap', value: 'heatmap' },
// ];

// const INTERVAL_FACTOR_OPTIONS: Array<SelectableValue<number>> = _.map([1, 2, 3, 4, 5, 10], (value: number) => ({
//   value,
//   label: '1/' + value,
// }));

interface State {
  selectedTab: SelectableValue<Tab>;
  // legendFormat: string;
  // formatOption: SelectableValue<string>;
  // interval: string;
  // intervalFactorOption: SelectableValue<number>;
  // instant: boolean;
}

export class CogniteQueryEditor extends PureComponent<Props, State> {
  // Query target to be modified and used for queries
  query: QueryTarget;
  aggregates: SelectableValue<string>[] = [
    { value: 'none', label: 'None', name: 'None' },
    { value: 'average', label: 'Average', name: 'Average' },
    { value: 'max', label: 'Max', name: 'Max' },
    { value: 'min', label: 'Min', name: 'Min' },
    { value: 'count', label: 'Count', name: 'Count' },
    { value: 'sum', label: 'Sum', name: 'Sum' },
    { value: 'interpolation', label: 'Interpolation', name: 'Interpolation' },
    { value: 'stepInterpolation', label: 'Step Interpolation', name: 'Step Interpolation' },
    { value: 'continuousVariance', label: 'Continuous Variance', name: 'Continuous Variance' },
    { value: 'discreteVariance', label: 'Discrete Variance', name: 'Discrete Variance' },
    { value: 'totalVariation', label: 'Total Variation', name: 'Total Variation' },
  ];
  tabs: SelectableValue<Tab>[] = [
    {
      value: Tab.Timeseries,
      label: 'Select Timeseries',
      // src: 'timeseriestab.html',
    },
    {
      value: Tab.Asset,
      label: 'Select Timeseries from Asset',
      // src: 'assettab.html',
    },
    {
      value: Tab.Custom,
      label: 'Custom Query',
      // src: 'customtab.html',
    },
  ];
  currentTabIndex: number;
  defaults = {
    target: 'Start typing tag id here',
    type: 'timeserie',
    aggregation: 'average',
    granularity: '',
    label: '',
    tab: Tab.Timeseries,
    expr: '',
    assetQuery: {
      target: '',
      old: undefined,
      timeseries: [],
      includeSubtrees: false,
      func: '',
      templatedTarget: '',
    },
  };
  isAllSelected: boolean;

  constructor(props: Props) {
    super(props);
    const { query } = props;
    this.query = _.defaultsDeep(query, this.defaults);
    this.currentTabIndex = this.tabs.findIndex(x => x.value === this.query.tab) || 0;
    if (this.query.tab !== Tab.Asset) {
      this.query.assetQuery.timeseries = [];
      this.query.assetQuery.old = undefined;
    }
    this.isAllSelected = this.query.assetQuery.timeseries && this.query.assetQuery.timeseries.every(ts => ts.selected);
    // Query target properties that are fully controlled inputs
    this.state = {
      selectedTab: this.tabs[this.currentTabIndex],
      // // Fully controlled text inputs
      // interval: query.interval,
      // legendFormat: query.legendFormat,
      // // Select options
      // formatOption: FORMAT_OPTIONS.find(option => option.value === query.format) || FORMAT_OPTIONS[0],
      // intervalFactorOption:
      //   INTERVAL_FACTOR_OPTIONS.find(option => option.value === query.intervalFactor) || INTERVAL_FACTOR_OPTIONS[0],
      // // Switch options
      // instant: Boolean(query.instant),
    };
    this.changeTab = this.changeTab.bind(this);
  }

  changeTab(option: SelectableValue<Tab>) {
    this.currentTabIndex = this.tabs.findIndex(x => x.value === option.value) || 0;
    this.query.tab = option.value;
    this.setState({selectedTab:{...option}}, this.onRunQuery);
    // this.refresh();
  }

  onFieldChange = (query: QueryTarget, override?: any) => {
    this.query.expr = query.expr;
  };

  update = (queryTarget) => {
    // console.log('update', this.query, queryTarget);
    // this.query = queryTarget;
    const { onChange, onRunQuery } = this.props;
    if (onChange) {
      onChange(queryTarget);
      if (onRunQuery) {
        onRunQuery();
      }
    }
    // // console.log('>update', this.query, queryTarget);
    // this.onRunQuery();
  }

  onRunQuery = () => {
    const { query } = this;
    this.props.onChange(query);
    this.props.onRunQuery();
  };

  // getOptions = (query: string, type: string) => {
  //   return this.datasource.getOptionsForDropdown(query || '', type);
  //   // .then(options => {
  //   //   _.defer(() => this.$scope.$digest()); // need to force the update on the dropdown
  //   //   return options;
  //   // });
  // }

  // onFormatChange = (option: SelectableValue<string>) => {
  //   this.query.format = option.value;
  //   this.setState({ formatOption: option }, this.onRunQuery);
  // };

  // onInstantChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  //   const instant = e.target.checked;
  //   this.query.instant = instant;
  //   this.setState({ instant }, this.onRunQuery);
  // };

  // onIntervalChange = (e: React.SyntheticEvent<HTMLInputElement>) => {
  //   const interval = e.currentTarget.value;
  //   this.query.interval = interval;
  //   this.setState({ interval });
  // };

  // onIntervalFactorChange = (option: SelectableValue<number>) => {
  //   this.query.intervalFactor = option.value;
  //   this.setState({ intervalFactorOption: option }, this.onRunQuery);
  // };

  // onLegendChange = (e: React.SyntheticEvent<HTMLInputElement>) => {
  //   const legendFormat = e.currentTarget.value;
  //   this.query.legendFormat = legendFormat;
  //   this.setState({ legendFormat });
  // };

  // onRunQuery = () => {
  //   const { query } = this;
  //   this.props.onChange(query);
  //   this.props.onRunQuery();
  // };

  render() {
    const { datasource, query, panelData, queryResponse } = this.props;
    const { selectedTab /*formatOption, instant, interval, intervalFactorOption, legendFormat*/ } = this.state;

    return (
      <div>
      <div className="gf-form-inline gf-form-inline--nowrap">
        <div className="gf-form flex-shrink-0">
          <Select isSearchable={false} options={this.tabs} onChange={this.changeTab} value={selectedTab}></Select>
        </div>
        <div className="gf-form-label">Other global options go here (instant, table vs ts, include points outside, etc)</div>
      </div>
      <div>
        <CogniteQuerySection aggregates={this.aggregates} queryTarget={this.query} datasource={datasource} update={this.update}></CogniteQuerySection>
      </div>
      </div>
    );
  }
}
