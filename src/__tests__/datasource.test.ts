import { cloneDeep } from 'lodash';
import { getMockedDataSource, getDataqueryResponse, getItemsResponseObject } from './utils';
import { Tab, InputQueryTarget } from '../types';
import ms from 'ms';

jest.mock('grafana/app/core/utils/datemath');
jest.mock('../cache');

type QueryTargetLike = Partial<InputQueryTarget>;

const { ds, backendSrvMock, templateSrvMock } = getMockedDataSource();

const tsError = {
  status: 400,
  data: {
    error: {
      code: 400,
      message: 'error message',
    },
  },
};
const externalIdPrefix = 'Timeseries';

describe('Datasource Query', () => {
  const options: any = {
    targets: [],
    range: {
      from: '1549336675000',
      to: '1549338475000',
    },
    interval: '30s',
    intervalMs: ms('30s'),
    maxDataPoints: 760,
    format: 'json',
    panelId: 1,
    dashboardId: 1,
  };

  beforeEach(() => {
    options.panelId++;
  });

  describe('Given an older queryTarget format', () => {
    let results;
    const id = 123;
    const aggregates = ['average'];
    const items = [{ id }];
    const oldTarget: QueryTargetLike = {
      aggregation: aggregates[0],
      target: id,
      refId: 'A',
    };
    const [start, end] = [+options.range.from, +options.range.to];

    it('should generate the correct query', async () => {
      backendSrvMock.datasourceRequest = jest
        .fn()
        .mockImplementation(x => Promise.resolve(getDataqueryResponse(x.data)));
      results = await ds.fetchTimeseriesForTargets([oldTarget] as any, options);

      expect(backendSrvMock.datasourceRequest).toBeCalledTimes(1);
      expect(backendSrvMock.datasourceRequest.mock.calls[0][0].data).toEqual({
        end,
        start,
        items,
        aggregates,
        limit: 10000,
        granularity: '30s',
      });
    });

    it('should give correct meta responses', async () => {
      expect(results.succeded[0].metadata).toEqual({
        target: oldTarget,
        labels: [''],
      });
      expect(results.succeded[0].result).toEqual(getDataqueryResponse({ items, aggregates }));
    });
  });

  describe('Given "Select Timeseries" queries', () => {
    let result;
    const id = 789;
    const tsTargetA: QueryTargetLike = {
      aggregation: 'none',
      refId: 'A',
      target: 123,
      tab: Tab.Timeseries,
    };
    const tsTargetB: QueryTargetLike = {
      ...tsTargetA,
      aggregation: 'count',
      refId: 'B',
      target: 456,
      granularity: '20m',
    };
    const tsTargetC: QueryTargetLike = {
      ...tsTargetA,
      aggregation: 'step',
      refId: 'C',
      target: id,
      label: '{{description}}-{{id}}',
    };

    const tsResponse = getItemsResponseObject([
      {
        id,
        description: 'test timeseries',
      },
    ]);

    beforeAll(async () => {
      options.intervalMs = 1;
      options.targets = [tsTargetA, tsTargetB, tsTargetC];
      backendSrvMock.datasourceRequest = jest
        .fn()
        .mockImplementationOnce(() => Promise.resolve(tsResponse))
        .mockImplementation(x => Promise.resolve(getDataqueryResponse(x.data, externalIdPrefix)));
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
      const { target: targetA } = tsTargetA;
      const { target: targetB, aggregation: aggregationB } = tsTargetB;
      const {
        data: {
          items: [{ id: targetC, description }],
        },
      } = tsResponse;

      expect(result.data[0].target).toEqual(`${externalIdPrefix}${targetA}`);
      expect(result.data[1].target).toEqual(`${aggregationB} ${externalIdPrefix}${targetB}`);
      expect(result.data[2].target).toEqual(`${description}-${targetC}`);
    });
  });

  describe('Given "Select Timeseries" queries with errors', () => {
    let result;
    const id = 123;
    const tsTargetA: QueryTargetLike = {
      aggregation: 'none',
      refId: 'A',
      target: id,
      tab: Tab.Timeseries,
    };
    const tsTargetB: QueryTargetLike = {
      ...tsTargetA,
      refId: 'B',
    };

    beforeAll(async () => {
      options.intervalMs = ms('1m');
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
    const targetA: QueryTargetLike = {
      aggregation: 'none',
      refId: 'A',
      tab: Tab.Asset,
      assetQuery: {
        target: '123',
        timeseries: [],
        includeSubtrees: false,
      },
    };
    const targetB: QueryTargetLike = {
      ...targetA,
      aggregation: 'min',
      refId: 'B',
      target: '',
      granularity: '20m',
      assetQuery: {
        target: '456',
        timeseries: [],
        includeSubtrees: true,
      },
    };
    const targetC: QueryTargetLike = {
      ...targetA,
      aggregation: 'max',
      refId: 'C',
      target: '',
      label: '{{description}}-{{externalId}}',
      assetQuery: {
        target: '789',
        timeseries: [],
        includeSubtrees: false,
        func: 'should not be evaluated',
      },
    };
    const targetD: QueryTargetLike = {
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
    const targetEmpty: QueryTargetLike = {
      ...targetA,
      aggregation: 'average',
      refId: 'E',
      target: 123,
      label: '{{description}}-{{externalId}}',
      assetQuery: {
        target: '000',
        timeseries: [],
        includeSubtrees: true,
      },
    };
    const targetError1: QueryTargetLike = {
      ...cloneDeep(targetA),
      refId: 'E',
    };
    const targetError2: QueryTargetLike = {
      ...cloneDeep(targetA),
      refId: 'F',
    };

    const tsResponseA = getItemsResponseObject([
      { id: 123, externalId: 'Timeseries123', description: 'test timeseries' },
    ]);
    const tsResponseB = getItemsResponseObject([
      { id: 123, externalId: 'Timeseries123', description: 'test timeseries' },
      { id: 456, externalId: 'Timeseries456', description: 'test timeseries' },
    ]);
    const tsResponseC = getItemsResponseObject([
      { id: 123, externalId: 'Timeseries123', description: 'test timeseriesA' },
      { id: 456, externalId: 'Timeseries456', description: 'test timeseriesB' },
      { id: 789, externalId: 'Timeseries789', description: 'test timeseriesC' },
    ]);
    const tsResponseEmpty = getItemsResponseObject([]);

    beforeAll(async () => {
      options.intervalMs = ms('6m');
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
        .mockImplementation(x => Promise.resolve(getDataqueryResponse(x.data, externalIdPrefix)));
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

    it('should replace filter assetQuery [[variable]] with its value', () => {
      expect(backendSrvMock.datasourceRequest.mock.calls[3][0].data.filter.assetIds[0]).toEqual(
        '123'
      );
    });

    it('should return correct datapoints and labels', () => {
      expect(result).toMatchSnapshot();
    });

    it('should display errors for malformed queries', () => {
      expect(targetError1.error).toBe('[400 ERROR] error message');
      expect(targetError2.error).toBe('Unknown error');
    });
  });

  describe('Given multiple "Select Timeseries from Asset" queries in a row', () => {
    const results = [];
    const targetA: QueryTargetLike = {
      aggregation: 'none',
      refId: 'A',
      target: 123,
      tab: Tab.Asset,
      assetQuery: {
        target: '123',
        timeseries: [],
        includeSubtrees: false,
      },
    };
    const targetB: QueryTargetLike = {
      ...targetA,
      assetQuery: {
        target: '123',
        timeseries: [],
        includeSubtrees: true,
      },
    };
    const targetC: QueryTargetLike = {
      ...targetA,
      assetQuery: {
        target: '456',
        timeseries: [],
        includeSubtrees: true,
      },
    };

    const tsResponseA = getItemsResponseObject([
      { id: 123, externalId: 'Timeseries123', description: 'test timeseries' },
    ]);
    const tsResponseB = getItemsResponseObject([
      { id: 123, externalId: 'Timeseries123', description: 'test timeseries' },
      { id: 456, externalId: 'Timeseries456', description: 'test timeseries' },
    ]);
    const tsResponseEmpty = getItemsResponseObject([]);

    beforeAll(async () => {
      options.intervalMs = ms('6m');
      options.targets = [targetA];
      backendSrvMock.datasourceRequest = jest
        .fn()
        .mockImplementationOnce(() => Promise.resolve(tsResponseEmpty))
        .mockImplementationOnce(() => Promise.resolve(tsResponseA))
        .mockImplementationOnce(x =>
          Promise.resolve(getDataqueryResponse(x.data, externalIdPrefix))
        )
        .mockImplementationOnce(() => Promise.resolve(tsResponseB))
        .mockImplementation(x => Promise.resolve(getDataqueryResponse(x.data, externalIdPrefix)));
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

  xdescribe('Given custom queries', () => {
    let result;
    const targetA: QueryTargetLike = {
      aggregation: 'none',
      refId: 'A',
      target: 123,
      tab: Tab.Custom,
      assetQuery: {
        target: '123',
        timeseries: [],
        includeSubtrees: false,
      },
      expr: 'timeseries{}',
    };
    const targetB: QueryTargetLike = {
      ...cloneDeep(targetA),
      expr:
        "timeseries{externalId=~'Timeseries.*', description!='test timeseriesA', metadata.key1 = value1, metadata.key2 !~'.*2'}[cv,10d]",
      refId: 'B',
    };
    const targetC: QueryTargetLike = {
      ...cloneDeep(targetA),
      expr:
        "timeseries{externalId=~'Timeseries.*', description!='test timeseriesA', metadata.key1 = value1, metadata.key2 !~'.*2',}[dv]",
      refId: 'C',
    };
    const targetD: QueryTargetLike = {
      ...cloneDeep(targetA),
      expr: 'timeseries{externalId=[[TimeseriesVariable]]}[none]',
      refId: 'D',
    };
    const targetE: QueryTargetLike = {
      ...cloneDeep(targetA),
      expr: 'timeseries{externalId!=$TimeseriesVariable}[]',
      label: '{{description}} {{metadata.key1}}',
      refId: 'E',
    };
    targetE.assetQuery.target = '$AssetVariable';
    const targetF: QueryTargetLike = {
      ...cloneDeep(targetA),
      refId: 'F',
      expr: 'timeseries{externalId=~".*}[]',
    };
    const targetG: QueryTargetLike = {
      ...cloneDeep(targetA),
      refId: 'G',
      expr: 'timeseries{externalId=~".*"}[avg',
    };
    const targetH: QueryTargetLike = {
      ...cloneDeep(targetA),
      refId: 'H',
      expr: 'timeseries{externalId=~".*"',
    };
    const targetI: QueryTargetLike = {
      ...cloneDeep(targetA),
      refId: 'I',
      expr: '',
    };
    const targetJ: QueryTargetLike = {
      ...cloneDeep(targetA),
      refId: 'J',
      expr: '-',
    };
    const tsResponse = getItemsResponseObject([
      {
        id: 1,
        externalId: 'Timeseries1',
        description: 'test timeseriesA',
        metadata: { key1: 'value1', key2: 'value3' },
      },
      {
        id: 2,
        externalId: 'Timeseries2',
        description: 'test timeseriesB',
        metadata: { key1: 'value1', key2: 'value2' },
      },
      {
        id: 3,
        externalId: 'Timeseries3',
        description: 'test timeseriesC',
        metadata: { key1: 'value1' },
      },
      {
        id: 4,
        externalId: 'Timeseries4',
        description: 'test timeseriesD',
        metadata: { key1: 'value1', key2: 'value3' },
      },
      {
        id: 5,
        externalId: 'Timeseries5',
        description: 'test timeseriesE',
        metadata: { key1: 'value2', key2: 'value3' },
      },
      {
        id: 6,
        externalId: 'Test',
        description: 'test timeseriesF',
        metadata: { key1: 'value1', key2: 'value3' },
      },
    ]);

    beforeAll(async () => {
      options.intervalMs = ms('1d');
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
        .mockImplementationOnce(() => Promise.resolve(getItemsResponseObject([])))
        .mockImplementation(x => {
          if ('FGH'.includes(x.refId)) return Promise.reject(tsError);
          return Promise.resolve(getDataqueryResponse(x.data, externalIdPrefix));
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

    it('should replace filter assetIds $variable with assetId', () => {
      expect(backendSrvMock.datasourceRequest.mock.calls[4][0].data.filter.assetIds[0]).toEqual(
        '123'
      );
    });

    it('should return correct datapoints and labels', () => {
      expect(result).toMatchSnapshot();
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
  xdescribe('Given custom queries with functions', () => {
    let result;
    const targetA: QueryTargetLike = {
      aggregation: 'none',
      refId: 'A',
      target: 123,
      tab: Tab.Custom,
      assetQuery: {
        target: '123',
        timeseries: [],
        includeSubtrees: false,
      },
      expr: 'timeseries{}',
    };
    const targetB: QueryTargetLike = {
      ...cloneDeep(targetA),
      refId: 'B',
      expr: '       timeseries{} + timeseries{} + [123]   ',
    };
    const targetC: QueryTargetLike = {
      ...cloneDeep(targetA),
      refId: 'C',
      expr: 'timeseries{}[] * timeseries{}[average]- timeseries{}[average,10s]',
      label: '{{description}} {{metadata.key1}}',
    };
    const targetD: QueryTargetLike = {
      ...cloneDeep(targetA),
      refId: 'D',
      expr:
        'timeseries{externalId=[[TimeseriesVariable]]}[none] * timeseries{externalId=[[TimeseriesVariable]]}[average] - timeseries{externalId=[[TimeseriesVariable]]}[average,10m]',
    };
    const targetE: QueryTargetLike = {
      ...cloneDeep(targetA),
      refId: 'E',
      expr: 'timeseries{asdaklj}',
    };
    const targetF: QueryTargetLike = {
      ...cloneDeep(targetA),
      refId: 'F',
      expr: '1+1',
    };
    const targetG: QueryTargetLike = {
      ...cloneDeep(targetA),
      refId: 'G',
      expr: 'SUM(timeseries{})',
      label: 'SUM',
    };
    const targetH: QueryTargetLike = {
      ...cloneDeep(targetA),
      refId: 'H',
      expr:
        'sum(timeseries{}[average]) + SuM(timeseries{}[average,1h]) * MAX(timeseries{}[count])/mIN(timeseries{externalId="nonexistant"}) - avg(timeseries{externalId="Timeseries1"}[avg]) - 3*timeseries{}[]',
    };
    const targetI: QueryTargetLike = {
      ...cloneDeep(targetA),
      refId: 'I',
      expr: 'max(max(timeseries{},5),5) + max(timeseries{})',
    };
    const targetJ: QueryTargetLike = {
      ...cloneDeep(targetA),
      refId: 'J',
      expr: 'timeseries{externalId=[[TimeseriesVariable]]} + [[TimeseriesVariable]]',
      label: '{{description}} : [[TimeseriesVariable]]',
    };

    const tsResponse = getItemsResponseObject([
      {
        externalId: 'Timeseries1',
        id: 12,
        description: 'test timeseriesA',
        metadata: { key1: 'value1', key2: 'value3' },
      },
      {
        externalId: 'Timeseries2',
        id: 34,
        description: 'test timeseriesB',
        metadata: { key1: 'value1', key2: 'value2' },
      },
      {
        externalId: 'Timeseries3',
        id: 56,
        description: 'test timeseriesC',
        metadata: { key1: 'value1' },
      },
      {
        externalId: 'Timeseries4',
        id: 78,
        description: 'test timeseriesD',
        metadata: { key1: 'value1', key2: 'value3' },
      },
      {
        externalId: 'Timeseries5',
        id: 90,
        description: 'test timeseriesE',
        metadata: { key1: 'value2', key2: 'value3' },
      },
      {
        externalId: 'Test',
        id: 123,
        description: 'test timeseriesF',
        metadata: { key1: 'value1', key2: 'value3' },
      },
    ]);

    beforeAll(async () => {
      options.intervalMs = ms('2.5h');
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
        .mockImplementationOnce(x =>
          Promise.resolve(getDataqueryResponse(x.data, externalIdPrefix))
        )
        .mockImplementationOnce(x =>
          Promise.resolve(getDataqueryResponse(x.data, externalIdPrefix))
        )
        .mockImplementationOnce(x =>
          Promise.resolve(getDataqueryResponse(x.data, externalIdPrefix))
        )
        .mockImplementationOnce(x =>
          Promise.resolve(getDataqueryResponse(x.data, externalIdPrefix))
        )
        .mockRejectedValueOnce(tsError)
        .mockImplementationOnce(x =>
          Promise.resolve(getDataqueryResponse(x.data, externalIdPrefix))
        )
        .mockImplementationOnce(x =>
          Promise.resolve(getDataqueryResponse(x.data, externalIdPrefix))
        )
        .mockImplementationOnce(x =>
          Promise.resolve(getDataqueryResponse(x.data, externalIdPrefix))
        )
        .mockImplementationOnce(x =>
          Promise.resolve(getDataqueryResponse(x.data, externalIdPrefix))
        );
      result = await ds.query(options);
    });

    it('should generate the correct filtered queries', () => {
      expect(backendSrvMock.datasourceRequest).toBeCalledTimes(19);
      for (let i = 0; i < backendSrvMock.datasourceRequest.mock.calls.length; ++i) {
        expect(backendSrvMock.datasourceRequest.mock.calls[i][0]).toMatchSnapshot();
      }
    });

    it('should replace [[variable]] in label', () => {
      expect(result.data[32].target).toEqual('test timeseriesA : Timeseries1');
    });

    it('should return correct datapoints and labels', () => {
      expect(result).toMatchSnapshot();
    });

    it('should display errors for malformed queries', () => {
      expect(targetE.error).toBeDefined();
      expect(targetE.error).not.toHaveLength(0);
      expect(targetF.error).toBeDefined();
      expect(targetF.error).not.toHaveLength(0);
    });
  });
});
