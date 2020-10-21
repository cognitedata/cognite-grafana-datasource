/* eslint-disable */

import _ from 'lodash';
import { QueryCtrl } from 'grafana/app/plugins/sdk';
import { appEvents } from 'grafana/app/core/core';
import './css/query_editor.css';
import CogniteDatasource from './datasource';
import { Tab, QueryTarget, QueryDatapointsWarning, QueryRequestError } from './types';
import { datapointsWarningEvent, failedResponseEvent } from './constants';

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
  customTabAggregation = [
    { value: 'none', name: 'None' },
    { value: 'average', name: 'Average' },
    { value: 'interpolation', name: 'Interpolation' },
    { value: 'stepInterpolation', name: 'Step Interpolation' },
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
    { value: Tab.Template, name: 'Template Query', src: 'templatetab.html' },
  ];
  currentTabIndex: number;
  defaults = {
    target: '',
    type: 'timeserie',
    aggregation: 'average',
    granularity: '',
    label: '',
    tab: Tab.Template,
    expr: '',
    assetQuery: {
      target: '',
      old: undefined,
      includeSubtrees: false,
    },
    templateQuery: {
      domain: '',
      domainVersion: 1,
      queryText: `query {
  wellList {
    name,
    pressure {
      datapoints(start: $__from, end: $__to, limit: 50) {
        timestamp,
        value
      }
    }
  }
}`,
      dataPath: 'wellList',
      dataPointsPath: 'pressure.datapoints',
      groupBy: 'name',
      aliasBy: '',
    },
  };

  /** @ngInject **/
  constructor($scope, $injector, private templateSrv) {
    super($scope, $injector);

    _.defaultsDeep(this.target, this.defaults);

    this.currentTabIndex = this.tabs.findIndex(x => x.value === this.target.tab) || 0;

    appEvents.on(failedResponseEvent, this.handleError);
    appEvents.on(datapointsWarningEvent, this.handleWarning);
  }

  handleWarning = ({ refId, warning }: QueryDatapointsWarning) => {
    if (this.target.refId === refId) {
      this.target.warning = warning;
    }
  };

  handleError = ({ refId, error }: QueryRequestError) => {
    if (this.target.refId === refId) {
      this.target.error = error;
    }
  };

  getOptions(query: string, type: string) {
    return this.datasource.getOptionsForDropdown(query || '', type).then(options => {
      _.defer(() => this.$scope.$digest()); // need to force the update on the dropdown
      return options;
    });
  }

  getDomains(query: string) {
    return this.datasource.getDomainsForDropdown(query).then(options => {
      _.defer(() => this.$scope.$digest()); // need to force the update on the dropdown
      return options;
    });
  }

  refreshData() {
    this.onChangeQuery();
    this.refresh(); // Asks the panel to refresh data.
  }

  onChangeQuery() {
    if (this.target.error) {
      this.target.error = '';
    }
    if (this.target.warning) {
      this.target.warning = '';
    }
  }

  onChangeDomain() {
    if (this.target.templateQuery.domain) {
      this.datasource
        .getCurrentDomainVersion(this.target.templateQuery.domain)
        .then(currentVersion => {
          this.target.templateQuery.domainVersion = currentVersion;
          this.refreshData();
        });
    }
  }

  changeTab(index: number) {
    this.currentTabIndex = index;
    this.target.tab = this.tabs[index].value;
    this.refresh();
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

  getInitAggregate() {
    if (_.findIndex(this.customTabAggregation, ['value', this.target.aggregation]) === -1) {
      this.target.aggregation = this.customTabAggregation[0].value;
      this.refresh();
    }
  }

  $onDestroy() {
    appEvents.off(failedResponseEvent, this.handleError);
    appEvents.off(datapointsWarningEvent, this.handleWarning);
  }
}
