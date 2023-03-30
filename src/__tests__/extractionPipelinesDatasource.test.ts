/* eslint-disable no-nested-ternary */
import _ from 'lodash';
import { CogniteQuery, Tab } from '../types';
import { getMockedDataSource } from '../test_utils';
import { ExtractionPipelinesResponse } from '../cdf/types';
import { eventBusService } from '../appEventHandler';

type Mock = jest.Mock;
type QueryTargetLike = Partial<CogniteQuery>;

jest.mock('@grafana/data');

const appEvents = eventBusService;

const { ExtractionPipelines } = Tab;
const ds = getMockedDataSource();
const { backendSrv } = ds;
const options: any = {
  targets: [],
  range: {
    from: 1549336675000,
    to: 1549338475000,
  },
  interval: '30s',
  format: 'json',
  panelId: 1,
  dashboardId: 1,
};
const extpipeError = {
  status: 400,
  data: {
    error: {
      code: 400,
      message: 'extpipe error message',
    },
  },
};
const extpipeErrorMessage = {
  refId: 'A',
  error: '[400 ERROR] extpipe error message',
};
const noSelectedRunsError = {
  refId: 'A',
  error: '[ERROR] Please select value for extraxtion pipelines runs',
};
const columns = ['name', 'externalId', 'runId', 'status'];
const baseTarget: QueryTargetLike = {
  tab: ExtractionPipelines,
  refId: 'A',
};
const extpipesRes = {
  items: [
    { name: 'Test 1', externalId: 'test-1' },
    { name: 'Test 2', externalId: 'test-2' },
    { name: 'Test 3', externalId: 'test-3' },
  ],
};
const extpipesByIdRes = {
  items: [{ name: 'Test 1', externalId: 'test-1' }],
};
const extpipesRunsListRes1 = {
  items: [
    { id: 1, status: 'seen' },
    { id: 2, status: 'failure' },
    { id: 3, status: 'succsess' },
  ],
};
const extpipesRunsListRes2 = {
  items: [
    { id: 10, status: 'succsess' },
    { id: 20, status: 'seen' },
    { id: 30, status: 'failure' },
  ],
};
const extpipesRunsListRes3 = {
  items: [
    { id: 100, status: 'failure' },
    { id: 200, status: 'succsess' },
    { id: 300, status: 'seen' },
  ],
};
const extpipeRunsValue = ({ items }) => _.map(items[0], (value) => value);
const extpipeRunsValues = ({ items }) => _.map(items, (item) => _.map(item, (value) => value));
const extpipesWithRunsValues = ({ items }) =>
  _.map(items, (item: ExtractionPipelinesResponse, index: number) =>
    _.concat(
      [item.name, item.externalId],
      extpipeRunsValue(
        index === 1
          ? extpipesRunsListRes2
          : index === 2
          ? extpipesRunsListRes3
          : extpipesRunsListRes1
      )
    )
  );
