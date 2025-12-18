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

    it('should return an empty list when an error occurs', async () => {
      // Mock the fetchItems method of the connector to throw an error
      connectorMock.fetchItems = jest.fn().mockRejectedValue(new Error('Test error'));

      const result = await datasource.listFlexibleDataModelling('test-ref-id');

      expect(result.listGraphQlDmlVersions.items).toHaveLength(0);
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

    it('should return an empty list when an error occurs', async () => {
      // Mock the fetchQuery method of the connector to throw an error
      connectorMock.fetchQuery = jest.fn().mockRejectedValue(new Error('Test error'));

      const result = await datasource.listVersionByExternalIdAndSpace(
        'test-ref-id',
        'test',
        'test'
      );

      expect(result.graphQlDmlVersionsById.items).toHaveLength(0);
    });
  });
});
