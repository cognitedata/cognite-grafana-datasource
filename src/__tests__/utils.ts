import CogniteDatasource from '../datasource';

const variables = [
  { name: 'AssetVariable', current: { text: 'asset1', value: '123' } },
  { name: 'TimeseriesVariable', current: { text: 'timeseries1', value: 'Timeseries1' } },
];

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
