///<reference path="./grafana.d.ts" />
import _ from 'lodash';
import { QueryCtrl } from 'app/plugins/sdk';
import './css/query_editor.css!';
import CogniteDatasource, { Tab } from './datasource';

export class CogniteQueryCtrl extends QueryCtrl {
  static templateUrl = 'partials/query.editor.html';

  target: any;
  assetVals: any;
  datasource: CogniteDatasource;
  panelCtrl: any;
  aggregation = [
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
  tabs = [
    {
      value: Tab.Timeseries,
      name: 'Select Timeseries',
      src: 'timeseriestab.html',
    },
    {
      value: Tab.Asset,
      name: 'Select Timeseries from Asset',
      src: 'assettab.html',
    },
    { value: Tab.Custom, name: 'Custom Query', src: 'customtab.html' },
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
      old: {},
      timeseries: [],
      includeSubtrees: false,
      func: '',
    },
  };

  /** @ngInject **/
  constructor($scope, $injector, private templateSrv) {
    super($scope, $injector);

    _.defaultsDeep(this.target, this.defaults);

    this.currentTabIndex = this.tabs.findIndex(x => x.value === this.target.tab) || 0;
  }

  getOptions(query: string, type: string) {
    return this.datasource.getOptionsForDropdown(query || '', type);
  }

  onChangeInternal() {
    this.refresh(); // Asks the panel to refresh data.
  }

  changeTab(index: number) {
    this.currentTabIndex = index;
    this.target.tab = this.tabs[index].value;
  }

  getCollapsedText() {
    if (this.target.tab === Tab.Timeseries) {
      return `Timeseries: ${this.target.target} ${this.target.error}`;
    }
    if (this.target.tab === Tab.Asset) {
      return `Timeseries from Asset: ${this.target.assetQuery.target} ${this.target.error}`;
    }
    if (this.target.tab === Tab.Custom) {
      return `Custom Query: ${this.target.expr} ${this.target.error}`;
    }
    return '';
  }
}
