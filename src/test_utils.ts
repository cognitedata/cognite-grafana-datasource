import ms from 'ms';
import { DataSourceInstanceSettings } from '@grafana/data';
import _ from 'lodash';
import CogniteDatasource from './datasource';
import { CDFDataQueryRequest, QueryTarget, CogniteDataSourceOptions } from './types';

export function getDataqueryResponse(
  { items, aggregates }: CDFDataQueryRequest,
  externalIdPrefix = 'externalId-',
  dpNumber: number = 5
) {
  const aggregate = aggregates ? aggregates[0] : '';
  const datapoints = new Array(dpNumber).fill(null).map((_, i) => ({
    timestamp: i * ms('10m') + 1549336675000,
    [aggregate]: i,
  }));
  const itemsArr = _.map(items, ({ id }) => ({
    id,
    datapoints,
    externalId: `${externalIdPrefix}${id}`,
  }));
  return getItemsResponseObject(itemsArr, aggregate);
}

export function getItemsResponseObject(items, aggregates?: string) {
  return {
    data: {
      items,
    },
    config: {
      data: { aggregates },
    },
  };
}

const instanceSettings = ({ oauthPassThru }) =>
  ({
    id: 1,
    name: 'Cognite Test Data',
    type: 'cognitedata-platform-datasource',
    url: '/api/datasources/proxy/6',
    password: '',
    database: '',
    basicAuth: '',
    jsonData: {
      authType: '',
      defaultRegion: '',
      cogniteProject: 'TestProject',
      oauthPassThru,
    },
    withCredentials: false,
  } as unknown as DataSourceInstanceSettings<CogniteDataSourceOptions>);

export const getMockedDataSource = (options = { oauthPassThru: false }) =>
  new CogniteDatasource(instanceSettings(options));

export const getDataSourceWithMocks = (options?: any) => {
  const ds = getMockedDataSource(options);
  return { ds, backendSrv: ds.backendSrv, templateSrv: ds.templateSrv };
};

export function getMeta(id, aggregation, labels, type = 'data') {
  return {
    labels,
    target: {
      aggregation,
      target: id,
    } as QueryTarget,
    type,
  };
}
