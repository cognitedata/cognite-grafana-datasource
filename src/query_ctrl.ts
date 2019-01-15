///<reference path="./grafana.d.ts" />
import _ from 'lodash';
import { QueryCtrl } from 'app/plugins/sdk';
import './css/query_editor.css!';
import CogniteDatasource from "./datasource";


export class CogniteQueryCtrl extends QueryCtrl {
  static templateUrl = 'partials/query.editor.html';

  target: any;
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

  /** @ngInject **/
  constructor($scope, $injector, private templateSrv) {
    super($scope, $injector);

    _.defaultsDeep(this.target, this.defaults);

    this.target.target = this.target.target || 'Start typing tag id here';
    this.target.type = this.target.type || 'timeserie';
    this.target.aggregation = this.target.aggregation || 'average';
    this.target.granularity = this.target.granularity || '';
  }

  getOptions(query) {
    return this.datasource.metricFindQuery(query || '');
  }

  onChangeInternal() {
    this.panelCtrl.refresh(); // Asks the panel to refresh data.
  }
}
