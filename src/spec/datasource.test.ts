import * as _ from 'lodash';
import q from 'q';

jest.mock('grafana/app/core/utils/datemath');
jest.mock('../cache');

import CogniteDatasource, {
  DataQueryRequest,
  QueryTarget,
  Tab,
  VariableQueryData,
} from '../datasource';
import Utils from '../utils';

function getDataqueryResponse(request: DataQueryRequest) {
  const items = request.items;
  const itemsArr = [];
  const aggregation = Utils.getDatasourceValueString(request.aggregates);

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
      name: item.name,
    });
  }
  return getDataqueryResponseObject(itemsArr, request.aggregates ? aggregation : undefined);
}

function getDataqueryResponseObject(items, aggregates) {
  const response = {
    data: {
      data: { items },
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
      data: { items },
    },
  };
  return response;
}

describe('CogniteDatasource', () => {
  const ctx: any = {};
  const instanceSettings = {
    id: 1,
    name: 'Cognite Test Data',
    type: 'cognitedata-platform-datasource',
    url: '/api/datasources/proxy/6',
    jsonData: {
      cogniteProject: 'TestProject',
    },
  };

  ctx.backendSrvMock = {
    datasourceRequest: jest.fn(),
  } as any;
  ctx.templateSrvMock = {
    variables: [
      { name: 'AssetVariable', current: { text: 'asset1', value: '123' } },
      { name: 'TimeseriesVariable', current: { text: 'timeseries1', value: 'Timeseries1' } },
    ],
    replace: jest.fn((q, options) => {
      let query = q;
      for (const templateVariable of ctx.templateSrvMock.variables) {
        query = query.replace(`[[${templateVariable.name}]]`, templateVariable.current.value);
        query = query.replace(`$${templateVariable.name}`, templateVariable.current.value);
      }
      return query;
    }),
  };

  const assetsResponse = {
    data: {
      data: {
        items: [
          { id: 123, name: 'asset 1', description: 'test asset 1', metadata: { key1: 'value1' } },
          { id: 456, name: 'asset 2', description: 'test asset 2', metadata: { key1: 'value2' } },
          { id: 789, name: 'asset 3', description: 'test asset 3', metadata: { key1: 'value3' } },
          { id: 999, name: 'foo', description: 'bar', metadata: { key1: 'value1' } },
        ],
      },
    },
  };

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
    beforeAll(() => {
      ctx.ds = new CogniteDatasource(instanceSettings, q, ctx.backendSrvMock, ctx.templateSrvMock);
      ctx.options = {
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
      };
    });
    beforeEach(() => {
      ctx.options.panelId += 1;
    });

    describe('Given no targets', () => {
      it('should return empty data', async () => {
        const result = await ctx.ds.query(ctx.options);
        expect(ctx.backendSrvMock.datasourceRequest.mock.calls.length).toBe(0);
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
          includeSubtrees: false,
          func: '',
        },
        error: undefined,
        hide: undefined,
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
        ctx.options.targets = [emptyTimeseries, emptyAsset, emptyCustom];
        const result = await ctx.ds.query(ctx.options);
        expect(ctx.backendSrvMock.datasourceRequest.mock.calls.length).toBe(0);
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
      };

      beforeAll(async () => {
        ctx.options.targets = [oldTarget];
        ctx.ds.backendSrv.datasourceRequest = jest
          .fn()
          .mockImplementation(x => Promise.resolve(getDataqueryResponse(x.data)));
        result = await ctx.ds.query(ctx.options);
      });

      it('should generate the correct query', () => {
        expect(ctx.backendSrvMock.datasourceRequest.mock.calls.length).toBe(1);
        expect(ctx.backendSrvMock.datasourceRequest.mock.calls[0][0]).toMatchSnapshot();
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
        label: '{{description}}-{{name}}',
      };

      const tsResponse = getTimeseriesResponse([
        { name: 'Timeseries789', description: 'test timeseries' },
      ]);

      beforeAll(async () => {
        ctx.options.intervalMs = 1;
        ctx.options.targets = [tsTargetA, tsTargetB, tsTargetC];
        ctx.ds.backendSrv.datasourceRequest = jest
          .fn()
          .mockImplementationOnce(() => Promise.resolve(tsResponse))
          .mockImplementation(x => Promise.resolve(getDataqueryResponse(x.data)));
        result = await ctx.ds.query(ctx.options);
      });

      it('should generate the correct queries', () => {
        expect(ctx.backendSrvMock.datasourceRequest.mock.calls.length).toBe(4);
        expect(ctx.backendSrvMock.datasourceRequest.mock.calls[0][0]).toMatchSnapshot();
        expect(ctx.backendSrvMock.datasourceRequest.mock.calls[1][0]).toMatchSnapshot();
        expect(ctx.backendSrvMock.datasourceRequest.mock.calls[2][0]).toMatchSnapshot();
        expect(ctx.backendSrvMock.datasourceRequest.mock.calls[3][0]).toMatchSnapshot();
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
      };
      const tsTargetB = {
        ...tsTargetA,
        refId: 'B',
      };

      beforeAll(async () => {
        ctx.options.intervalMs = 60000;
        ctx.options.targets = [tsTargetA, tsTargetB];
        ctx.ds.backendSrv.datasourceRequest = jest
          .fn()
          .mockRejectedValueOnce(tsError)
          .mockRejectedValueOnce({});
        result = await ctx.ds.query(ctx.options);
      });

      it('should generate the correct query', () => {
        expect(ctx.backendSrvMock.datasourceRequest.mock.calls.length).toBe(2);
        expect(ctx.backendSrvMock.datasourceRequest.mock.calls[0][0]).toMatchSnapshot();
        expect(ctx.backendSrvMock.datasourceRequest.mock.calls[1][0]).toMatchSnapshot();
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
          includeSubtrees: false,
        },
        expr: undefined,
      };
      const targetB: QueryTarget = {
        ...targetA,
        aggregation: 'min',
        refId: 'B',
        target: 'should be ignored',
        granularity: '20m',
        assetQuery: {
          target: '456',
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
      const tsResponseC = getTimeseriesResponse([
        { name: 'Timeseries123', description: 'test timeseriesA' },
        { name: 'Timeseries456', description: 'test timeseriesB' },
        { name: 'Timeseries789', description: 'test timeseriesC' },
      ]);
      const tsResponseEmpty = getTimeseriesResponse([]);

      beforeAll(async () => {
        ctx.options.intervalMs = 360000;
        ctx.options.targets = [targetA, targetB, targetC, targetD, targetEmpty];
        ctx.ds.backendSrv.datasourceRequest = jest
          .fn()
          .mockImplementationOnce(() => Promise.resolve(tsResponseA))
          .mockImplementationOnce(() => Promise.resolve(tsResponseB))
          .mockImplementationOnce(() => Promise.resolve(tsResponseC))
          .mockImplementationOnce(() => Promise.resolve(tsResponseA))
          .mockImplementationOnce(() => Promise.resolve(tsResponseEmpty))
          .mockImplementation(x => Promise.resolve(getDataqueryResponse(x.data)));
        result = await ctx.ds.query(ctx.options);
      });
      afterAll(() => {
        ctx.ds.templateSrv.replace.mockClear();
      });

      it('should generate the correct queries', () => {
        expect(ctx.backendSrvMock.datasourceRequest.mock.calls.length).toBe(9);
        for (let i = 0; i < ctx.backendSrvMock.datasourceRequest.mock.calls.length; ++i) {
          expect(ctx.backendSrvMock.datasourceRequest.mock.calls[i][0]).toMatchSnapshot();
        }
      });
      it('should return correct datapoints and labels', () => {
        expect(result).toMatchSnapshot();
      });
      it('should call templateSrv.replace the correct number of times', () => {
        expect(ctx.templateSrvMock.replace.mock.calls.length).toBe(5);
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
          includeSubtrees: false,
          func: undefined,
        },
        expr: 'timeseries{}',
      };
      const targetB: QueryTarget = {
        ..._.cloneDeep(targetA),
        expr:
          "timeseries{name=~'Timeseries.*', description!='test timeseriesA', metadata.key1 = value1, metadata.key2 !~'.*2'}[cv,10d]",
        refId: 'B',
      };
      const targetC: QueryTarget = {
        ..._.cloneDeep(targetA),
        expr:
          "timeseries{name=~'Timeseries.*', description!='test timeseriesA', metadata.key1 = value1, metadata.key2 !~'.*2',}[dv]",
        refId: 'C',
      };
      const targetD: QueryTarget = {
        ..._.cloneDeep(targetA),
        expr: 'timeseries{name=[[TimeseriesVariable]]}[none]',
        refId: 'D',
      };
      const targetE: QueryTarget = {
        ..._.cloneDeep(targetA),
        expr: 'timeseries{name!=$TimeseriesVariable}[]',
        label: '{{description}} {{metadata.key1}}',
        refId: 'E',
      };
      targetE.assetQuery.target = '$AssetVariable';
      const targetF: QueryTarget = {
        ..._.cloneDeep(targetA),
        refId: 'F',
        expr: 'timeseries{name=~".*}[]',
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
        ctx.options.intervalMs = 86400000;
        ctx.options.targets = [targetA, targetB, targetC, targetD, targetE, targetF];
        ctx.ds.backendSrv.datasourceRequest = jest
          .fn()
          .mockImplementationOnce(() => Promise.resolve(_.cloneDeep(tsResponse)))
          .mockImplementationOnce(() => Promise.resolve(_.cloneDeep(tsResponse)))
          .mockImplementationOnce(() => Promise.resolve(_.cloneDeep(tsResponse)))
          .mockImplementationOnce(() => Promise.resolve(_.cloneDeep(tsResponse)))
          .mockImplementationOnce(() => Promise.resolve(_.cloneDeep(tsResponse)))
          .mockImplementationOnce(() => Promise.resolve(_.cloneDeep(tsResponse)))
          .mockImplementation(x => Promise.resolve(getDataqueryResponse(x.data)));
        result = await ctx.ds.query(ctx.options);
      });
      afterAll(() => {
        ctx.ds.templateSrv.replace.mockClear();
      });

      it('should generate the correct filtered queries', () => {
        expect(ctx.backendSrvMock.datasourceRequest.mock.calls.length).toBe(11);
        for (let i = 0; i < ctx.backendSrvMock.datasourceRequest.mock.calls.length; ++i) {
          expect(ctx.backendSrvMock.datasourceRequest.mock.calls[i][0]).toMatchSnapshot();
        }
      });

      it('should return correct datapoints and labels', () => {
        expect(result).toMatchSnapshot();
      });

      it('should call templateSrv.replace the correct number of times', () => {
        expect(ctx.templateSrvMock.replace.mock.calls.length).toBe(12);
      });

      it('should display errors for malformed queries', () => {
        expect(targetF.error).toBeDefined();
        expect(targetF.error).not.toHaveLength(0);
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
          includeSubtrees: false,
          func: undefined,
        },
        expr: 'timeseries{function=[ID]}',
      };
      const targetB: QueryTarget = {
        ..._.cloneDeep(targetA),
        refId: 'B',
        expr: 'timeseries{function=[ID] + [ID] + [123]}',
      };
      const targetC: QueryTarget = {
        ..._.cloneDeep(targetA),
        refId: 'C',
        expr: 'timeseries{function=[ID] * [ID,average] - [ID,average,10s] + [ID,average,10s]}[]',
        label: '{{description}} {{metadata.key1}}',
      };
      const targetD: QueryTarget = {
        ..._.cloneDeep(targetA),
        refId: 'D',
        expr:
          'timeseries{name=[[TimeseriesVariable]],function=[ID] * [ID,average] - [ID,average,10m]}[none]',
      };
      const targetE: QueryTarget = {
        ..._.cloneDeep(targetA),
        refId: 'E',
        expr:
          'timeseries{name=[[TimeseriesVariable]],function=[ID] * [ID,average] - [ID,average,10m]}[average]',
      };
      const targetF: QueryTarget = {
        ..._.cloneDeep(targetA),
        refId: 'F',
        expr: 'timeseries{function=1+1}[]',
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
        ctx.options.intervalMs = 900000000;
        ctx.options.targets = [targetA, targetB, targetC, targetD, targetE, targetF];
        ctx.ds.backendSrv.datasourceRequest = jest
          .fn()
          .mockImplementationOnce(() => Promise.resolve(_.cloneDeep(tsResponse)))
          .mockImplementationOnce(() => Promise.resolve(_.cloneDeep(tsResponse)))
          .mockImplementationOnce(() => Promise.resolve(_.cloneDeep(tsResponse)))
          .mockImplementationOnce(() => Promise.resolve(_.cloneDeep(tsResponse)))
          .mockImplementationOnce(() => Promise.resolve(_.cloneDeep(tsResponse)))
          .mockImplementationOnce(() => Promise.resolve(_.cloneDeep(tsResponse)))
          .mockImplementationOnce(x => Promise.resolve(getDataqueryResponse(x.data)))
          .mockImplementationOnce(x => Promise.resolve(getDataqueryResponse(x.data)))
          .mockImplementationOnce(x => Promise.resolve(getDataqueryResponse(x.data)))
          .mockImplementationOnce(x => Promise.resolve(getDataqueryResponse(x.data)))
          .mockRejectedValueOnce(tsError);
        result = await ctx.ds.query(ctx.options);
      });

      it('should generate the correct filtered queries', () => {
        expect(ctx.backendSrvMock.datasourceRequest.mock.calls.length).toBe(11);
        for (let i = 0; i < ctx.backendSrvMock.datasourceRequest.mock.calls.length; ++i) {
          expect(ctx.backendSrvMock.datasourceRequest.mock.calls[i][0]).toMatchSnapshot();
        }
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
          includeSubtrees: false,
        },
        expr: undefined,
      };
      const targetB: QueryTarget = {
        ...targetA,
        assetQuery: {
          target: '123',
          includeSubtrees: true,
        },
      };
      const targetC: QueryTarget = {
        ...targetA,
        assetQuery: {
          target: '456',
          includeSubtrees: true,
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
        ctx.options.intervalMs = 360000;
        ctx.options.targets = [targetA];
        ctx.ds.backendSrv.datasourceRequest = jest
          .fn()
          .mockImplementationOnce(() => Promise.resolve(tsResponseEmpty))
          .mockImplementationOnce(() => Promise.resolve(tsResponseA))
          .mockImplementationOnce(x => Promise.resolve(getDataqueryResponse(x.data)))
          .mockImplementationOnce(() => Promise.resolve(tsResponseB))
          .mockImplementation(x => Promise.resolve(getDataqueryResponse(x.data)));
        results.push(await ctx.ds.query(ctx.options));
        results.push(await ctx.ds.query(ctx.options));
        ctx.options.targets = [targetB];
        results.push(await ctx.ds.query(ctx.options));
        ctx.options.targets = [targetC];
        results.push(await ctx.ds.query(ctx.options));
      });

      it('should generate the correct queries and not requery for asset timeseries', () => {
        expect(ctx.backendSrvMock.datasourceRequest.mock.calls.length).toBe(5);
        for (let i = 0; i < ctx.backendSrvMock.datasourceRequest.mock.calls.length; ++i) {
          expect(ctx.backendSrvMock.datasourceRequest.mock.calls[i][0]).toMatchSnapshot();
        }
      });
      it('should return correct datapoints and labels', () => {
        for (const result of results) {
          expect(result).toMatchSnapshot();
        }
      });
    });
  });

  describe('Annotations Query', () => {
    const annotationResponse = {
      data: {
        data: {
          items: [
            {
              assetIds: [123, 456, 789],
              description: 'event 1',
              startTime: '1549336675000',
              endTime: '1549336775000',
              type: 'type 1',
              subtype: 'subtype 1',
            },
            {
              assetIds: [123],
              description: 'event 2',
              startTime: '1549336775000',
              endTime: '1549336875000',
              type: 'type 2',
              subtype: 'subtype 2',
            },
            {
              assetIds: [456],
              description: 'event 3',
              startTime: '1549336875000',
              endTime: '1549336975000',
              type: 'type 3',
              subtype: 'subtype 3',
            },
            {
              assetIds: [789],
              description: 'event 4',
              startTime: '1549336975000',
              endTime: '1549337075000',
              type: 'type 4',
              subtype: 'subtype 4',
            },
            {
              assetIds: [123, 456, 789],
              description: 'time out of bounds',
              startTime: '1549336600000',
              endTime: '1549338500000',
              type: 'type 1',
              subtype: 'subtype 2',
              metadata: { key1: 'value1', key2: 'value2' },
            },
          ],
        },
      },
    };
    beforeAll(() => {
      ctx.backendSrvMock.datasourceRequest.mockReset();
      ctx.ds = new CogniteDatasource(instanceSettings, q, ctx.backendSrvMock, ctx.templateSrvMock);
    });

    describe('Given an empty annotation query', () => {
      let result;
      const annotationOption = {
        range: {
          from: '1549336675000',
          to: '1549338475000',
        },
        annotation: {
          expr: '',
        },
      };

      beforeAll(async () => {
        result = await ctx.ds.annotationQuery(annotationOption);
      });

      it('should return nothing', () => {
        expect(ctx.ds.backendSrv.datasourceRequest.mock.calls.length).toBe(0);
        expect(result).toEqual([]);
      });
    });

    describe('Given an annotation query without any filters', () => {
      let result;
      const annotationOption = {
        range: {
          from: '1549336675000',
          to: '1549338475000',
        },
        annotation: {
          expr: 'event{}',
        },
      };

      beforeAll(async () => {
        ctx.ds.backendSrv.datasourceRequest = jest
          .fn()
          .mockImplementation(() => Promise.resolve(annotationResponse));
        result = await ctx.ds.annotationQuery(annotationOption);
      });

      it('should return all events', () => {
        expect(ctx.ds.backendSrv.datasourceRequest.mock.calls.length).toBe(1);
        expect(result).toMatchSnapshot();
      });
    });

    describe('Given an annotation query where no events are returned', () => {
      let result;
      const annotationOption = {
        range: {
          from: '1549336675000',
          to: '1549338475000',
        },
        annotation: {
          expr: 'event{}',
        },
      };

      beforeAll(async () => {
        ctx.ds.backendSrv.datasourceRequest = jest
          .fn()
          .mockImplementation(() => Promise.resolve({ data: { data: { items: [] } } }));
        result = await ctx.ds.annotationQuery(annotationOption);
      });

      it('should return all events', () => {
        expect(ctx.ds.backendSrv.datasourceRequest.mock.calls.length).toBe(1);
        expect(result).toEqual([]);
      });
    });

    describe('Given an annotation query', () => {
      let result;
      const annotationOption = {
        range: {
          from: '1549336675000',
          to: '1549338475000',
        },
        annotation: {
          expr: "event{assetIds = [123], type= 'type 1' }",
        },
      };
      const response = _.cloneDeep(annotationResponse);
      response.data.data.items = annotationResponse.data.data.items.filter(
        item => item.assetIds.some(id => id === 123) && item.type === 'type 1'
      );

      beforeAll(async () => {
        ctx.ds.backendSrv.datasourceRequest = jest
          .fn()
          .mockImplementation(() => Promise.resolve(response));
        result = await ctx.ds.annotationQuery(annotationOption);
      });

      it('should generate the correct request', () => {
        expect(ctx.ds.backendSrv.datasourceRequest.mock.calls.length).toBe(1);
        expect(ctx.ds.backendSrv.datasourceRequest.mock.calls[0][0]).toMatchSnapshot();
      });

      it('should return the correct events', () => {
        expect(result).toMatchSnapshot();
      });
    });

    describe('Given an annotation query with a metadata request', () => {
      let result;
      const annotationOption = {
        range: {
          from: '1549336675000',
          to: '1549338475000',
        },
        annotation: {
          expr: 'event{ metadata={"key1":"value1","key2":"value2"} }',
        },
      };
      const response = _.cloneDeep(annotationResponse);
      response.data.data.items = annotationResponse.data.data.items.filter(item => item.metadata);

      beforeAll(async () => {
        ctx.ds.backendSrv.datasourceRequest = jest
          .fn()
          .mockImplementation(() => Promise.resolve(response));
        result = await ctx.ds.annotationQuery(annotationOption);
      });

      it('should generate the correct request', () => {
        expect(ctx.ds.backendSrv.datasourceRequest.mock.calls.length).toBe(1);
        expect(ctx.ds.backendSrv.datasourceRequest.mock.calls[0][0]).toMatchSnapshot();
      });

      it('should return the correct event', () => {
        expect(result).toMatchSnapshot();
      });
    });

    describe('Given an annotation query where nothing is returned', () => {
      let result;
      const annotationOption = {
        range: {
          from: '1549336675000',
          to: '1549338475000',
        },
        annotation: {
          expr: "event{type= 'non-existant type'}",
        },
      };
      const response = _.cloneDeep(annotationResponse);
      response.data.data.items = [];

      beforeAll(async () => {
        ctx.ds.backendSrv.datasourceRequest = jest
          .fn()
          .mockImplementation(() => Promise.resolve(response));
        result = await ctx.ds.annotationQuery(annotationOption);
      });

      it('should generate the correct request', () => {
        expect(ctx.ds.backendSrv.datasourceRequest.mock.calls.length).toBe(1);
        expect(ctx.ds.backendSrv.datasourceRequest.mock.calls[0][0]).toMatchSnapshot();
      });

      it('should return the correct events', () => {
        expect(result).toEqual([]);
      });
    });

    describe('Given an annotation query with filters', () => {
      let result;
      const annotationOption = {
        range: {
          from: '1549336675000',
          to: '1549338475000',
        },
        annotation: {
          expr: 'event{}',
          filter: "filter{description=~event.*, type!= 'type 1', }",
        },
      };

      beforeAll(async () => {
        ctx.ds.backendSrv.datasourceRequest = jest
          .fn()
          .mockImplementation(() => Promise.resolve(annotationResponse));
        result = await ctx.ds.annotationQuery(annotationOption);
      });

      it('should generate the correct request', () => {
        expect(ctx.ds.backendSrv.datasourceRequest.mock.calls.length).toBe(1);
        expect(ctx.ds.backendSrv.datasourceRequest.mock.calls[0][0]).toMatchSnapshot();
      });

      it('should return the correct events', () => {
        expect(result).toMatchSnapshot();
      });
    });

    describe('Given an annotation query with variables', () => {
      let result;
      const annotationOption = {
        range: {
          from: '1549336675000',
          to: '1549338475000',
        },
        annotation: {
          expr: 'event{assetIds=[$AssetVariable]}',
          filter: "filter{description!~event.*,, metadata.key1=~'', }",
        },
      };
      const response = _.cloneDeep(annotationResponse);
      response.data.data.items = annotationResponse.data.data.items.filter(item =>
        item.assetIds.some(id => id === 123)
      );

      beforeAll(async () => {
        ctx.ds.backendSrv.datasourceRequest = jest
          .fn()
          .mockImplementation(() => Promise.resolve(annotationResponse));
        result = await ctx.ds.annotationQuery(annotationOption);
      });

      it('should generate the correct request', () => {
        expect(ctx.ds.backendSrv.datasourceRequest.mock.calls.length).toBe(1);
        expect(ctx.ds.backendSrv.datasourceRequest.mock.calls[0][0]).toMatchSnapshot();
      });

      it('should return the correct events', () => {
        expect(result).toMatchSnapshot();
      });
    });

    describe('Given an annotation query with an incomplete event expression', () => {
      let result;
      const annotationOption = {
        range: {
          from: '1549336675000',
          to: '1549338475000',
        },
        annotation: {
          expr: 'event{ ',
        },
      };
      beforeAll(async () => {
        ctx.backendSrvMock.datasourceRequest.mockReset();
        result = await ctx.ds.annotationQuery(annotationOption);
      });
      it('should not generate any requests', () => {
        expect(ctx.ds.backendSrv.datasourceRequest.mock.calls.length).toBe(0);
      });
      it('should return an error', () => {
        expect(result).toMatchSnapshot();
      });
    });

    describe('Given an annotation query with an incomplete event expression', () => {
      let result;
      const annotationOption = {
        range: {
          from: '1549336675000',
          to: '1549338475000',
        },
        annotation: {
          expr: 'event{ metadata={}}}',
        },
      };
      beforeAll(async () => {
        ctx.backendSrvMock.datasourceRequest.mockReset();
        result = await ctx.ds.annotationQuery(annotationOption);
      });
      it('should not generate any requests', () => {
        expect(ctx.ds.backendSrv.datasourceRequest.mock.calls.length).toBe(0);
      });
      it('should return an error', () => {
        expect(result).toMatchSnapshot();
      });
    });

    describe('Given an annotation query with an incorrect event expression', () => {
      let result;
      const annotationOption = {
        range: {
          from: '1549336675000',
          to: '1549338475000',
        },
        annotation: {
          expr: 'event{ name=~event, foo}',
        },
      };
      beforeAll(async () => {
        result = await ctx.ds.annotationQuery(annotationOption);
      });
      it('should not generate any requests', () => {
        expect(ctx.ds.backendSrv.datasourceRequest.mock.calls.length).toBe(0);
      });
      it('should return an error', () => {
        expect(result).toMatchSnapshot();
      });
    });

    describe('Given an annotation query with an incorrect event expression', () => {
      let result;
      const annotationOption = {
        range: {
          from: '1549336675000',
          to: '1549338475000',
        },
        annotation: {
          expr: 'event{foo}',
        },
      };
      beforeAll(async () => {
        result = await ctx.ds.annotationQuery(annotationOption);
      });
      it('should not generate any requests', () => {
        expect(ctx.ds.backendSrv.datasourceRequest.mock.calls.length).toBe(0);
      });
      it('should return an error', () => {
        expect(result).toMatchSnapshot();
      });
    });

    describe('Given an annotation query with an incorrect filter expression', () => {
      let result;
      const annotationOption = {
        range: {
          from: '1549336675000',
          to: '1549338475000',
        },
        annotation: {
          expr: 'event{ }',
          filter: 'foo',
        },
      };
      beforeAll(async () => {
        result = await ctx.ds.annotationQuery(annotationOption);
      });
      it('should not generate any requests', () => {
        expect(ctx.ds.backendSrv.datasourceRequest.mock.calls.length).toBe(0);
      });
      it('should return an error', () => {
        expect(result).toMatchSnapshot();
      });
    });
  });

  describe('Metrics Query', () => {
    beforeAll(() => {
      ctx.backendSrvMock.datasourceRequest.mockReset();
      ctx.ds = new CogniteDatasource(instanceSettings, q, ctx.backendSrvMock, ctx.templateSrvMock);
    });

    describe('Given an empty metrics query', () => {
      let result;
      const variableQuery: VariableQueryData = {
        query: '',
        filter: '',
      };
      beforeAll(async () => {
        result = await ctx.ds.metricFindQuery(variableQuery);
      });
      it('should return a parse error', () => {
        expect(ctx.ds.backendSrv.datasourceRequest.mock.calls.length).toBe(0);
        expect(result).toMatchSnapshot();
      });
    });

    describe('Given a metrics query with no options', () => {
      let result;
      const variableQuery: VariableQueryData = {
        query: 'asset{}',
        filter: '',
      };
      beforeAll(async () => {
        ctx.ds.backendSrv.datasourceRequest = jest
          .fn()
          .mockImplementation(() => Promise.resolve(assetsResponse));
        result = await ctx.ds.metricFindQuery(variableQuery);
      });

      it('should generate the correct request', () => {
        expect(ctx.ds.backendSrv.datasourceRequest.mock.calls.length).toBe(1);
        expect(ctx.ds.backendSrv.datasourceRequest.mock.calls[0][0]).toMatchSnapshot();
      });

      it('should return all assets', () => {
        expect(result).toMatchSnapshot();
      });
    });

    describe('Given a simple metrics query', () => {
      let result;
      const variableQuery: VariableQueryData = {
        query: 'asset{name=asset}',
        filter: '',
      };
      const response = _.cloneDeep(assetsResponse);
      response.data.data.items = assetsResponse.data.data.items.filter(item =>
        item.name.startsWith('asset')
      );

      beforeAll(async () => {
        ctx.ds.backendSrv.datasourceRequest = jest
          .fn()
          .mockImplementation(() => Promise.resolve(response));
        result = await ctx.ds.metricFindQuery(variableQuery);
      });

      it('should generate the correct request', () => {
        expect(ctx.ds.backendSrv.datasourceRequest.mock.calls.length).toBe(1);
        expect(ctx.ds.backendSrv.datasourceRequest.mock.calls[0][0]).toMatchSnapshot();
      });

      it('should return the correct assets', () => {
        expect(result).toMatchSnapshot();
      });
    });

    describe('Given a metrics query with filters', () => {
      let result;
      const variableQuery: VariableQueryData = {
        query: 'asset{}',
        filter: 'filter{description=~ "test asset.*", metadata.key1 != value2}',
      };

      beforeAll(async () => {
        ctx.ds.backendSrv.datasourceRequest = jest
          .fn()
          .mockImplementation(() => Promise.resolve(assetsResponse));
        result = await ctx.ds.metricFindQuery(variableQuery);
      });

      it('should generate the correct request', () => {
        expect(ctx.ds.backendSrv.datasourceRequest.mock.calls.length).toBe(1);
        expect(ctx.ds.backendSrv.datasourceRequest.mock.calls[0][0]).toMatchSnapshot();
      });

      it('should return the correct assets', () => {
        expect(result).toMatchSnapshot();
      });
    });

    describe('Given an incomplete metrics query', () => {
      let result;
      const variableQuery: VariableQueryData = {
        query: 'asset{',
        filter: '',
      };
      beforeAll(async () => {
        ctx.backendSrvMock.datasourceRequest.mockReset();
        result = await ctx.ds.metricFindQuery(variableQuery);
      });
      it('should not generate a request', () => {
        expect(ctx.ds.backendSrv.datasourceRequest.mock.calls.length).toBe(0);
      });
      it('should return an error', () => {
        expect(result).toMatchSnapshot();
      });
    });

    describe('Given an incorrect metrics query', () => {
      let result;
      const variableQuery: VariableQueryData = {
        query: 'asset{name=~asset.*}',
        filter: '',
      };
      beforeAll(async () => {
        result = await ctx.ds.metricFindQuery(variableQuery);
      });
      it('should not generate a request', () => {
        expect(ctx.ds.backendSrv.datasourceRequest.mock.calls.length).toBe(0);
      });
      it('should return an error', () => {
        expect(result).toMatchSnapshot();
      });
    });

    describe('Given an incorrect metrics query', () => {
      let result;
      const variableQuery: VariableQueryData = {
        query: 'asset{name="asset}',
        filter: '',
      };
      beforeAll(async () => {
        result = await ctx.ds.metricFindQuery(variableQuery);
      });
      it('should not generate a request', () => {
        expect(ctx.ds.backendSrv.datasourceRequest.mock.calls.length).toBe(0);
      });
      it('should return an error', () => {
        expect(result).toMatchSnapshot();
      });
    });

    describe('Given an incorrect filter query', () => {
      let result;
      const variableQuery: VariableQueryData = {
        query: 'asset{name=foo}',
        filter: 'filter{',
      };
      beforeAll(async () => {
        result = await ctx.ds.metricFindQuery(variableQuery);
      });
      it('should not generate a request', () => {
        expect(ctx.ds.backendSrv.datasourceRequest.mock.calls.length).toBe(0);
      });
      it('should return an error', () => {
        expect(result).toMatchSnapshot();
      });
    });

    describe('Given an incorrect filter query', () => {
      let result;
      const variableQuery: VariableQueryData = {
        query: 'asset{name=foo}',
        filter: 'filter{foo}',
      };
      beforeAll(async () => {
        result = await ctx.ds.metricFindQuery(variableQuery);
      });
      it('should not generate a request', () => {
        expect(ctx.ds.backendSrv.datasourceRequest.mock.calls.length).toBe(0);
      });
      it('should return an error', () => {
        expect(result).toMatchSnapshot();
      });
    });
  });

  describe('Dropdown Options Query', () => {
    const tsResponse = getTimeseriesResponse([
      {
        name: 'Timeseries1',
        description: 'testA',
      },
      {
        name: 'Timeseries2',
        description: 'testB',
      },
      {
        name: 'Timeseries3',
        description: 'testC',
      },
      {
        name: 'Timeseries4',
        description: 'testD',
      },
      {
        name: 'Timeseries5',
        description: 'testE',
      },
      {
        name: 'Test',
      },
    ]);

    beforeAll(() => {
      ctx.backendSrvMock.datasourceRequest.mockReset();
      ctx.ds = new CogniteDatasource(instanceSettings, q, ctx.backendSrvMock, ctx.templateSrvMock);
    });

    describe('Given an empty request for asset options', () => {
      let result;
      beforeAll(async () => {
        ctx.ds.backendSrv.datasourceRequest = jest
          .fn()
          .mockImplementation(() => Promise.resolve(assetsResponse));
        result = await ctx.ds.getOptionsForDropdown('', Tab.Asset);
      });

      it('should generate the correct request', () => {
        expect(ctx.ds.backendSrv.datasourceRequest.mock.calls.length).toBe(1);
        expect(ctx.ds.backendSrv.datasourceRequest.mock.calls[0][0]).toMatchSnapshot();
      });

      it('should return all assets', () => {
        expect(result).toMatchSnapshot();
      });
    });

    describe('Given a request for asset options', () => {
      let result;
      const response = _.cloneDeep(assetsResponse);
      response.data.data.items = assetsResponse.data.data.items.filter(item =>
        item.name.startsWith('asset')
      );
      beforeAll(async () => {
        ctx.ds.backendSrv.datasourceRequest = jest
          .fn()
          .mockImplementation(() => Promise.resolve(response));
        result = await ctx.ds.getOptionsForDropdown('asset', Tab.Asset);
      });

      it('should generate the correct request', () => {
        expect(ctx.ds.backendSrv.datasourceRequest.mock.calls.length).toBe(1);
        expect(ctx.ds.backendSrv.datasourceRequest.mock.calls[0][0]).toMatchSnapshot();
      });

      it('should return the assets with asset in their name', () => {
        expect(result).toMatchSnapshot();
      });
    });

    describe('Given a request for asset options with additional options', () => {
      let result;
      const response = _.cloneDeep(assetsResponse);
      response.data.data.items = assetsResponse.data.data.items.filter(
        item => item.name.startsWith('asset') && item.metadata.key1 === 'value1'
      );
      const optionsObj = {
        metadata: '{"key1":"value1"}',
      };
      beforeAll(async () => {
        ctx.ds.backendSrv.datasourceRequest = jest
          .fn()
          .mockImplementation(() => Promise.resolve(response));
        result = await ctx.ds.getOptionsForDropdown('asset', Tab.Asset, optionsObj);
      });

      it('should generate the correct request', () => {
        expect(ctx.ds.backendSrv.datasourceRequest.mock.calls.length).toBe(1);
        expect(ctx.ds.backendSrv.datasourceRequest.mock.calls[0][0]).toMatchSnapshot();
      });

      it('should return the assets with asset in their name and metadata.key1 = value1', () => {
        expect(result).toMatchSnapshot();
      });
    });

    describe('Given an empty request for timeseries options', () => {
      let result;
      beforeAll(async () => {
        ctx.ds.backendSrv.datasourceRequest = jest
          .fn()
          .mockImplementation(() => Promise.resolve(tsResponse));
        result = await ctx.ds.getOptionsForDropdown('', Tab.Timeseries);
      });

      it('should generate the correct request', () => {
        expect(ctx.ds.backendSrv.datasourceRequest.mock.calls.length).toBe(1);
        expect(ctx.ds.backendSrv.datasourceRequest.mock.calls[0][0]).toMatchSnapshot();
      });

      it('should return all timeseries', () => {
        expect(result).toMatchSnapshot();
      });
    });

    describe('Given a request for timeseries options', () => {
      let result;
      const response = _.cloneDeep(tsResponse);
      response.data.data.items = tsResponse.data.data.items.filter(item =>
        item.name.startsWith('Timeseries')
      );
      beforeAll(async () => {
        ctx.ds.backendSrv.datasourceRequest = jest
          .fn()
          .mockImplementation(() => Promise.resolve(response));
        result = await ctx.ds.getOptionsForDropdown('Timeseries', Tab.Timeseries);
      });

      it('should generate the correct request', () => {
        expect(ctx.ds.backendSrv.datasourceRequest.mock.calls.length).toBe(1);
        expect(ctx.ds.backendSrv.datasourceRequest.mock.calls[0][0]).toMatchSnapshot();
      });

      it('should return timeseries with Timeseries in their name', () => {
        expect(result).toMatchSnapshot();
      });
    });
  });

  describe('Login', () => {
    beforeAll(() => {
      ctx.backendSrvMock.datasourceRequest.mockReset();
      ctx.ds = new CogniteDatasource(instanceSettings, q, ctx.backendSrvMock, ctx.templateSrvMock);
    });

    describe('When given valid login info', () => {
      let result;
      const response = {
        data: {
          data: {
            user: 'string',
            loggedIn: true,
            project: 'string',
            projectId: 0,
          },
        },
        status: 200,
      };
      beforeAll(async () => {
        ctx.ds.backendSrv.datasourceRequest = jest
          .fn()
          .mockImplementation(() => Promise.resolve(response));
        result = await ctx.ds.testDatasource();
      });

      it('should log the user in', () => {
        expect(ctx.ds.backendSrv.datasourceRequest.mock.calls.length).toBe(1);
        expect(ctx.ds.backendSrv.datasourceRequest.mock.calls[0][0]).toMatchSnapshot();
        expect(result).toMatchSnapshot();
      });
    });

    describe('When given invalid login info', () => {
      let result;
      const response = {
        data: {
          data: {
            user: 'string',
            loggedIn: false,
            project: 'string',
            projectId: 0,
          },
        },
        status: 200,
      };
      beforeAll(async () => {
        ctx.ds.backendSrv.datasourceRequest = jest
          .fn()
          .mockImplementation(() => Promise.resolve(response));
        result = await ctx.ds.testDatasource();
      });

      it('should display an error message', () => {
        expect(ctx.ds.backendSrv.datasourceRequest.mock.calls.length).toBe(1);
        expect(ctx.ds.backendSrv.datasourceRequest.mock.calls[0][0]).toMatchSnapshot();
        expect(result).toMatchSnapshot();
      });
    });
  });
});
