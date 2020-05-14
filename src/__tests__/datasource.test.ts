import { failedResponseEvent } from '../constants';

jest.mock('grafana/app/core/utils/datemath');
jest.mock('grafana/app/core/core');

import { cloneDeep } from 'lodash';
import { appEvents } from 'grafana/app/core/core';
import { getMockedDataSource, getDataqueryResponse, getItemsResponseObject } from './utils';
import { Tab, InputQueryTarget, QueryTarget } from '../types';
import ms from 'ms';
import { filterEmptyQueryTargets } from '../datasource';
import Mock = jest.Mock;

type QueryTargetLike = Partial<InputQueryTarget>;

const { ds, backendSrvMock, templateSrvMock } = getMockedDataSource();
const { Asset, Custom, Timeseries } = Tab;

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
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runAllTimers();
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
    const tsTargetA: QueryTargetLike = {
      aggregation: 'none',
      refId: 'A',
      target: 1,
      tab: Tab.Timeseries,
    };
    const tsTargetB: QueryTargetLike = {
      ...tsTargetA,
      target: 2,
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

    it('should return an empty array', () => {
      expect(result).toEqual({ data: [] });
    });
    it('should display errors for malformed queries', () => {
      expect(appEvents.emit).toHaveBeenCalledTimes(2);
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

  describe('Given "Select Timeseries from Asset" queries', () => {
    let result;
    const assetQuery = {
      target: '456',
      timeseries: [],
      includeSubtrees: false,
    };
    const targetA: QueryTargetLike = {
      assetQuery,
      aggregation: 'none',
      refId: 'A',
      tab: Tab.Asset,
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
    const targetError1: QueryTargetLike = {
      ...cloneDeep(targetA),
      refId: 'E',
      assetQuery: {
        ...assetQuery,
        target: '1',
      },
    };
    const targetError2: QueryTargetLike = {
      ...cloneDeep(targetA),
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
      options.targets = [targetA, targetC, targetD, targetError1, targetError2];
      backendSrvMock.datasourceRequest = jest
        .fn()
        .mockImplementationOnce(() => Promise.resolve(tsResponseA))
        .mockImplementationOnce(() => Promise.resolve(tsResponseC))
        .mockImplementationOnce(() => Promise.resolve(tsResponseA))
        .mockRejectedValueOnce(tsError)
        .mockRejectedValueOnce({})
        .mockImplementation(x => Promise.resolve(getDataqueryResponse(x.data, externalIdPrefix)));
      result = await ds.query(options);
    });

    it('should generate the correct queries', () => {
      expect(backendSrvMock.datasourceRequest).toHaveBeenCalledTimes(8);
      for (let i = 0; i < backendSrvMock.datasourceRequest.mock.calls.length; ++i) {
        expect(backendSrvMock.datasourceRequest.mock.calls[i][0]).toMatchSnapshot();
      }
    });

    it('should replace filter assetQuery [[variable]] with its value', () => {
      expect(backendSrvMock.datasourceRequest.mock.calls[2][0].data.filter.assetIds[0]).toEqual(
        '123'
      );
    });

    it('should return correct datapoints and labels', () => {
      expect(result).toMatchSnapshot();
    });

    it('should display errors for malformed queries', () => {
      expect(appEvents.emit).toHaveBeenCalledWith(failedResponseEvent, {
        refId: 'E',
        error: '[400 ERROR] error message',
      });
      expect(appEvents.emit).toHaveBeenCalledWith(failedResponseEvent, {
        refId: 'F',
        error: 'Unknown error',
      });
    });
  });

  describe('Given custom queries', () => {
    let result;
    const targetA: QueryTargetLike = {
      aggregation: 'none',
      refId: 'A',
      target: 123,
      tab: Tab.Custom,
      expr: 'ts{}',
    };
    const targetB: QueryTargetLike = {
      ...cloneDeep(targetA),
      expr:
        "ts{description!='test timeseriesC', metadata={key1='value1', key2!~'.*2'}, aggregate='discreteVariance', granularity='10d'}",
      refId: 'B',
    };
    const targetD: QueryTargetLike = {
      ...cloneDeep(targetA),
      expr: 'ts{externalId="[[TimeseriesVariable]]"}',
      refId: 'D',
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
    ]);

    beforeAll(async () => {
      jest.clearAllMocks();
      options.intervalMs = ms('1d');
      options.targets = [targetA, targetB, targetD, targetI, targetJ];
      const listMock = async () => {
        return cloneDeep(tsResponse);
      };
      const dataMock = async x => {
        return getDataqueryResponse(x.data, externalIdPrefix, 0);
      };
      backendSrvMock.datasourceRequest = jest
        .fn()
        .mockImplementationOnce(listMock)
        .mockImplementationOnce(listMock)
        .mockImplementationOnce(listMock)
        .mockImplementationOnce(listMock)
        .mockImplementationOnce(listMock)
        .mockImplementation(dataMock);

      result = await ds.query(options);
    });
    afterAll(() => {
      templateSrvMock.replace.mockClear();
    });

    it('should generate the correct filtered queries', () => {
      expect(backendSrvMock.datasourceRequest).toBeCalledTimes(8);
      for (let i = 0; i < backendSrvMock.datasourceRequest.mock.calls.length; ++i) {
        expect(backendSrvMock.datasourceRequest.mock.calls[i][0]).toMatchSnapshot();
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
    let result;
    const targetA: QueryTargetLike = {
      aggregation: 'none',
      refId: 'A',
      target: 123,
      tab: Tab.Custom,
      expr: 'ts{} + pi()',
      label: '{{description}} {{metadata.key1}}',
    };
    const targetD: QueryTargetLike = {
      ...cloneDeep(targetA),
      refId: 'D',
      expr:
        'ts{} * ts{externalId="[[TimeseriesVariable]]", aggregate="average"} - ts{externalId="[[TimeseriesVariable]]", aggregate="average", granularity="10m"}',
    };
    const targetH: QueryTargetLike = {
      ...cloneDeep(targetA),
      refId: 'H',
      expr:
        'sum(ts{aggregate="average"}) + sum(ts{aggregate="average", granularity="1h"}) * max(ts{aggregate="count"})/min(ts{externalId="Timeseries1"}) - avg(ts{aggregate="average"}) - 3*ts{}',
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
      options.targets = [targetA, targetD, targetH];
      backendSrvMock.datasourceRequest = jest.fn().mockImplementation(async (data: any) => {
        if (data.url.includes('/byids') || data.url.includes('timeseries/list')) {
          return cloneDeep(tsResponse);
        }
        if (data.url.includes('/synthetic/query')) {
          return getDataqueryResponse(data.data, externalIdPrefix, 0);
        }
        throw new Error('no mock');
      });
      result = await ds.query(options);
    });

    it('should generate the correct filtered queries', () => {
      expect(backendSrvMock.datasourceRequest).toBeCalledTimes(7);
      for (let i = 0; i < backendSrvMock.datasourceRequest.mock.calls.length; ++i) {
        expect(backendSrvMock.datasourceRequest.mock.calls[i][0]).toMatchSnapshot();
      }
    });

    it('should return correct datapoints and labels', () => {
      expect(result).toMatchSnapshot();
    });
  });
  describe('Given multiple "Select Timeseries from Asset" queries in a row', () => {
    const results = [];
    const targetA: QueryTargetLike = {
      aggregation: 'none',
      refId: 'A',
      tab: Asset,
      assetQuery: {
        target: '123',
        timeseries: [],
        includeSubtrees: false,
      },
    };

    const tsResponseA = getItemsResponseObject([
      { id: 123, externalId: 'Timeseries123', description: 'test timeseries' },
    ]);

    beforeAll(async () => {
      options.intervalMs = ms('6m');
      options.targets = [targetA];
      backendSrvMock.datasourceRequest = jest
        .fn()
        .mockImplementationOnce(() => Promise.resolve(tsResponseA))
        .mockImplementation(x => Promise.resolve(getDataqueryResponse(x.data, externalIdPrefix)));
      await ds.query(options);
      await ds.query(options);
      await ds.query(options);
    });

    it('should generate the correct queries and not requery for asset timeseries', () => {
      expect(backendSrvMock.datasourceRequest).toBeCalledTimes(2);
      for (let i = 0; i < backendSrvMock.datasourceRequest.mock.calls.length; ++i) {
        expect(backendSrvMock.datasourceRequest.mock.calls[i][0]).toMatchSnapshot();
      }
    });
  });
  describe('filterQueryTargets', () => {
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
    ] as InputQueryTarget[];

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
      ] as InputQueryTarget[];
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
      ] as InputQueryTarget[];
      expect(filterEmptyQueryTargets(targets)).toEqual(normalTargets);
    });

    it('should not filter valid targets', () => {
      expect(filterEmptyQueryTargets(normalTargets)).toEqual(normalTargets);
    });

    it('should filter out all empty (different types)', async () => {
      const emptyTimeseries: Partial<InputQueryTarget> = {
        target: '',
        tab: Timeseries,
        assetQuery: {
          target: '',
          timeseries: [],
          includeSubtrees: false,
          func: '',
        },
      };
      const emptyAsset: Partial<InputQueryTarget> = {
        ...emptyTimeseries,
        target: '',
        tab: Asset,
      };
      const emptyCustom: Partial<InputQueryTarget> = {
        ...emptyTimeseries,
        tab: Custom,
        target: undefined,
      };
      const result = await filterEmptyQueryTargets([
        emptyTimeseries,
        emptyAsset,
        emptyCustom,
      ] as InputQueryTarget[]);
      expect(result).toEqual([]);
    });
  });
  describe('replaceVariable', () => {
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
