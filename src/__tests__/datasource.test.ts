import ms from 'ms';
import { cloneDeep } from 'lodash';
import { TimeSeries } from '@grafana/data';
import { filterEmptyQueryTargets } from '../datasource';
import { CogniteQuery, defaultQuery, defaultRelationshipsQuery, QueryTarget, Tab } from '../types';
import {
  getDataqueryResponse,
  getDataSourceWithMocks,
  getItemsResponseObject,
  getMockedDataSource,
} from '../test_utils';
import { failedResponseEvent } from '../constants';
import { eventBusService } from '../appEventHandler';
import { lastValueFrom } from 'rxjs';


jest.mock('@grafana/data');
type Mock = jest.Mock;

type QueryTargetLike = Partial<CogniteQuery>;

const { Asset, Custom, Timeseries } = Tab;

const appEvents = eventBusService;

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
const options: any = {
  targets: [],
  range: {
    from: 1549336675000,
    to: 1549338475000,
  },
  interval: '30s',
  intervalMs: ms('30s'),
  maxDataPoints: 760,
  format: 'json',
  panelId: 1,
  dashboardUID: 1,
  timezone: 'Europe/Oslo'
};
const tsResponseWithId = (id, externalId = `Timeseries${id}`, description = 'test timeseries') =>
  getItemsResponseObject([{ id, externalId, description }]);