describe('extraction pipelines', () => {
  let results;
  beforeEach(() => {
    jest.clearAllMocks();
  });
  describe('getExtractionPipelinesDropdowns', () => {
    beforeEach(async () => {
      backendSrv.datasourceRequest = jest
        .fn()
        .mockImplementationOnce(() => Promise.resolve({ data: extpipesRes }))
        .mockResolvedValueOnce((x) => Promise.resolve(x.data));
      results = await ds.extractionPipelinesDatasource.getExtractionPipelinesDropdowns('a');
    });
    it('it is called 1 times', () => {
      expect(backendSrv.datasourceRequest).toBeCalledTimes(1);
    });
    it('returns response data', () => {
      expect(results).toEqual(extpipesRes.items);
    });
  });
  describe('query', () => {
    let runsList;
    describe('on empty selected', () => {
      describe('with runs', () => {
        beforeEach(async () => {
          options.targets = [
            {
              ...baseTarget,
              extractionPipelinesQuery: {
                columns,
                selections: [],
                getRuns: true,
              },
            },
          ];
          results = await ds.query(options);
        });
        it('emits error', () => {
          expect(appEvents.emit).toHaveBeenCalledTimes(1);
        });
        it('error message', () => {
          expect((appEvents.emit as Mock).mock.calls[0][1]).toEqual(noSelectedRunsError);
        });
        it('empty tabledata', () => {
          expect(results.data[0].rows).toEqual([]);
        });
        it('column', () => {
          expect(results.data[0].columns).toEqual(columns.map((text) => ({ text })));
        });
      });
      describe('no runs', () => {
        beforeAll(async () => {
          options.targets = [
            {
              ...baseTarget,
              extractionPipelinesQuery: {
                columns,
                selections: [],
                getRuns: false,
              },
            },
          ];
          backendSrv.datasourceRequest = jest
            .fn()
            .mockImplementationOnce(() => Promise.resolve({ data: extpipesRes }))
            .mockImplementationOnce(() => Promise.resolve({ data: extpipesRunsListRes1 }))
            .mockImplementationOnce(() => Promise.resolve({ data: extpipesRunsListRes2 }))
            .mockImplementationOnce(() => Promise.resolve({ data: extpipesRunsListRes3 }))
            .mockImplementation((x) => Promise.resolve(x.data));
          results = await ds.query(options);
          runsList = extpipesWithRunsValues(extpipesRes);
        });
        it('dont emits error', () => {
          expect(appEvents.emit).toHaveBeenCalledTimes(0);
        });
        it('columns', () => {
          expect(results.data[0].columns).toEqual(columns.map((text) => ({ text })));
        });
        it('table data', () => {
          expect(results.data[0].rows).toEqual(runsList);
        });
        it('match snapshot', () => {
          expect(results.data).toMatchSnapshot();
        });
      });
    });
    describe('on selected', () => {
      const extpipeRunsColumns = ['id', 'status'];
      describe('no runs', () => {
        beforeEach(async () => {
          options.targets = [
            {
              ...baseTarget,
              extractionPipelinesQuery: {
                columns,
                selections: [{ value: 'test-1', label: 'Test 1' }],
                getRuns: false,
              },
            },
          ];
          backendSrv.datasourceRequest = jest
            .fn()
            .mockImplementationOnce(() => Promise.resolve({ data: extpipesByIdRes }))
            .mockImplementationOnce(() => Promise.resolve({ data: extpipesRunsListRes1 }))
            .mockImplementation((x) => Promise.resolve(x.data));
          results = await ds.query(options);
          runsList = extpipesWithRunsValues(extpipesByIdRes);
        });
        it('dont emits error', () => {
          expect(appEvents.emit).toHaveBeenCalledTimes(0);
        });
        it('table data', () => {
          expect(results.data[0].rows).toEqual(runsList);
        });
        it('columns', () => {
          expect(results.data[0].columns).toEqual(columns.map((text) => ({ text })));
        });
        it('match snapshot', () => {
          expect(results.data).toMatchSnapshot();
        });
      });
      describe('with runs', () => {
        const extpipesRunsListRes = [
          extpipesRunsListRes1,
          extpipesRunsListRes2,
          extpipesRunsListRes3,
        ];
        beforeEach(async () => {
          options.targets = [
            {
              ...baseTarget,
              extractionPipelinesQuery: {
                columns: extpipeRunsColumns,
                selections: [
                  { value: 'test-1', label: 'Test 1' },
                  { value: 'test-2', label: 'Test 2' },
                  { value: 'test-3', label: 'Test 3' },
                ],
                getRuns: true,
              },
            },
          ];
          backendSrv.datasourceRequest = jest
            .fn()
            .mockImplementationOnce(() => Promise.resolve({ data: extpipesRunsListRes1 }))
            .mockImplementationOnce(() => Promise.resolve({ data: extpipesRunsListRes2 }))
            .mockImplementationOnce(() => Promise.resolve({ data: extpipesRunsListRes3 }))
            .mockImplementation((x) => Promise.resolve(x.data));
          results = await ds.query(options);
        });
        it('dont emits error', () => {
          expect(appEvents.emit).toHaveBeenCalledTimes(0);
        });
        it(`has results data length of ${extpipesRunsListRes.length}`, () => {
          expect(results.data.length).toEqual(3);
        });
        it('has column, table-name', () => {
          for (let i = 0; i < results.data.length; i += 1) {
            runsList = extpipeRunsValues(extpipesRunsListRes[i]);
            expect(results.data[i].columns).toEqual(extpipeRunsColumns.map((text) => ({ text })));
            expect(results.data[i].rows).toEqual(runsList);
            expect(results.data[i].name).toEqual(`Test ${i + 1}`);
          }
        });
        it('match snapshot', () => {
          expect(results.data).toMatchSnapshot();
        });
      });
    });
  });
});
