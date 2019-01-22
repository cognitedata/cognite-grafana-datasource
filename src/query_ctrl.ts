///<reference path="./grafana.d.ts" />
import _ from 'lodash';
import { QueryCtrl } from 'app/plugins/sdk';
import './css/query_editor.css!';
import CogniteDatasource from "./datasource";
import { Tab } from "./datasource";


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
  ];
  defaults = {
  };
  tabs = [
    { value: Tab.Timeseries, name: 'Select Timeseries', src: 'timeseriestab.html' },
    { value: Tab.Asset, name: 'Select Timeseries from Asset', src: 'assettab.html' },
    { value: Tab.Custom, name: 'Custom Query', src: 'customtab.html' },
  ]
  currentTabIndex: number;

  /** @ngInject **/
  constructor($scope, $injector, private templateSrv) {
    super($scope, $injector);

    _.defaultsDeep(this.target, this.defaults);

    this.target.target = this.target.target || 'Start typing tag id here';
    this.target.type = this.target.type || 'timeserie';
    this.target.aggregation = this.target.aggregation || 'average';
    this.target.granularity = this.target.granularity || '';
    this.target.label = this.target.label || '';
    this.target.tab = this.target.tab || Tab.Timeseries;
    this.currentTabIndex = this.tabs.findIndex(x => x.value === this.target.tab) || 0;
    this.target.expr = this.target.expr || '';
    this.target.assetQuery = this.target.assetQuery || {
      target: '',
      timeseries: [],
      includeSubtrees: false,
    };
  }

  getOptions(query:string, type:string) {
    return this.datasource.metricFindQuery(query || '', type);
  }

  onChangeInternal() {
    this.refresh(); // Asks the panel to refresh data.
  }

  changeTab(index:number) {
    this.currentTabIndex = index;
    this.target.tab = this.tabs[index].value;
  }

  getCollapsedText() {
    if (this.target.tab === Tab.Timeseries) {
      return "Timeseries: " + this.target.target + " " + this.target.error;
    } else if (this.target.tab === Tab.Asset) {
      return "Timeseries from Asset: " + this.target.assetQuery.target + " " + this.target.error;
    } else if (this.target.tab === Tab.Custom) {
      return "Custom Query: " + this.target.expr + " " + this.target.error;
    }
    return "";
  }

  getAssetTimeseries() {
    this.datasource.findAssetTimeseries(this.target, this.panelCtrl);
  }

}

export class CogniteAnnotationsQueryCtrl {
  public static templateUrl = 'partials/annotations.editor.html';
}