describe('Datasource Query', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runAllTimers();
    options.panelId += 1;
  });

  describe('Given an older queryTarget format', () => {
    const fetcher = { fetch: jest.fn() };
    const ds = getMockedDataSource(fetcher);
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
      fetcher.fetch = jest
        .fn()
        .mockImplementation((x) => Promise.resolve(getDataqueryResponse(x.data)));
      results = await ds.timeseriesDatasource.fetchTimeseriesForTargets(
        [oldTarget] as any,
        options
      );

      expect(fetcher.fetch).toBeCalledTimes(1);
      expect((fetcher.fetch as Mock).mock.calls[0][0].data).toEqual({
        end,
        start,
        items,
        aggregates,
        limit: 10000,
        granularity: '30s',
        timeZone: 'Europe/Oslo',
      });
    });

    it('should give correct meta responses', async () => {
      expect(results.succeded[0].metadata).toEqual({
        target: oldTarget,
        labels: [''],
        type: 'data',
      });
      expect(results.succeded[0].result).toEqual(getDataqueryResponse({ items, aggregates }));
    });
  });

  describe('Given "Select Timeseries" queries', () => {
    const fetcher = { fetch: jest.fn() };
    const ds = getMockedDataSource(fetcher);
    let result;
    const id = 789;
    const tsTargetA: QueryTargetLike = {
      aggregation: 'none',
      refId: 'A',
      target: 123,
      tab: Timeseries,
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
      fetcher.fetch = jest
        .fn()
        .mockImplementationOnce(() => Promise.resolve(tsResponse))
        .mockImplementation((x) => Promise.resolve(getDataqueryResponse(x.data, externalIdPrefix)));
        const observableRes = ds.query(options);
        result = await lastValueFrom(observableRes);
    });

    it('should generate the correct queries', () => {
      expect(fetcher.fetch).toBeCalledTimes(4);
      expect((fetcher.fetch as Mock).mock.calls[0][0]).toMatchSnapshot();
      expect((fetcher.fetch as Mock).mock.calls[1][0]).toMatchSnapshot();
      expect((fetcher.fetch as Mock).mock.calls[2][0]).toMatchSnapshot();
      expect((fetcher.fetch as Mock).mock.calls[3][0]).toMatchSnapshot();
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

  describe.skip('Given "Select Timeseries" queries with errors', () => {
    const fetcher = { fetch: jest.fn() };
    const ds = getMockedDataSource(fetcher);
    let result;
    const tsTargetA: QueryTargetLike = {
      aggregation: 'none',
      refId: 'A',
      target: 1,
      tab: Timeseries,
    };
    const tsTargetB: QueryTargetLike = {
      ...tsTargetA,
      target: 2,
      refId: 'B',
    };

    beforeAll(async () => {
      options.intervalMs = ms('1m');
      options.targets = [tsTargetA, tsTargetB];
      fetcher.fetch = jest
        .fn()
        .mockRejectedValueOnce(tsError)
        .mockRejectedValueOnce({});
      result = await lastValueFrom(ds.query(options));
    });

    it('should return an empty array', () => {
      expect(result).toEqual({ data: [] });
    });
    it('should display errors for malformed queries', () => {
      expect(appEvents.emit as Mock).toHaveBeenCalledTimes(2);
      expect((appEvents.emit as Mock).mock.calls[0][1]).toEqual({
        refId: 'A',
        error: '[400 ERROR] error message',
      });
      expect((appEvents.emit as Mock).mock.calls[1][1]).toEqual({
        refId: 'B',
        error: 'Unknown error',
      });
    });
  });

  //
  describe('Given "Select Timeseries from Asset" queries', () => {
    const fetcher = { fetch: jest.fn() };
    const ds = getMockedDataSource(fetcher);
    let result;
    const assetQuery = {
      target: '789',
      includeSubtrees: false,
    };
    const targetC: QueryTargetLike = {
      assetQuery,
      tab: Asset,
      aggregation: 'max',
      refId: 'C',
      target: '',
      label: '{{description}}-{{externalId}}',
    };
    const targetD: QueryTargetLike = {
      ...targetC,
      aggregation: 'tv',
      refId: 'D',
      target: '',
      label: '{{description}}',
      assetQuery: {
        ...assetQuery,
        target: '[[AssetVariable]]',
      },
    };
    const targetError1: QueryTargetLike = {
      ...cloneDeep(targetC),
      refId: 'E',
      assetQuery: {
        ...assetQuery,
        target: '1',
      },
    };
    const targetError2: QueryTargetLike = {
      ...cloneDeep(targetC),
      refId: 'F',
      assetQuery: {
        ...assetQuery,
        target: '2',
      },
    };

    const tsResponseA = getItemsResponseObject([
      { id: 123, externalId: 'Timeseries123', description: 'test timeseries' },
    ]);
    const tsResponseC = getItemsResponseObject([
      { id: 123, externalId: 'Timeseries123', description: 'test timeseriesA' },
      { id: 456, externalId: 'Timeseries456', description: 'test timeseriesB' },
      { id: 789, externalId: 'Timeseries789', description: 'test timeseriesC' },
    ]);

    beforeAll(async () => {
      options.intervalMs = ms('6m');
      options.targets = [targetC, targetD, targetError1, targetError2];
      fetcher.fetch = jest
        .fn()
        .mockImplementationOnce(() => Promise.resolve(tsResponseC))
        .mockImplementationOnce(() => Promise.resolve(tsResponseA))
        .mockRejectedValueOnce(tsError)
        .mockRejectedValueOnce({})
        .mockImplementationOnce(() => Promise.resolve(tsResponseC))
        .mockImplementationOnce(() => Promise.resolve(tsResponseA))
        .mockImplementation((x) => Promise.resolve(getDataqueryResponse(x.data, externalIdPrefix)));
      result = await lastValueFrom(ds.query(options));
    });

    it('should generate the correct queries', () => {
      // console.log(result);
      expect(fetcher.fetch).toHaveBeenCalledTimes(8);
      for (let i = 0; i < (fetcher.fetch as Mock).mock.calls.length; i += 1) {
        expect((fetcher.fetch as Mock).mock.calls[i][0]).toMatchSnapshot();
      }
    });

    it('should replace filter assetQuery [[variable]] with its value', () => {
      expect(
        (fetcher.fetch as Mock).mock.calls[1][0].data.filter.assetIds[0]
      ).toEqual('123');
    });

    it('should return correct datapoints and labels', () => {
      expect(result).toMatchSnapshot();
    });

    it('should display errors for malformed queries', () => {
      expect(appEvents.emit as Mock).toHaveBeenCalledWith(failedResponseEvent, {
        refId: 'E',
        error: '[400 ERROR] error message',
      });
      expect(appEvents.emit).toHaveBeenCalledWith(failedResponseEvent, {
        refId: 'F',
        error: 'Unknown error',
      });
    });
  });

  describe('Give "Select Timeseries of Relationships target from Asset" queries', () => {
    const fetcher = { fetch: jest.fn() };
    const ds = getMockedDataSource(fetcher);
    let result;
    const assetQuery = {
      target: '789',
      includeSubtrees: false,
      withRelationships: true,
      includeSubTimeseries: true,
      relationshipsQuery: defaultRelationshipsQuery,
    };
    const targetA: QueryTargetLike = {
      tab: Asset,
      aggregation: 'max',
      refId: 'A',
      target: '',
      label: '{{description}}-{{externalId}}',
      assetQuery,
    };
    const targetB: QueryTargetLike = {
      ...targetA,
      refId: 'B',
      assetQuery: {
        ...assetQuery,
        includeSubTimeseries: false,
      },
    };
    const targetC: QueryTargetLike = {
      ...targetA,
      refId: 'C',
      assetQuery: {
        ...assetQuery,
        includeSubTimeseries: false,
        withRelationships: false,
      },
    };
    const tsResponseA = getItemsResponseObject([
      { id: 123, externalId: 'Timeseries123', description: 'test timeseries' },
    ]);
    beforeAll(async () => {
      jest.clearAllMocks();
      options.intervalMs = ms('6m');
      options.targets = [targetA, targetB, targetC];
      fetcher.fetch = jest
        .fn()
        .mockImplementationOnce(() => Promise.resolve(tsResponseA))
        .mockImplementation((x) => Promise.resolve(getDataqueryResponse(x.data, externalIdPrefix)));
      result = await lastValueFrom(ds.query(options));
    });
    it('should generate the correct queries', () => {
      expect(fetcher.fetch).toHaveBeenCalledTimes(4);
      for (let i = 0; i < (fetcher.fetch as Mock).mock.calls.length; i += 1) {
        expect((fetcher.fetch as Mock).mock.calls[i][0]).toMatchSnapshot();
      }
    });
  });

  describe('Given custom queries', () => {
    const fetcher = { fetch: jest.fn() };
    const { ds, templateSrv } = getDataSourceWithMocks(fetcher);
    let result;
    const targetB: QueryTargetLike = {
      aggregation: 'none',
      refId: 'B',
      target: 123,
      tab: Custom,
      expr: "ts{description!='test timeseriesC', metadata={key1='value1', key2!~'.*2'}, aggregate='discreteVariance', granularity='10d'}",
    };
    const targetD: QueryTargetLike = {
      ...cloneDeep(targetB),
      expr: 'ts{externalId="[[TimeseriesVariable]]"}',
      refId: 'D',
    };
    const targetI: QueryTargetLike = {
      ...cloneDeep(targetB),
      refId: 'I',
      expr: '',
    };
    const targetJ: QueryTargetLike = {
      ...cloneDeep(targetB),
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
    ]);

    beforeAll(async () => {
      jest.clearAllMocks();
      options.intervalMs = ms('1d');
      options.targets = [targetB, targetD, targetI, targetJ];
      const listMock = async () => {
        return cloneDeep(tsResponse);
      };
      const dataMock = async (x) => {
        return getDataqueryResponse(x.data, externalIdPrefix, 0);
      };
      fetcher.fetch = jest
        .fn()
        .mockImplementationOnce(listMock)
        .mockImplementationOnce(listMock)
        .mockImplementationOnce(listMock)
        .mockImplementation(dataMock);

        result = await lastValueFrom(ds.query(options));
    });
    afterAll(() => {
      (templateSrv.replace as Mock).mockClear();
    });

    it('should generate the correct filtered queries', () => {
      expect(fetcher.fetch).toBeCalledTimes(5);
      for (let i = 0; i < (fetcher.fetch as Mock).mock.calls.length; i += 1) {
        expect((fetcher.fetch as Mock).mock.calls[i][0]).toMatchSnapshot();
      }
    });

    it('should return correct datapoints and labels', () => {
      expect(result).toMatchSnapshot();
    });

    it('should display errors for malformed queries', () => {
      expect(appEvents.emit).toHaveBeenCalledTimes(1);
      expect((appEvents.emit as Mock).mock.calls[0][1].refId).toEqual('J');
    });
  });

  describe('Given custom queries with functions', () => {
    const fetcher = { fetch: jest.fn() };
    const ds = getMockedDataSource(fetcher);
    let result;
    const targetA: QueryTargetLike = {
      aggregation: 'none',
      refId: 'A',
      target: 123,
      tab: Custom,
      expr: 'ts{} + pi()',
      label: '{{description}} {{metadata.key1}}',
    };
    const targetD: QueryTargetLike = {
      ...cloneDeep(targetA),
      refId: 'D',
      expr: 'ts{} * ts{externalId="[[TimeseriesVariable]]", aggregate="average"} - ts{externalId="[[TimeseriesVariable]]", aggregate="average", granularity="10m"}',
      label: '',
    };

    const tsResponse = getItemsResponseObject([
      {
        externalId: 'Timeseries1',
        id: 1,
        description: 'test timeseriesA',
        metadata: { key1: 'value1', key2: 'value3' },
      },
      {
        externalId: 'Timeseries2',
        id: 2,
        description: 'test timeseriesB',
        metadata: { key1: 'value1', key2: 'value2' },
      },
      {
        externalId: 'Timeseries3',
        id: 3,
        description: 'test timeseriesC',
        metadata: { key1: 'value1' },
      },
    ]);

    beforeAll(async () => {
      jest.clearAllMocks();
      options.intervalMs = ms('2.5h');
      options.targets = [targetA, targetD];
      fetcher.fetch = jest.fn().mockImplementation(async (data: any) => {
        if (data.url.includes('/byids') || data.url.includes('timeseries/list')) {
          return cloneDeep(tsResponse);
        }
        if (data.url.includes('/synthetic/query')) {
          return getDataqueryResponse(data.data, externalIdPrefix, 0);
        }
        throw new Error('no mock');
      });
      result = await lastValueFrom(ds.query(options));
    });

    it('should generate the correct filtered queries', () => {
      expect(fetcher.fetch).toBeCalledTimes(5);
      for (let i = 0; i < (fetcher.fetch as Mock).mock.calls.length; i += 1) {
        expect((fetcher.fetch as Mock).mock.calls[i][0]).toMatchSnapshot();
      }
    });

    it('should return correct datapoints and labels', () => {
      expect(result).toMatchSnapshot();
    });
  });

  describe.skip('Given "Custom queries" with errors', () => {
    const fetcher = { fetch: jest.fn() };
    const ds = getMockedDataSource(fetcher);
    const targets: QueryTargetLike[] = [
      {
        refId: 'A',
        tab: Custom,
        expr: 'ts{name=""}',
      },
    ];
    const query = { ...options, targets };
    const emptyResult = { data: [] };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('400 error', async () => {
      fetcher.fetch = jest.fn().mockRejectedValueOnce(tsError);
      const result = await lastValueFrom(ds.query(query));
      expect(result).toEqual(emptyResult);
      expect(appEvents.emit).toHaveBeenCalledTimes(1);
      const emitted = (appEvents.emit as Mock).mock.calls[0][1];
      expect(emitted.error).toEqual('[400 ERROR] error message');
    });

    test('unknown error', async () => {
      fetcher.fetch = jest.fn().mockRejectedValueOnce({});
      const result = await lastValueFrom(ds.query(query));
      expect(result).toEqual(emptyResult);
      expect(appEvents.emit).toHaveBeenCalledTimes(1);
      const emitted = (appEvents.emit as Mock).mock.calls[0][1];
      expect(emitted.error).toEqual('Unknown error');
    });

    test('empty ts filter result', async () => {
      fetcher.fetch = jest
        .fn()
        .mockImplementationOnce(() => Promise.resolve(getItemsResponseObject([])));
      const result = await lastValueFrom(ds.query(query));
      expect(result).toEqual(emptyResult);
      expect(appEvents.emit).toHaveBeenCalledTimes(1);
      const emitted = (appEvents.emit as Mock).mock.calls[0][1];
      expect(emitted.error).toEqual(
        '[ERROR] No timeseries found for filter {"name":""} in expression ts{name=""}'
      );
    });
  });

  describe('filterQueryTargets', () => {
    const fetcher = { fetch: jest.fn() };
    const ds = getMockedDataSource(fetcher);
    const normalTargets = [
      {
        target: '',
        tab: Asset,
        assetQuery: {
          target: 'some id',
        },
      },
      {
        target: 123,
      },
      {
        ...defaultQuery,
        tab: Tab.Event,
        eventQuery: {
          expr: 'events{}',
          columns: [],
          activeAtTimeRange: false,
          advancedFilter: '',
        },
      },
    ] as CogniteQuery[];

    it('should return empty if empty', () => {
      expect(filterEmptyQueryTargets([])).toEqual([]);
    });

    it('should filter if target is empty', () => {
      expect(filterEmptyQueryTargets([null])).toEqual([]);
    });

    it('should filter if hide == true', () => {
      expect(filterEmptyQueryTargets([{ hide: true } as QueryTarget])).toEqual([]);
    });

    it('should filter out empty asset targets', () => {
      const targets = [
        {
          target: '',
          tab: Custom,
        },
        {
          target: '',
          tab: Asset,
          assetQuery: {
            target: '',
          },
        },
        ...normalTargets,
      ] as CogniteQuery[];
      expect(filterEmptyQueryTargets(targets)).toEqual(normalTargets);
    });

    it('should filter out empty timeseries targets', () => {
      const targets = [
        {
          target: '',
          tab: 'Timeseries',
        },
        {
          target: '',
        },
        ...normalTargets,
      ] as CogniteQuery[];
      expect(filterEmptyQueryTargets(targets)).toEqual(normalTargets);
    });

    it('should not filter valid targets', () => {
      expect(filterEmptyQueryTargets(normalTargets)).toEqual(normalTargets);
    });

    it('should filter out all empty (different types)', async () => {
      const emptyTimeseries: Partial<CogniteQuery> = {
        target: '',
        tab: Timeseries,
        assetQuery: {
          target: '',
          includeSubtrees: false,
          includeSubTimeseries: true,
          withRelationships: false,
        },
      };
      const emptyAsset: Partial<CogniteQuery> = {
        ...emptyTimeseries,
        target: '',
        tab: Asset,
      };
      const emptyCustom: Partial<CogniteQuery> = {
        ...emptyTimeseries,
        tab: Custom,
        target: undefined,
      };
      const emptyEvent: Partial<CogniteQuery> = {
        ...emptyTimeseries,
        tab: Tab.Event,
        eventQuery: {
          expr: '',
          activeAtTimeRange: false,
          columns: [''],
          advancedFilter: '',
        },
      };
      const result = await filterEmptyQueryTargets([
        emptyTimeseries,
        emptyAsset,
        emptyCustom,
        emptyEvent,
      ] as CogniteQuery[]);
      expect(result).toEqual([]);
    });
  });
  describe('replaceVariable', () => {
    const fetcher = { fetch: jest.fn() };
    const ds = getMockedDataSource(fetcher);
    const singleValueQuery = `events{assetIds=[$AssetVariable]}`;
    const multiValueQuery = `events{assetIds=[\${MultiValue:csv}]}`;
    const multiVariableQuery = `events{assetIds=[$MultiValue], type=$Type, subtype=$Type}`;

    it('should replace variables properly', () => {
      expect(ds.replaceVariable(singleValueQuery)).toEqual(`events{assetIds=[123]}`);
      expect(ds.replaceVariable(multiValueQuery)).toEqual(`events{assetIds=[123,456]}`);
      expect(ds.replaceVariable(multiVariableQuery)).toEqual(
        `events{assetIds=[123,456], type="type_or_subtype", subtype="type_or_subtype"}`
      );
    });
  });
});
describe('Given custom query with pure text label', () => {
  const fetcher = { fetch: jest.fn() };
  const ds = getMockedDataSource(fetcher);
  beforeAll(async () => {
    jest.clearAllMocks();
    fetcher.fetch = jest.fn().mockImplementation(async (x) => {
      return getDataqueryResponse(x.data, externalIdPrefix, 0);
    });
  });

  it('should return pure text label', async () => {
    const targetA: QueryTargetLike = {
      tab: Custom,
      expr: 'ts{id=1}',
      label: 'Pure text',
    };
    const resultObs = await ds.query({
      ...options,
      targets: [targetA],
    });
    const result = await lastValueFrom(resultObs);
    expect((result.data[0] as TimeSeries).target).toEqual('Pure text');
  });
});

describe('custom query granularity less then a second', () => {
  const fetcher = { fetch: jest.fn() };
  const ds = getMockedDataSource(fetcher);
  const targetA = {
    tab: Tab.Custom,
    expr: 'ts{id=1}',
    aggregation: 'average',
  } as any;
  beforeAll(async () => {
    jest.clearAllMocks();
    fetcher.fetch = jest.fn().mockResolvedValueOnce(tsResponseWithId(1));
  });

  it('defaults to one second', async () => {
    await ds.timeseriesDatasource.fetchTimeseriesForTargets([targetA], {
      ...options,
      intervalMs: 99,
    });
    expect(
      (fetcher.fetch as Mock).mock.calls[1][0].data.items[0].expression
    ).toMatch('granularity="1s"}');
  });
});
