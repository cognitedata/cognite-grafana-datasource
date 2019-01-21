///<reference path="./grafana.d.ts" />
import _ from 'lodash';
import { QueryCtrl } from 'app/plugins/sdk';
import './css/query_editor.css!';
import CogniteDatasource from "./datasource";


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
    { value: 'Timeseries', name: 'Select Timeseries', src: 'timeseriestab.html' },
    { value: 'Asset', name: 'Select Timeseries from Asset', src: 'assettab.html' },
    { value: 'Custom', name: 'Custom Query', src: 'customtab.html' },
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
    this.target.tab = this.target.tab || 'Timeseries';
    this.currentTabIndex = this.tabs.findIndex(x => x.name === this.target.tab) || 0;
    this.target.assetQuery = this.target.assetQuery || {};
    this.target.assetQuery.assetSubtree = this.target.assetQuery.assetSubtree || false;
    this.target.assetQuery.query = this.target.assetQuery.query || '';
    this.target.assetQuery.metadata = this.target.assetQuery.metadata || '';
    
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
    return this.target.tab + ": " + this.target.target + " " + this.target.error;
  }

  getAssetTimeseries(target) {
    this.datasource.findAssetTimeseries(target, this.panelCtrl);
  }
  
  // filterOnAssetTimeseries(target) {
  //   this.datasource.filterOnAssetTimeseries(target, this.panelCtrl);
  // }

  // evaluateExpr(target) {
  //   this.datasource.evaluateExpr(target);
  // }
}
