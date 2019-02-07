// import _ from 'lodash';
// import q from 'q';

// jest.mock('app/core/utils/datemath');

// import CogniteDatasource, { QueryOptions, QueryTarget, Tab } from '../datasource';

// // const DEFAULT_TEMPLATE_SRV_MOCK = {
// //   getAdhocFilters: () => [],
// //   replace: a => a,
// // };

// describe('CogniteDatasource', () => {
//   const ctx: any = {};
//   const instanceSettings = {
//     id: 1,
//     name: 'Cognite Test Data',
//     type: 'cognitedata-platform-datasource',
//     url: '/api/datasources/proxy/6',
//     jsonData: {
//       cogniteProject: 'TestProject',
//     },
//   };

//   ctx.backendSrvMock = {
//     datasourceRequest: jest.fn(),
//   } as any;
//   ctx.templateSrvMock = {
//     getAdhocFilters: () => [],
//     replace: jest.fn(str => str),
//   };

//   beforeEach(() => {
//     ctx.ds = new CogniteDatasource(instanceSettings, q, ctx.backendSrvMock, ctx.templateSrvMock);
//     ctx.options = {
//       targets: [],
//       range: {
//         from: '1549336675000',
//         to: '1549338475000',
//       },
//       interval: '30s',
//       intervalMs: 30000,
//       maxDataPoints: 760,
//       format: 'json',
//     };
//   });

//   describe('Datasource Query', () => {
//     it('should return empty data given no targets', async () => {
//       const result = await ctx.ds.query(ctx.options);
//       expect(ctx.backendSrvMock.datasourceRequest.mock.calls.length).toBe(0);
//       expect(result).toEqual({ data: [] });
//     });

//     it('should return empty data given empty targets', async () => {
//       const emptyTimeseries: QueryTarget = {
//         refId: 'A',
//         target: 'Start typing tag id here',
//         aggregation: 'average',
//         granularity: '',
//         label: '',
//         tab: Tab.Timeseries,
//         expr: '',
//         assetQuery: {
//           target: '',
//           timeseries: [],
//           includeSubtrees: false,
//           func: '',
//         },
//         error: undefined,
//         hide: undefined,
//       };
//       const emptyAsset: QueryTarget = { ...emptyTimeseries };
//       emptyAsset.refId = 'B';
//       emptyAsset.target = '';
//       emptyAsset.tab = Tab.Asset;
//       const emptyCustom: QueryTarget = { ...emptyTimeseries };
//       emptyCustom.refId = 'C';
//       emptyCustom.tab = Tab.Custom;
//       emptyCustom.target = undefined;
//       ctx.options.targets = [emptyTimeseries, emptyAsset, emptyCustom];

//       const result = await ctx.ds.query(ctx.options);
//       expect(ctx.backendSrvMock.datasourceRequest.mock.calls.length).toBe(0);
//       expect(result).toEqual({ data: [] });
//     });

//     it('should return data given an older query target format', async () => {
//       const oldTarget: QueryTarget = {
//         aggregation: 'average',
//         refId: 'A',
//         target: 'Timeseries123',
//         granularity: undefined,
//         label: undefined,
//         tab: undefined,
//         error: undefined,
//         hide: undefined,
//         assetQuery: undefined,
//         expr: undefined,
//       };
//       ctx.options.targets = [oldTarget];
//       const response = {
//         data: {
//           data: {
//             items: [
//               {
//                 name: 'Timeseries123',
//                 datapoints: [
//                   { timestamp: 1549336675000, average: 1 },
//                   { timestamp: 1549337275000, average: 2 },
//                   { timestamp: 1549337875000, average: 0 },
//                   { timestamp: 1549338475000, average: 1 },
//                 ],
//               },
//             ],
//           },
//         },
//         config: {
//           data: {
//             aggregates: 'average',
//           },
//         },
//       };

//       ctx.ds.backendSrv.datasourceRequest = jest.fn(() => Promise.resolve(response));
//       const result = await ctx.ds.query(ctx.options);
//       expect(ctx.backendSrvMock.datasourceRequest.mock.calls.length).toBe(1);
//       expect(ctx.backendSrvMock.datasourceRequest.mock.calls[0][0]).toMatchSnapshot();
//       expect(result).toMatchSnapshot();
//     });

//     it('should return ', () => {

//     });
//   });

//   describe('Annotations Query', () => {});

//   describe('Dropdown Options Query', () => {});

//   describe('Metrics Query', () => {});

//   // labels correct for different situations, plus variables
//   // errors
//   // ignore empty ones
//   // limits are set correctly
//   // functions are correctly replaced with the right ids
//   //  backwards compat stuff
//   //

//   test('123', () => {
//     expect(true).toBe(true);
//   });
// });
