import { cloneDeep } from 'lodash';
import { getMockedDataSource } from './utils';
import { DataQueryRequest, QueryTarget, Tab } from '../types';
import { getDatasourceValueString } from '../utils';

jest.mock('grafana/app/core/utils/datemath');
jest.mock('../cache');

const { ds, backendSrvMock, templateSrvMock } = getMockedDataSource();

function getDataqueryResponse(request: DataQueryRequest) {
  const items = request.items;
  const itemsArr = [];
  const aggregation = getDatasourceValueString(
    request.aggregates ? request.aggregates[0] : undefined
  );

  for (const item of items) {
    const datapoints = [1549336675000, 1549337275000, 1549337875000, 1549338475000].map(
      (timestamp, i) => {
        const obj = { timestamp };
        obj[aggregation] = i;
        return obj;
      }
    );
    itemsArr.push({
      datapoints,
      externalId: 'externalId' in item ? item.externalId : item.id,
    });
  }
  return getDataqueryResponseObject(itemsArr, request.aggregates ? aggregation : undefined);
}

function getDataqueryResponseObject(items, aggregates) {
  const response = {
    data: {
      items,
    },
    config: {
      data: { aggregates },
    },
  };
  return response;
}
function getTimeseriesResponse(items) {
  const response = {
    data: {
      items,
    },
  };
  return response;
}

const tsError = {
  status: 400,
  data: {
    error: {
      code: 400,
      message: 'error message',
    },
  },
};

