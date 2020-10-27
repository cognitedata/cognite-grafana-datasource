import ms from 'ms';
import { DataSourceInstanceSettings } from '@grafana/data';
import CogniteDatasource from '../datasource';
import { CDFDataQueryRequest, QueryTarget, CogniteDataSourceOptions } from '../types';

const variables = [
  { name: 'AssetVariable', current: { text: 'asset1', value: 123 } },
  { name: 'TimeseriesVariable', current: { text: 'timeseries1', value: 'Timeseries1' } },
  { name: 'MultiValue', current: { text: 'asset2', value: [123, 456] } },
  { name: 'Type', current: { text: 'type', value: '"type_or_subtype"' } },
];

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

const getBackendSrvMock = () =>
  ({
    datasourceRequest: jest.fn(),
  } as any);

const getTemplateSrvMock = () =>
  ({
    variables,
    replace: jest.fn((q, options) => {
      let query = q;
      variables.forEach(({ name, current }) => {
        const varSyntax1 = new RegExp(`\\[\\[${name}\\]\\]`, 'g');
        const varSyntax2 = new RegExp(`\\$${name}`, 'g');
        const varSyntax3 = new RegExp(
          `\\$\\{${name}:(json|csv|glob|regex|pipe|distributed|lucene|percentencode|singlequote|doublequote|sqlstring)}`,
          'g'
        );
        query = query.replace(varSyntax1, current.value);
        query = query.replace(varSyntax2, current.value);
        query = query.replace(varSyntax3, current.value);
      });
      return query;
    }),
  } as any);

const instanceSettings = ({
  id: 1,
  // orgId: 1,
  name: 'Cognite Test Data',
  // typeLogoUrl: '',
  type: 'cognitedata-platform-datasource',
  // access: '',
  url: '/api/datasources/proxy/6',
  password: '',
  // user: '',
  database: '',
  basicAuth: '',
  // basicAuthPassword: '',
  // basicAuthUser: '',
  // isDefault: true,
  jsonData: {
    authType: '',
    defaultRegion: '',
    cogniteProject: 'TestProject',
  },
  // readOnly: false,
  withCredentials: false,
  // secureJsonFields: {},
} as unknown) as DataSourceInstanceSettings<CogniteDataSourceOptions>;

export const getMockedDataSource = () => {
  const templateSrvMock = getTemplateSrvMock();
  const backendSrvMock = getBackendSrvMock();
  return {
    backendSrvMock,
    ds: new CogniteDatasource(instanceSettings, backendSrvMock, templateSrvMock),
  };
};

export function getMeta(id, aggregation, labels) {
  return {
    labels,
    target: {
      aggregation,
      target: id,
    } as QueryTarget,
  };
}
