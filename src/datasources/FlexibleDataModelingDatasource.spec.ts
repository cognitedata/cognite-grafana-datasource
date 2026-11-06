import { FlexibleDataModellingDatasource } from './FlexibleDataModellingDatasource';
import { Connector } from '../connector';
import { TimeseriesDatasource } from './TimeseriesDatasource';

describe('FlexibleDataModellingDatasource', () => {
  let datasource: FlexibleDataModellingDatasource;
  const connectorMock = {} as Connector;
  const timeseriesDatasourceMock = {} as TimeseriesDatasource;

  beforeEach(() => {
    datasource = new FlexibleDataModellingDatasource(connectorMock, timeseriesDatasourceMock);
  });

  describe('listFlexibleDataModelling', () => {
    it('should return data when successful', async () => {
      // Mock the fetchItems method of the connector to return a successful response
      // Uses REST API: GET /models/datamodels with includeGlobal=true
      connectorMock.fetchItems = jest.fn().mockResolvedValue([
        {
          space: 'test',
          externalId: 'test',
          version: '1',
          name: 'test',
          description: 'test',
        },
      ]);

      const result = await datasource.listFlexibleDataModelling('test-ref-id');

      expect(result.listGraphQlDmlVersions.items).toHaveLength(1);
      expect(result.listGraphQlDmlVersions.items[0].space).toBe('test');
      expect(result.listGraphQlDmlVersions.items[0].externalId).toBe('test');
    });

    it('rejects when an error occurs, so the editor can say why', async () => {
      connectorMock.fetchItems = jest.fn().mockRejectedValue(new Error('Test error'));

      await expect(datasource.listFlexibleDataModelling('test-ref-id')).rejects.toThrow(
        'Test error'
      );
    });
  });

  describe('listVersionByExternalIdAndSpace', () => {
    it('should return data when successful', async () => {
      // Mock the fetchQuery method of the connector to return a successful response
      connectorMock.fetchQuery = jest.fn().mockResolvedValue({
        data: {
          graphQlDmlVersionsById: {
            items: [
              {
                space: 'test',
                externalId: 'test',
                version: '1',
                name: 'test',
                description: 'test',
                graphQlDml: 'test',
                createdTime: 'test',
                lastUpdatedTime: 'test',
              },
            ],
          },
        },
      });

      const result = await datasource.listVersionByExternalIdAndSpace(
        'test-ref-id',
        'test',
        'test'
      );

      expect(result.graphQlDmlVersionsById.items).toHaveLength(1);
    });

    it('rejects when an error occurs, so the editor can say why', async () => {
      connectorMock.fetchQuery = jest.fn().mockRejectedValue(new Error('Test error'));

      await expect(
        datasource.listVersionByExternalIdAndSpace('test-ref-id', 'test', 'test')
      ).rejects.toThrow('Test error');
    });
  });

  describe('runIntrospectionQuery', () => {
    const model = { space: 'sp', externalId: 'model', version: '1' };

    it('returns the introspected schema', async () => {
      const schema = { __schema: { types: [] } };
      connectorMock.fetchQuery = jest.fn().mockResolvedValue({ data: schema });

      await expect(datasource.runIntrospectionQuery(model)).resolves.toEqual(schema);
    });

    it('rejects with the first GraphQL error of a 200 response', async () => {
      connectorMock.fetchQuery = jest
        .fn()
        .mockResolvedValue({ errors: [{ message: 'Not authorized' }, { message: 'Second' }] });

      await expect(datasource.runIntrospectionQuery(model)).rejects.toEqual({
        message: 'Not authorized',
      });
    });

    it('rejects when the request fails', async () => {
      connectorMock.fetchQuery = jest.fn().mockRejectedValue(new Error('Test error'));

      await expect(datasource.runIntrospectionQuery(model)).rejects.toThrow('Test error');
    });
  });
});
