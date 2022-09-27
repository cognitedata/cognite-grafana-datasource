import { eventFactory, FieldType } from '@grafana/data';
import { QueryWarning, QueryRequestError } from './types';

export const API_V1 = 'api/v1/projects';

export const DATAPOINTS_LIMIT_WARNING =
  `You have reached the data points limit, and some data points may not be displayed.\n` +
  `Try increasing the granularity, or choose a shorter time range.`;
export const TIMESERIES_LIMIT_WARNING =
  `We are only showing the first 100 time series.\n` +
  `To get better results, change the selected asset or use 'Custom Query'.`;
export const EVENTS_LIMIT_WARNING =
  `Some results may have been omitted.\n` +
  `This typically happens when CDF returns the maximum number of items (1000) and when you are using client-side filters.\n` +
  `To get better results, use more specific push-down filters, for example, events{externalIdPrefix='fail'} instead of events{externalId=~'fail.*'} or choose a shorter time range.`;

export const failedResponseEvent = eventFactory<QueryRequestError>('failed-request');
export const responseWarningEvent = eventFactory<QueryWarning>('request-warning');
export const visNodeGraphPanelClickEvent = 'vis-node-graph-panel-click-event';
export const CacheTime = {
  TimeseriesList: '61s',
  ResourceByIds: '61m',
  Default: '11s',
  Dropdown: '3m',
};

export const AuthType = {
  OAuthClientCredentials: 'cdf-cc-oauth',
  OAuth: 'cdf-oauth',
  ApiKey: 'cdf-api-key',
};

export const DateFields = [
  'lastUpdatedTime',
  'createdTime',
  'startTime',
  'endTime',
  'lastSeen',
  'lastFailure',
  'lastSuccess',
];
const commonFields = ['id', 'externalId'];
export const EventFields = [
  ...commonFields,
  'type',
  'subtype',
  'assetIds',
  'source',
  'sourceId',
  'metadata',
  'dataSetId',
  ...DateFields,
];
const createFields = (parent, field) => `${parent}-${field}`;
const metaFields = [
  'Dockerfile',
  'Extractor config',
  'branch',
  'environment',
  'extractor',
  'site',
  'source',
].map((_) => createFields('metadata', _));
const notificationConfigFields = ['allowedNotSeenRangeInMinutes'].map((_) =>
  createFields('notificationConfig', _)
);
export const ExtractionPipelinesFields = [
  ...commonFields,
  'name',
  'description',
  'status',
  'message',
  'schedule',
  'runId',
  'createdBy',
  'documentation',
  'lastMessage',
  'data Set',
  ...metaFields,
  ...notificationConfigFields,
  ...DateFields,
];
export const EVENTS_PAGE_LIMIT = 1000;

export const DOCS_URL =
  'https://docs.cognite.com/cdf/dashboards/guides/grafana/getting_started.html';

export const edgeField: any = {
  id: {
    type: FieldType.string,
  },
  source: {
    type: FieldType.string,
  },
  target: {
    type: FieldType.string,
  },
  mainStat: {
    type: FieldType.string,
  },
};

export const nodeField: any = {
  id: {
    type: FieldType.string,
  },
  title: {
    type: FieldType.string,
  },
  mainStat: {
    type: FieldType.string,
  },
};
