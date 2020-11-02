import { eventFactory } from '@grafana/data';
import { QueryDatapointsWarning, QueryRequestError } from './types';

export const DATAPOINTS_LIMIT_WARNING =
  'Datapoints limit was reached, so not all datapoints may be shown. Try increasing the granularity, or choose a smaller time range.';
export const TIMESERIES_LIMIT_WARNING =
  "Only showing first 100 timeseries. To get better results, either change the selected asset or use 'Custom Query'.";

export const failedResponseEvent = eventFactory<QueryRequestError>('failed-request');
export const datapointsWarningEvent = eventFactory<QueryDatapointsWarning>('datapoints-warning');

export const CacheTime = {
  TimeseriesList: '61s',
  ResourceByIds: '61m',
  Default: '11s',
  Dropdown: '3m',
};
