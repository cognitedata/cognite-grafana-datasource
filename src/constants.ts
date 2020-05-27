import { eventFactory, QueryDatapointsWarning, QueryRequestError } from './types';

export const failedResponseEvent = eventFactory<QueryRequestError>('failed-request');
export const datapointsWarningEvent = eventFactory<QueryDatapointsWarning>('datapoints-warning');

export const CacheTime = {
  TimeseriesList: '61s',
  TimeseriesByIds: '61m',
  Default: '11s',
};
