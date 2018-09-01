///<reference path="../node_modules/grafana-sdk-mocks/app/headers/common.d.ts" />
import _ from 'lodash';
import {QueryCtrl} from 'app/plugins/sdk';
import './css/query_editor.css!';

export class CogniteQueryCtrl extends QueryCtrl {
  static templateUrl = 'partials/query.editor.html';

  defaults = {
  };

  /** @ngInject **/
  constructor($scope, $injector, private templateSrv) {
    super($scope, $injector);

    _.defaultsDeep(this.target, this.defaults);

    this.target.target = this.target.target || 'select metric';
    this.target.type = this.target.type || 'timeserie';
  }

  getOptions(query) {
    return this.datasource.metricFindQuery(query || '');
  }

  onChangeInternal() {
    this.panelCtrl.refresh(); // Asks the panel to refresh data.
  }
}
