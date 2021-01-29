import ms from 'ms';
import { DataSourceInstanceSettings } from '@grafana/data';
import CogniteDatasource from '../datasource';
import { CDFDataQueryRequest, QueryTarget, CogniteDataSourceOptions } from '../types';

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
  const itemsArr = items.map(({ id }) => ({
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

const instanceSettings = ({
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
  },
  withCredentials: false,
} as unknown) as DataSourceInstanceSettings<CogniteDataSourceOptions>;

export const getMockedDataSource = () => new CogniteDatasource(instanceSettings);

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
