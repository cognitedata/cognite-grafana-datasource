import { eventFactory } from './utils';

export const failedResponseEvent = eventFactory('failed-request');
export const datapointsLimitWarningEvent = eventFactory('datapoints-limit-warning');
