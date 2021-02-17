import { eventFactory } from '@grafana/data';
import { QueryWarning, QueryRequestError } from './types';

export const API_V1 = 'api/v1/projects';

export const DATAPOINTS_LIMIT_WARNING =
  `Data points limit was reached, so not all datap oints may be shown.\n` +
  `Try increasing the granularity, or choose a smaller time range.`;
export const TIMESERIES_LIMIT_WARNING =
  `Only showing first 100 time series.\n` +
  `To get better results, either change the selected asset or use 'Custom Query'.`;
export const EVENTS_LIMIT_WARNING =
  `Some results might have been omitted.\n` +
  `This usually happens when CDF returns maximal number of items (1000) and/or client-side filters are used.\n` +
  `To get better results, leverage more of push-down filters, e.g. events{externalIdPrefix='fail'} instead of events{externalId~='fail.*'} or choose a shorter time range.`;

export const failedResponseEvent = eventFactory<QueryRequestError>('failed-request');
export const responseWarningEvent = eventFactory<QueryWarning>('request-warning');

export const CacheTime = {
  TimeseriesList: '61s',
  ResourceByIds: '61m',
  Default: '11s',
  Dropdown: '3m',
};

export const AuthType = {
  OAuth: 'cdf-oauth',
  ApiKey: 'cdf-api-key',
};

export const DateFields = ['lastUpdatedTime', 'createdTime', 'startTime', 'endTime'];

export const EventFields = [
  'id',
  'externalId',
  'type',
  'subtype',
  'dataSetId',
  'assetIds',
  'source',
  'sourceId',
  'metadata',
  ...DateFields
];

export const EVENTS_PAGE_LIMIT = 1000;

export const DOCS_URL =
  'https://docs.cognite.com/cdf/dashboards/guides/grafana/getting_started.html';
