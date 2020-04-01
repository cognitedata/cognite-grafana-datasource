import _ from 'lodash';
import { QueryCtrl } from 'grafana/app/plugins/sdk';
import './css/query_editor.css';
import CogniteDatasource from './datasource';
import { Tab, QueryTarget, TimeSeriesResponseItem } from './types';
import { parse } from './parser/ts'

export class CogniteQueryCtrl extends QueryCtrl {
  static templateUrl = 'partials/query.editor.html';

  target: QueryTarget;
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
    target: '',
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

  /** @ngInject **/
  constructor($scope, $injector, private templateSrv) {
    super($scope, $injector);

    _.defaultsDeep(this.target, this.defaults);

    this.currentTabIndex = this.tabs.findIndex(x => x.value === this.target.tab) || 0;
    if (this.target.tab !== Tab.Asset) {
      this.target.assetQuery.timeseries = [];
      this.target.assetQuery.old = undefined;
    }
    this.isAllSelected =
      this.target.assetQuery.timeseries &&
      this.target.assetQuery.timeseries.every(ts => ts.selected);
  }

  getOptions(query: string, type: string) {
    return this.datasource.getOptionsForDropdown(query || '', type).then(options => {
      _.defer(() => this.$scope.$digest()); // need to force the update on the dropdown
      return options;
    });
  }

  onChangeCustom() { // todo: why it doesn't work without this hack?
    try {
      parse(this.target.expr);
      this.target.error = '';
      this.onChangeInternal();
    } catch (e) {
      this.target.error = e.message;
    }
  }

  onChangeInternal() {
    this.refresh(); // Asks the panel to refresh data.
  }

  changeTab(index: number) {
    this.currentTabIndex = index;
    this.target.tab = this.tabs[index].value;
    this.refresh();
  }

  toggleCheckboxes() {
    this.isAllSelected = !this.isAllSelected;
    this.target.assetQuery.timeseries.forEach(ts => (ts.selected = this.isAllSelected));
  }

  selectOption(timeseries: TimeSeriesResponseItem) {
    timeseries.selected = !timeseries.selected;
    this.isAllSelected = this.target.assetQuery.timeseries.every(ts => ts.selected);
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
