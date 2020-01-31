import CogniteDatasource from '../datasource';
import { DataQueryRequest, DataQueryRequestResponse, QueryTarget } from '../types';
import { getDatasourceValueString } from '../utils';
import ms from 'ms';

const variables = [
  { name: 'AssetVariable', current: { text: 'asset1', value: '123' } },
  { name: 'TimeseriesVariable', current: { text: 'timeseries1', value: 'Timeseries1' } },
];

export function getDataqueryResponse({ items, aggregates }: DataQueryRequest) {
  const aggrStr = getDatasourceValueString(aggregates ? aggregates[0] : undefined);
  const datapoints = [0, 1, 2, 3, 4].map(i => ({
    timestamp: i * ms('10m') + 1549336675000,
    [aggrStr]: i,
  }));
  const itemsArr = items.map(({ externalId }) => ({
    datapoints,
    externalId,
  }));
  return getItemsResponseObject(itemsArr, aggregates && aggrStr);
}

export function getItemsResponseObject(items, aggregates?: string) {
  const response = {
    data: {
      items,
    },
    config: {
      data: { aggregates },
    },
  };
  return response as DataQueryRequestResponse;
}

const getBackendSrvMock = () =>
  ({
    datasourceRequest: jest.fn(),
  } as any);

const getTemplateSrvMock = () =>
  ({
    variables,
    replace: jest.fn((q, options) => {
      let query = q;
      for (const { name, current } of variables) {
        query = query.replace(`[[${name}]]`, current.value);
        query = query.replace(`$${name}`, current.value);
      }
      return query;
    }),
  } as any);

const instanceSettings = {
  id: 1,
  orgId: 1,
  name: 'Cognite Test Data',
  typeLogoUrl: '',
  type: 'cognitedata-platform-datasource',
  access: '',
  url: '/api/datasources/proxy/6',
  password: '',
  user: '',
  database: '',
  basicAuth: false,
  basicAuthPassword: '',
  basicAuthUser: '',
  isDefault: true,
  jsonData: {
    authType: '',
    defaultRegion: '',
    cogniteProject: 'TestProject',
  },
  readOnly: false,
  withCredentials: false,
};

export const getMockedDataSource = () => {
  const templateSrvMock = getTemplateSrvMock();
  const backendSrvMock = getBackendSrvMock();
  return {
    templateSrvMock,
    backendSrvMock,
    ds: new CogniteDatasource(instanceSettings, backendSrvMock, templateSrvMock),
  };
};

export function getMeta(externalId, aggregation, labels) {
  return {
    labels,
    target: {
      aggregation,
      target: externalId,
    } as QueryTarget,
  };
}
