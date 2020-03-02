import { cloneDeep } from 'lodash';
import { getMockedDataSource } from './utils';
import { VariableQueryData } from '../types';

jest.mock('../cache');

const { ds, backendSrvMock } = getMockedDataSource();

const assetsResponse = {
  data: {
    items: [
      { id: 123, name: 'asset 1', description: 'test asset 1', metadata: { key1: 'value1' } },
      { id: 456, name: 'asset 2', description: 'test asset 2', metadata: { key1: 'value2' } },
      { id: 789, name: 'asset 3', description: 'test asset 3', metadata: { key1: 'value3' } },
      { id: 999, name: 'foo', description: 'bar', metadata: { key1: 'value1' } },
    ],
  },
};

// describe('Metrics Query', () => {
//   describe('Given an empty metrics query', () => {
//     const variableQuery: VariableQueryData = {
//       query: '',
//     };
//     it('should throw a parse error', () => {
//       expect(ds.metricFindQuery(variableQuery)).rejects.toThrowErrorMatchingInlineSnapshot(
//         `"ERROR: Unable to parse expression"`
//       );
//       expect(backendSrvMock.datasourceRequest).not.toBeCalled();
//     });
//   });
//
//   describe('Given a metrics query with no options', () => {
//     let result;
//     const variableQuery: VariableQueryData = {
//       query: 'asset{}',
//     };
//     beforeAll(async () => {
//       backendSrvMock.datasourceRequest = jest
//         .fn()
//         .mockImplementation(() => Promise.resolve(assetsResponse));
//       result = await ds.metricFindQuery(variableQuery);
//     });
//
//     it('should generate the correct request', () => {
//       expect(backendSrvMock.datasourceRequest).toBeCalledTimes(1);
//       expect(backendSrvMock.datasourceRequest.mock.calls[0][0]).toMatchSnapshot();
//     });
//
//     it('should return all assets', () => {
//       expect(result).toMatchSnapshot();
//     });
//   });
//
//   describe('Given a simple metrics query', () => {
//     let result;
//     const variableQuery: VariableQueryData = {
//       query: 'asset{name=asset}',
//     };
//     const response = cloneDeep(assetsResponse);
//     response.data.items = assetsResponse.data.items.filter(item => item.name.startsWith('asset'));
//
//     beforeAll(async () => {
//       backendSrvMock.datasourceRequest = jest
//         .fn()
//         .mockImplementation(() => Promise.resolve(response));
//       result = await ds.metricFindQuery(variableQuery);
//     });
//
//     it('should generate the correct request', () => {
//       expect(backendSrvMock.datasourceRequest).toBeCalledTimes(1);
//       expect(backendSrvMock.datasourceRequest.mock.calls[0][0]).toMatchSnapshot();
//     });
//
//     it('should return the correct assets', () => {
//       expect(result).toMatchSnapshot();
//     });
//   });
//
//   describe('Given a metrics query with filters', () => {
//     let result;
//     const variableQuery: VariableQueryData = {
//       query: 'asset{}',
//     };
//     // filter: 'filter{description=~ "test asset.*", metadata.key1 != value2}',
//
//     beforeAll(async () => {
//       backendSrvMock.datasourceRequest = jest
//         .fn()
//         .mockImplementation(() => Promise.resolve(assetsResponse));
//       result = await ds.metricFindQuery(variableQuery);
//     });
//
//     it('should generate the correct request', () => {
//       expect(backendSrvMock.datasourceRequest).toBeCalledTimes(1);
//       expect(backendSrvMock.datasourceRequest.mock.calls[0][0]).toMatchSnapshot();
//     });
//
//     it('should return the correct assets', () => {
//       expect(result).toMatchSnapshot();
//     });
//   });
//
//   describe('Given an incomplete metrics query', () => {
//     const variableQuery: VariableQueryData = {
//       query: 'asset{',
//     };
//     it('should throw a parse error', () => {
//       backendSrvMock.datasourceRequest.mockReset();
//       expect(ds.metricFindQuery(variableQuery)).rejects.toThrowErrorMatchingInlineSnapshot(
//         `"ERROR: Unable to parse expression asset{"`
//       );
//       expect(backendSrvMock.datasourceRequest).not.toBeCalled();
//     });
//   });
//
//   describe('Given an incorrect metrics query', () => {
//     const variableQuery: VariableQueryData = {
//       query: 'asset{name=~asset.*}',
//     };
//     it('should throw a parse error', () => {
//       expect(ds.metricFindQuery(variableQuery)).rejects.toThrowErrorMatchingInlineSnapshot(
//         `"ERROR: Unable to parse 'name=~asset.*'. Only strict equality (=) is allowed."`
//       );
//       expect(backendSrvMock.datasourceRequest).not.toBeCalled();
//     });
//   });
//
//   describe('Given an incorrect metrics query', () => {
//     const variableQuery: VariableQueryData = {
//       query: 'asset{name="asset}',
//     };
//     it('should throw a parse error', () => {
//       expect(ds.metricFindQuery(variableQuery)).rejects.toThrowErrorMatchingInlineSnapshot(
//         `"ERROR: Could not find closing ' \\" ' while parsing 'name=\\"asset'."`
//       );
//       expect(backendSrvMock.datasourceRequest).not.toBeCalled();
//     });
//   });
//
//   describe('Given an incorrect filter query', () => {
//     const variableQuery: VariableQueryData = {
//       query: 'asset{name=foo}',
//     };
//     it('should throw a filter error', () => {
//       expect(ds.metricFindQuery(variableQuery)).rejects.toThrowErrorMatchingInlineSnapshot(
//         `"ERROR: Unable to parse expression filter{"`
//       );
//       expect(backendSrvMock.datasourceRequest).not.toBeCalled();
//     });
//   });
//
//   describe('Given an incorrect filter query', () => {
//     const variableQuery: VariableQueryData = {
//       query: 'asset{name=foo}',
//     };
//     it('should throw a filter error', () => {
//       expect(ds.metricFindQuery(variableQuery)).rejects.toThrowErrorMatchingInlineSnapshot(
//         `"ERROR: Could not parse: 'foo'. Missing a comparator (=,!=,=~,!~)."`
//       );
//       expect(backendSrvMock.datasourceRequest).not.toBeCalled();
//     });
//   });
// });
