///<reference path="./grafana.d.ts" />
import { QueryCtrl } from 'app/plugins/sdk';
import _ from 'lodash';
import './css/query_editor.css!';
import CogniteDatasource from './datasource';

export class CogniteQueryCtrl extends QueryCtrl {
  public static templateUrl = 'partials/query.editor.html';

  public target: any;
  public datasource: CogniteDatasource;
  public panelCtrl: any;
  public aggregation = [
    { value: null, name: 'None' },
    { value: 'average', name: 'Average' },
    { value: 'max', name: 'Max' },
    { value: 'min', name: 'Min' },
    { value: 'count', name: 'Count' },
    { value: 'sum', name: 'Sum' },
  ];
  public defaults = {};

  /** @ngInject **/
  constructor($scope, $injector, private templateSrv) {
    super($scope, $injector);

    _.defaultsDeep(this.target, this.defaults);

    this.target.target = this.target.target || 'Start typing tag id here';
    this.target.type = this.target.type || 'timeserie';
    this.target.aggregation = this.target.aggregation || 'average';
  }

  public getOptions(query) {
    return this.datasource.metricFindQuery(query || '');
  }

  public onChangeInternal() {
    this.panelCtrl.refresh(); // Asks the panel to refresh data.
  }
}

export class CogniteAnnotationsQueryCtrl {
  public static templateUrl = 'partials/annotations.editor.html';
}
