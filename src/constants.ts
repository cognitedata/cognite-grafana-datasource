import { eventFactory, QueryDatapointsLimitWarning, QueryRequestError } from './types';

export const failedResponseEvent = eventFactory<QueryRequestError>('failed-request');
export const datapointsLimitWarningEvent = eventFactory<QueryDatapointsLimitWarning>(
  'datapoints-limit-warning'
);
