import { eventFactory, QueryDatapointsLimitWarning, QueryRequestError } from './types';

export const failedResponseEvent = eventFactory<QueryRequestError>('failed-request');
export const datapointsLimitWarningEvent = eventFactory<QueryDatapointsLimitWarning>(
  'datapoints-limit-warning'
);

export const CacheTime = {
  TimeseriesList: '151s',
  TimeseriesByIds: '61m',
  Default: '11s',
};