describe('Datasource Query', () => {
  const options: any = {
    targets: [],
    range: {
      from: '1549336675000',
      to: '1549338475000',
    },
    interval: '30s',
    intervalMs: 30000,
    maxDataPoints: 760,
    format: 'json',
    panelId: 1,
    dashboardId: 1,
  };

  beforeEach(() => {
    options.panelId += 1;
  });

  describe('Given no targets', () => {
    it('should return empty data', async () => {
      const result = await ds.query(options);
      expect(backendSrvMock.datasourceRequest).not.toBeCalled();
      expect(result).toEqual({ data: [] });
    });
  });

  describe('Given empty targets', () => {
    const emptyTimeseries: QueryTarget = {
      refId: 'A',
      target: 'Start typing tag id here',
      aggregation: 'average',
      granularity: '',
      label: '',
      tab: Tab.Timeseries,
      expr: '',
      assetQuery: {
        target: '',
        timeseries: [],
        includeSubtrees: false,
        func: '',
      },
      error: undefined,
      hide: undefined,
      warning: undefined,
    };
    const emptyAsset: QueryTarget = {
      ...emptyTimeseries,
      refId: 'B',
      target: '',
      tab: Tab.Asset,
    };
    const emptyCustom: QueryTarget = {
      ...emptyTimeseries,
      refId: 'C',
      tab: Tab.Custom,
      target: undefined,
    };

    it('should return empty data', async () => {
      options.targets = [emptyTimeseries, emptyAsset, emptyCustom];
      const result = await ds.query(options);
      expect(backendSrvMock.datasourceRequest).not.toBeCalled();
      expect(result).toEqual({ data: [] });
    });
  });

  describe('Given an older queryTarget format', () => {
    let result;
    const oldTarget: QueryTarget = {
      aggregation: 'average',
      refId: 'A',
      target: 'Timeseries123',
      granularity: undefined,
      label: undefined,
      tab: undefined,
      error: undefined,
      hide: undefined,
      assetQuery: undefined,
      expr: undefined,
      warning: undefined,
    };

    beforeAll(async () => {
      options.targets = [oldTarget];
      backendSrvMock.datasourceRequest = jest
        .fn()
        .mockImplementation(x => Promise.resolve(getDataqueryResponse(x.data)));
      result = await ds.query(options);
    });

    it('should generate the correct query', () => {
      expect(backendSrvMock.datasourceRequest).toBeCalledTimes(1);
      expect(backendSrvMock.datasourceRequest.mock.calls[0][0]).toMatchSnapshot();
    });
    it('should return datapoints and the default label', () => {
      expect(result).toMatchSnapshot();
    });
  });

  describe('Given "Select Timeseries" queries', () => {
    let result;
    const tsTargetA: QueryTarget = {
      aggregation: 'none',
      refId: 'A',
      target: 'Timeseries123',
      granularity: undefined,
      label: undefined,
      tab: Tab.Timeseries,
      error: undefined,
      hide: undefined,
      assetQuery: undefined,
      expr: undefined,
      warning: undefined,
    };
    const tsTargetB: QueryTarget = {
      ...tsTargetA,
      aggregation: 'count',
      refId: 'B',
      target: 'Timeseries456',
      granularity: '20m',
    };
    const tsTargetC: QueryTarget = {
      ...tsTargetA,
      aggregation: 'step',
      refId: 'C',
      target: 'Timeseries789',
      label: '{{description}}-{{externalId}}',
    };

    const tsResponse = getTimeseriesResponse([
      { externalId: 'Timeseries789', description: 'test timeseries' },
    ]);

    beforeAll(async () => {
      options.intervalMs = 1;
      options.targets = [tsTargetA, tsTargetB, tsTargetC];
      backendSrvMock.datasourceRequest = jest
        .fn()
        .mockImplementationOnce(() => Promise.resolve(tsResponse))
        .mockImplementation(x => Promise.resolve(getDataqueryResponse(x.data)));
      result = await ds.query(options);
    });

    it('should generate the correct queries', () => {
      expect(backendSrvMock.datasourceRequest).toBeCalledTimes(4);
      expect(backendSrvMock.datasourceRequest.mock.calls[0][0]).toMatchSnapshot();
      expect(backendSrvMock.datasourceRequest.mock.calls[1][0]).toMatchSnapshot();
      expect(backendSrvMock.datasourceRequest.mock.calls[2][0]).toMatchSnapshot();
      expect(backendSrvMock.datasourceRequest.mock.calls[3][0]).toMatchSnapshot();
    });
    it('should return correct datapoints and labels', () => {
      expect(result).toMatchSnapshot();
    });
  });

  describe('Given "Select Timeseries" queries with errors', () => {
    let result;
    const tsTargetA: QueryTarget = {
      aggregation: 'none',
      refId: 'A',
      target: 'Timeseries123',
      granularity: undefined,
      label: undefined,
      tab: Tab.Timeseries,
      error: undefined,
      hide: undefined,
      assetQuery: undefined,
      expr: undefined,
      warning: undefined,
    };
    const tsTargetB = {
      ...tsTargetA,
      refId: 'B',
    };

    beforeAll(async () => {
      options.intervalMs = 60000;
      options.targets = [tsTargetA, tsTargetB];
      backendSrvMock.datasourceRequest = jest
        .fn()
        .mockRejectedValueOnce(tsError)
        .mockRejectedValueOnce({});
      result = await ds.query(options);
    });

    it('should generate the correct query', () => {
      expect(backendSrvMock.datasourceRequest).toBeCalledTimes(2);
      expect(backendSrvMock.datasourceRequest.mock.calls[0][0]).toMatchSnapshot();
      expect(backendSrvMock.datasourceRequest.mock.calls[1][0]).toMatchSnapshot();
    });
    it('should return an empty array', () => {
      expect(result).toEqual({ data: [] });
    });
    it('should display errors for malformed queries', () => {
      expect(tsTargetA.error).toBeDefined();
      expect(tsTargetA.error).not.toHaveLength(0);
      expect(tsTargetB.error).toBeDefined();
      expect(tsTargetB.error).not.toHaveLength(0);
    });
  });

  describe('Given "Select Timeseries from Asset" queries', () => {
    let result;
    const targetA: QueryTarget = {
      aggregation: 'none',
      refId: 'A',
      target: '',
      granularity: undefined,
      label: undefined,
      tab: Tab.Asset,
      error: undefined,
      hide: undefined,
      assetQuery: {
        target: '123',
        timeseries: [],
        includeSubtrees: false,
        func: undefined,
      },
      expr: undefined,
      warning: undefined,
    };
    const targetB: QueryTarget = {
      ...targetA,
      aggregation: 'min',
      refId: 'B',
      target: 'should be ignored',
      granularity: '20m',
      assetQuery: {
        target: '456',
        timeseries: [],
        includeSubtrees: true,
        func: undefined,
      },
    };
    const targetC: QueryTarget = {
      ...targetA,
      aggregation: 'max',
      refId: 'C',
      target: '',
      label: '{{description}}-{{name}}',
      assetQuery: {
        target: '789',
        timeseries: [],
        includeSubtrees: false,
        func: 'should not be evaluated',
      },
    };
    const targetD: QueryTarget = {
      ...targetA,
      aggregation: 'tv',
      refId: 'D',
      target: '',
      label: '{{description}}',
      assetQuery: {
        target: '[[AssetVariable]]',
        timeseries: [],
        includeSubtrees: false,
        func: 'should not be evaluated',
      },
    };
    const targetEmpty: QueryTarget = {
      ...targetA,
      aggregation: 'average',
      refId: 'E',
      target: '',
      label: '{{description}}-{{name}}',
      assetQuery: {
        target: '000',
        timeseries: [],
        includeSubtrees: true,
        func: undefined,
      },
    };
    const targetError1: QueryTarget = {
      ...cloneDeep(targetA),
      refId: 'E',
    };
    const targetError2: QueryTarget = {
      ...cloneDeep(targetA),
      refId: 'F',
    };

    const tsResponseA = getTimeseriesResponse([
      { name: 'Timeseries123', description: 'test timeseries' },
    ]);
    const tsResponseB = getTimeseriesResponse([
      { name: 'Timeseries123', description: 'test timeseries' },
      { name: 'Timeseries456', description: 'test timeseries' },
    ]);
    const tsResponseC = getTimeseriesResponse([
      { name: 'Timeseries123', description: 'test timeseriesA' },
      { name: 'Timeseries456', description: 'test timeseriesB' },
      { name: 'Timeseries789', description: 'test timeseriesC' },
    ]);
    const tsResponseEmpty = getTimeseriesResponse([]);

    beforeAll(async () => {
      options.intervalMs = 360000;
      options.targets = [
        targetA,
        targetB,
        targetC,
        targetD,
        targetEmpty,
        targetError1,
        targetError2,
      ];
      backendSrvMock.datasourceRequest = jest
        .fn()
        .mockImplementationOnce(() => Promise.resolve(tsResponseA))
        .mockImplementationOnce(() => Promise.resolve(tsResponseB))
        .mockImplementationOnce(() => Promise.resolve(tsResponseC))
        .mockImplementationOnce(() => Promise.resolve(tsResponseA))
        .mockImplementationOnce(() => Promise.resolve(tsResponseEmpty))
        .mockRejectedValueOnce(tsError)
        .mockRejectedValueOnce({})
        .mockImplementation(x => Promise.resolve(getDataqueryResponse(x.data)));
      result = await ds.query(options);
    });
    afterAll(() => {
      templateSrvMock.replace.mockClear();
    });

    it('should generate the correct queries', () => {
      expect(backendSrvMock.datasourceRequest).toBeCalledTimes(11);
      for (let i = 0; i < backendSrvMock.datasourceRequest.mock.calls.length; ++i) {
        expect(backendSrvMock.datasourceRequest.mock.calls[i][0]).toMatchSnapshot();
      }
    });
    it('should return correct datapoints and labels', () => {
      expect(result).toMatchSnapshot();
    });
    it('should call templateSrv.replace the correct number of times', () => {
      expect(templateSrvMock.replace).toBeCalledTimes(20);
    });
    it('should display errors for malformed queries', () => {
      expect(targetError1.error).toBe('[400 ERROR] error message');
      expect(targetError2.error).toBe('Unknown error');
    });
  });

  describe('Given custom queries', () => {
    let result;
    const targetA: QueryTarget = {
      aggregation: 'none',
      refId: 'A',
      target: '',
      granularity: undefined,
      label: undefined,
      tab: Tab.Custom,
      error: undefined,
      hide: undefined,
      assetQuery: {
        target: '123',
        timeseries: [],
        includeSubtrees: false,
        func: undefined,
      },
      expr: 'timeseries{}',
      warning: undefined,
    };
    const targetB: QueryTarget = {
      ...cloneDeep(targetA),
      expr:
        "timeseries{name=~'Timeseries.*', description!='test timeseriesA', metadata.key1 = value1, metadata.key2 !~'.*2'}[cv,10d]",
      refId: 'B',
    };
    const targetC: QueryTarget = {
      ...cloneDeep(targetA),
      expr:
        "timeseries{name=~'Timeseries.*', description!='test timeseriesA', metadata.key1 = value1, metadata.key2 !~'.*2',}[dv]",
      refId: 'C',
    };
    const targetD: QueryTarget = {
      ...cloneDeep(targetA),
      expr: 'timeseries{name=[[TimeseriesVariable]]}[none]',
      refId: 'D',
    };
    const targetE: QueryTarget = {
      ...cloneDeep(targetA),
      expr: 'timeseries{name!=$TimeseriesVariable}[]',
      label: '{{description}} {{metadata.key1}}',
      refId: 'E',
    };
    targetE.assetQuery.target = '$AssetVariable';
    const targetF: QueryTarget = {
      ...cloneDeep(targetA),
      refId: 'F',
      expr: 'timeseries{name=~".*}[]',
    };
    const targetG: QueryTarget = {
      ...cloneDeep(targetA),
      refId: 'G',
      expr: 'timeseries{name=~".*"}[avg',
    };
    const targetH: QueryTarget = {
      ...cloneDeep(targetA),
      refId: 'H',
      expr: 'timeseries{name=~".*"',
    };
    const targetI: QueryTarget = {
      ...cloneDeep(targetA),
      refId: 'I',
      expr: '',
    };
    const targetJ: QueryTarget = {
      ...cloneDeep(targetA),
      refId: 'J',
      expr: '-',
    };
    const tsResponse = getTimeseriesResponse([
      {
        name: 'Timeseries1',
        description: 'test timeseriesA',
        metadata: { key1: 'value1', key2: 'value3' },
      },
      {
        name: 'Timeseries2',
        description: 'test timeseriesB',
        metadata: { key1: 'value1', key2: 'value2' },
      },
      {
        name: 'Timeseries3',
        description: 'test timeseriesC',
        metadata: { key1: 'value1' },
      },
      {
        name: 'Timeseries4',
        description: 'test timeseriesD',
        metadata: { key1: 'value1', key2: 'value3' },
      },
      {
        name: 'Timeseries5',
        description: 'test timeseriesE',
        metadata: { key1: 'value2', key2: 'value3' },
      },
      {
        name: 'Test',
        description: 'test timeseriesF',
        metadata: { key1: 'value1', key2: 'value3' },
      },
    ]);

    beforeAll(async () => {
      options.intervalMs = 86400000;
      options.targets = [
        targetA,
        targetB,
        targetC,
        targetD,
        targetE,
        targetF,
        targetG,
        targetH,
        targetI,
        targetJ,
      ];
      backendSrvMock.datasourceRequest = jest
        .fn()
        .mockImplementationOnce(() => Promise.resolve(cloneDeep(tsResponse)))
        .mockImplementationOnce(() => Promise.resolve(cloneDeep(tsResponse)))
        .mockImplementationOnce(() => Promise.resolve(cloneDeep(tsResponse)))
        .mockImplementationOnce(() => Promise.resolve(cloneDeep(tsResponse)))
        .mockImplementationOnce(() => Promise.resolve(cloneDeep(tsResponse)))
        .mockImplementationOnce(() => Promise.resolve(cloneDeep(tsResponse)))
        .mockImplementationOnce(() => Promise.resolve(cloneDeep(tsResponse)))
        .mockImplementationOnce(() => Promise.resolve(cloneDeep(tsResponse)))
        .mockImplementationOnce(() => Promise.resolve(cloneDeep(tsResponse)))
        .mockImplementationOnce(() => Promise.resolve(getTimeseriesResponse([])))
        .mockImplementation(x => {
          if ('FGH'.includes(x.refId)) return Promise.reject(tsError);
          return Promise.resolve(getDataqueryResponse(x.data));
        });
      result = await ds.query(options);
    });
    afterAll(() => {
      templateSrvMock.replace.mockClear();
    });

    it('should generate the correct filtered queries', () => {
      expect(backendSrvMock.datasourceRequest).toBeCalledTimes(15);
      for (let i = 0; i < backendSrvMock.datasourceRequest.mock.calls.length; ++i) {
        expect(backendSrvMock.datasourceRequest.mock.calls[i][0]).toMatchSnapshot();
      }
    });

    it('should return correct datapoints and labels', () => {
      expect(result).toMatchSnapshot();
    });

    it('should call templateSrv.replace the correct number of times', () => {
      expect(templateSrvMock.replace).toBeCalledTimes(37);
    });

    it('should display errors for malformed queries', () => {
      expect(targetF.error).toBeDefined();
      expect(targetF.error).not.toHaveLength(0);
      expect(targetG.error).toBeDefined();
      expect(targetG.error).not.toHaveLength(0);
      expect(targetH.error).toBeDefined();
      expect(targetH.error).not.toHaveLength(0);
    });
  });

  describe('Given custom queries with functions', () => {
    let result;
    const targetA: QueryTarget = {
      aggregation: 'none',
      refId: 'A',
      target: '',
      granularity: undefined,
      label: undefined,
      tab: Tab.Custom,
      error: undefined,
      hide: undefined,
      assetQuery: {
        target: '123',
        timeseries: [],
        includeSubtrees: false,
        func: undefined,
      },
      expr: 'timeseries{}',
      warning: undefined,
    };
    const targetB: QueryTarget = {
      ...cloneDeep(targetA),
      refId: 'B',
      expr: '       timeseries{} + timeseries{} + [123]   ',
    };
    const targetC: QueryTarget = {
      ...cloneDeep(targetA),
      refId: 'C',
      expr: 'timeseries{}[] * timeseries{}[average]- timeseries{}[average,10s]',
      label: '{{description}} {{metadata.key1}}',
    };
    const targetD: QueryTarget = {
      ...cloneDeep(targetA),
      refId: 'D',
      expr:
        'timeseries{name=[[TimeseriesVariable]]}[none] * timeseries{name=[[TimeseriesVariable]]}[average] - timeseries{name=[[TimeseriesVariable]]}[average,10m]',
    };
    const targetE: QueryTarget = {
      ...cloneDeep(targetA),
      refId: 'E',
      expr: 'timeseries{asdaklj}',
    };
    const targetF: QueryTarget = {
      ...cloneDeep(targetA),
      refId: 'F',
      expr: '1+1',
    };
    const targetG: QueryTarget = {
      ...cloneDeep(targetA),
      refId: 'G',
      expr: 'SUM(timeseries{})',
      label: 'SUM',
    };
    const targetH: QueryTarget = {
      ...cloneDeep(targetA),
      refId: 'H',
      expr:
        'sum(timeseries{}[average]) + SuM(timeseries{}[average,1h]) * MAX(timeseries{}[count])/mIN(timeseries{name="nonexistant"}) - avg(timeseries{name="Timeseries1"}[avg]) - 3*timeseries{}[]',
    };
    const targetI: QueryTarget = {
      ...cloneDeep(targetA),
      refId: 'I',
      expr: 'max(max(timeseries{},5),5) + max(timeseries{})',
    };
    const targetJ: QueryTarget = {
      ...cloneDeep(targetA),
      refId: 'J',
      expr: 'timeseries{name=[[TimeseriesVariable]]} + [[TimeseriesVariable]]',
      label: '{{description}} : [[TimeseriesVariable]]',
    };

    const tsResponse = getTimeseriesResponse([
      {
        name: 'Timeseries1',
        id: 12,
        description: 'test timeseriesA',
        metadata: { key1: 'value1', key2: 'value3' },
      },
      {
        name: 'Timeseries2',
        id: 34,
        description: 'test timeseriesB',
        metadata: { key1: 'value1', key2: 'value2' },
      },
      {
        name: 'Timeseries3',
        id: 56,
        description: 'test timeseriesC',
        metadata: { key1: 'value1' },
      },
      {
        name: 'Timeseries4',
        id: 78,
        description: 'test timeseriesD',
        metadata: { key1: 'value1', key2: 'value3' },
      },
      {
        name: 'Timeseries5',
        id: 90,
        description: 'test timeseriesE',
        metadata: { key1: 'value2', key2: 'value3' },
      },
      {
        name: 'Test',
        id: 123,
        description: 'test timeseriesF',
        metadata: { key1: 'value1', key2: 'value3' },
      },
    ]);

    beforeAll(async () => {
      options.intervalMs = 900000000;
      options.targets = [
        targetA,
        targetB,
        targetC,
        targetD,
        targetE,
        targetF,
        targetG,
        targetH,
        targetI,
        targetJ,
      ];
      backendSrvMock.datasourceRequest = jest
        .fn()
        .mockImplementationOnce(() => Promise.resolve(cloneDeep(tsResponse)))
        .mockImplementationOnce(() => Promise.resolve(cloneDeep(tsResponse)))
        .mockImplementationOnce(() => Promise.resolve(cloneDeep(tsResponse)))
        .mockImplementationOnce(() => Promise.resolve(cloneDeep(tsResponse)))
        .mockImplementationOnce(() => Promise.resolve(cloneDeep(tsResponse)))
        .mockImplementationOnce(() => Promise.resolve(cloneDeep(tsResponse)))
        .mockImplementationOnce(() => Promise.resolve(cloneDeep(tsResponse)))
        .mockImplementationOnce(() => Promise.resolve(cloneDeep(tsResponse)))
        .mockImplementationOnce(() => Promise.resolve(cloneDeep(tsResponse)))
        .mockImplementationOnce(() => Promise.resolve(cloneDeep(tsResponse)))
        .mockImplementationOnce(x => Promise.resolve(getDataqueryResponse(x.data)))
        .mockImplementationOnce(x => Promise.resolve(getDataqueryResponse(x.data)))
        .mockImplementationOnce(x => Promise.resolve(getDataqueryResponse(x.data)))
        .mockImplementationOnce(x => Promise.resolve(getDataqueryResponse(x.data)))
        .mockRejectedValueOnce(tsError)
        .mockImplementationOnce(x => Promise.resolve(getDataqueryResponse(x.data)))
        .mockImplementationOnce(x => Promise.resolve(getDataqueryResponse(x.data)))
        .mockImplementationOnce(x => Promise.resolve(getDataqueryResponse(x.data)))
        .mockImplementationOnce(x => Promise.resolve(getDataqueryResponse(x.data)));
      result = await ds.query(options);
    });

    it('should generate the correct filtered queries', () => {
      expect(backendSrvMock.datasourceRequest).toBeCalledTimes(19);
      for (let i = 0; i < backendSrvMock.datasourceRequest.mock.calls.length; ++i) {
        expect(backendSrvMock.datasourceRequest.mock.calls[i][0]).toMatchSnapshot();
      }
    });

    it('should return correct datapoints and labels', () => {
      expect(result).toMatchSnapshot();
    });

    it('should call templateSrv.replace the correct number of times', () => {
      expect(templateSrvMock.replace).toBeCalledTimes(89);
    });

    it('should display errors for malformed queries', () => {
      expect(targetE.error).toBeDefined();
      expect(targetE.error).not.toHaveLength(0);
      expect(targetF.error).toBeDefined();
      expect(targetF.error).not.toHaveLength(0);
    });
  });

  describe('Given multiple "Select Timeseries from Asset" queries in a row', () => {
    const results = [];
    const targetA: QueryTarget = {
      aggregation: 'none',
      refId: 'A',
      target: '',
      granularity: undefined,
      label: undefined,
      tab: Tab.Asset,
      error: undefined,
      hide: undefined,
      assetQuery: {
        target: '123',
        timeseries: [],
        includeSubtrees: false,
        func: undefined,
      },
      expr: undefined,
      warning: undefined,
    };
    const targetB: QueryTarget = {
      ...targetA,
      assetQuery: {
        target: '123',
        timeseries: [],
        includeSubtrees: true,
        func: undefined,
      },
    };
    const targetC: QueryTarget = {
      ...targetA,
      assetQuery: {
        target: '456',
        timeseries: [],
        includeSubtrees: true,
        func: undefined,
      },
    };

    const tsResponseA = getTimeseriesResponse([
      { name: 'Timeseries123', description: 'test timeseries' },
    ]);
    const tsResponseB = getTimeseriesResponse([
      { name: 'Timeseries123', description: 'test timeseries' },
      { name: 'Timeseries456', description: 'test timeseries' },
    ]);
    const tsResponseEmpty = getTimeseriesResponse([]);

    beforeAll(async () => {
      options.intervalMs = 360000;
      options.targets = [targetA];
      backendSrvMock.datasourceRequest = jest
        .fn()
        .mockImplementationOnce(() => Promise.resolve(tsResponseEmpty))
        .mockImplementationOnce(() => Promise.resolve(tsResponseA))
        .mockImplementationOnce(x => Promise.resolve(getDataqueryResponse(x.data)))
        .mockImplementationOnce(() => Promise.resolve(tsResponseB))
        .mockImplementation(x => Promise.resolve(getDataqueryResponse(x.data)));
      results.push(await ds.query(options));
      results.push(await ds.query(options));
      options.targets = [targetB];
      results.push(await ds.query(options));
      options.targets = [targetC];
      results.push(await ds.query(options));
    });

    it('should generate the correct queries and not requery for asset timeseries', () => {
      expect(backendSrvMock.datasourceRequest).toBeCalledTimes(5);
      for (let i = 0; i < backendSrvMock.datasourceRequest.mock.calls.length; ++i) {
        expect(backendSrvMock.datasourceRequest.mock.calls[i][0]).toMatchSnapshot();
      }
    });
    it('should return correct datapoints and labels', () => {
      for (const result of results) {
        expect(result).toMatchSnapshot();
      }
    });
  });
});
