import { cloneDeep } from 'lodash';
import { getMockedDataSource } from '../test_utils';
import { VariableQueryData } from '../types';
import { INSTANCE_ID_FIELD } from '../cdf/instanceRef';

jest.mock('@grafana/runtime');
type Mock = jest.Mock;
const fetcher = { fetch: jest.fn() };
const ds = getMockedDataSource(fetcher);

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

describe('Metrics Query', () => {
  beforeAll(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runAllTimers();
    jest.clearAllMocks();
  });
  describe('Given an empty metrics query', () => {
    const variableQuery: VariableQueryData = {
      query: '',
    };
    it('should return empty array', async () => {
      const result = await ds.metricFindQuery(variableQuery);

      expect(result).toEqual([]);
      expect(fetcher.fetch).not.toBeCalled();
    });
  });

  describe('Given a metrics query with no options', () => {
    let result;
    const variableQuery: VariableQueryData = {
      query: 'assets{}',
    };
    beforeAll(async () => {
      fetcher.fetch = jest
        .fn()
        .mockImplementation(() => Promise.resolve(assetsResponse));
      result = await ds.metricFindQuery(variableQuery);
    });

    afterAll(() => {
      jest.clearAllMocks();
    });

    it('should generate the correct request', () => {
      expect(fetcher.fetch).toBeCalledTimes(1);
      expect((fetcher.fetch as Mock).mock.calls[0][0]).toMatchSnapshot();
    });

    it('should return all assets', () => {
      expect(result.length).toEqual(assetsResponse.data.items.length);
    });
  });

  describe('Given a simple metrics query', () => {
    let result;
    const id = 123;
    const variableQuery: VariableQueryData = {
      query: `assets{id=${id}}`,
    };
    const response = cloneDeep(assetsResponse);
    response.data.items = assetsResponse.data.items.filter((item) => item.id === id);

    beforeAll(async () => {
      fetcher.fetch = jest.fn().mockImplementation(() => Promise.resolve(response));
      result = await ds.metricFindQuery(variableQuery);
    });

    it('should generate the correct request', () => {
      expect(fetcher.fetch).toBeCalledTimes(1);
      expect((fetcher.fetch as Mock).mock.calls[0][0]).toMatchSnapshot();
    });

    it('should return the correct assets', () => {
      const resultIds = result.map(({ value }) => value);

      expect(result.length).toEqual(1);
      expect(resultIds.includes(id)).toBeTruthy();
    });
  });

  describe('Given a metrics query with filters', () => {
    let result;
    const variableQuery: VariableQueryData = {
      query: "assets{description=~'test asset.*', metadata={key1!='value2', key1!~'.*3'}}",
    };

    beforeAll(async () => {
      fetcher.fetch = jest
        .fn()
        .mockImplementation(() => Promise.resolve(assetsResponse));
      result = await ds.metricFindQuery(variableQuery);
    });

    it('should generate the correct request', () => {
      expect(fetcher.fetch).toBeCalledTimes(1);
      expect((fetcher.fetch as Mock).mock.calls[0][0]).toMatchSnapshot();
    });

    it('should return the correct assets', () => {
      const resultIds = result.map(({ value }) => value);

      expect(result.length).toEqual(1);
      expect(resultIds.includes(123)).toBeTruthy();
    });
  });

  describe('Given a metrics query with unmatched filters', () => {
    let result;
    const variableQuery: VariableQueryData = {
      query: "assets{description=~'non-matched filter.*', metadata={key1!='value2'}}",
    };

    beforeAll(async () => {
      fetcher.fetch = jest
        .fn()
        .mockImplementation(() => Promise.resolve(assetsResponse));
      result = await ds.metricFindQuery(variableQuery);
    });

    it('should generate the correct request', () => {
      expect(fetcher.fetch).toBeCalledTimes(1);
      expect((fetcher.fetch as Mock).mock.calls[0][0]).toMatchSnapshot();
    });

    it('should return the correct assets', () => {
      expect(result.length).toEqual(0);
    });
  });

  describe('Given an incomplete metrics query', () => {
    const variableQuery: VariableQueryData = {
      query: 'asset',
    };
    it('should return an empty array', async () => {
      const result = await ds.metricFindQuery(variableQuery);
      expect(result).toEqual([]);
      expect(fetcher.fetch).not.toBeCalled();
    });
  });

  describe('Given an incorrect filter query', () => {
    it('should return an empty array if filter type is wrong', async () => {
      const variableQuery: VariableQueryData = {
        query: "assets{name~='foo'}",
      };
      const result = await ds.metricFindQuery(variableQuery);
      expect(result).toEqual([]);
      expect(fetcher.fetch).not.toBeCalled();
    });
    it('should throw an error if filter regexp is wrong', async () => {
      const variableQuery: VariableQueryData = {
        query: "assets{name=~'*.foo'}",
      };
      expect(ds.metricFindQuery(variableQuery)).rejects.toMatchSnapshot();
      expect(fetcher.fetch).toBeCalledTimes(1);
    });
  });

  describe('Given a nested variable query', () => {
    const variableQuery: VariableQueryData = {
      query: 'assets{parentIds=[$AssetVariable]}',
    };

    beforeAll(async () => {
      fetcher.fetch = jest
        .fn()
        .mockImplementation(() => Promise.resolve(assetsResponse));
      await ds.metricFindQuery(variableQuery);
    });

    it('should generate the correct request', () => {
      expect(fetcher.fetch).toBeCalledTimes(1);
      expect((fetcher.fetch as Mock).mock.calls[0][0]).toMatchSnapshot();
    });
  });

  describe('Given a GraphQL variable query with interpolation', () => {
    const variableQuery: VariableQueryData = {
      query: '',
      queryType: 'graphql',
      graphqlQuery: 'query MyQuery { listCogniteAsset(filter: {externalId: "$AssetVariable"}) { items { name externalId } } }',
      dataModel: {
        space: 'test-space',
        externalId: 'test-model',
        version: '1',
      },
      valueType: {
        value: 'externalId',
        label: 'External ID',
      },
    };

    const mockGraphqlResponse = {
      data: {
        listCogniteAsset: {
          items: [
            { name: 'Asset 1', externalId: 'asset-1' },
            { name: 'Asset 2', externalId: 'asset-2' },
          ],
        },
      },
    };

    beforeEach(() => {
      // Mock the connector's fetchQuery method for GraphQL queries
      ds.connector.fetchQuery = jest
        .fn()
        .mockImplementation(() => Promise.resolve(mockGraphqlResponse));
      
      // Also mock the regular fetch for other tests
      fetcher.fetch = jest
        .fn()
        .mockImplementation(() => Promise.resolve(mockGraphqlResponse));
    });

    it('should interpolate variables in GraphQL query', async () => {
      await ds.metricFindQuery(variableQuery);
      
      expect(ds.connector.fetchQuery).toBeCalledTimes(1);
      const call = (ds.connector.fetchQuery as Mock).mock.calls[0][0];
      const requestBody = JSON.parse(call.data);
      
      // The interpolated query should have the variable replaced with the actual value
      expect(requestBody.query).toContain('123'); // From the mock template service (AssetVariable.current.value)
      expect(requestBody.query).not.toContain('$AssetVariable');
    });

    it('should generate the correct GraphQL endpoint request', async () => {
      await ds.metricFindQuery(variableQuery);
      
      expect(ds.connector.fetchQuery).toBeCalledTimes(1);
      const call = (ds.connector.fetchQuery as Mock).mock.calls[0][0];
      expect(call.path).toBe('/userapis/spaces/test-space/datamodels/test-model/versions/1/graphql');
      expect(call.method).toBe('POST');
    });

    it('should return the correct values based on valueType', async () => {
      const result = await ds.metricFindQuery(variableQuery);
      
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        text: 'asset-1', // externalId used as text since it's the selected field
        value: 'asset-1', // externalId used as value
      });
      expect(result[1]).toEqual({
        text: 'asset-2',
        value: 'asset-2',
      });
    });
  });

  describe('Given a GraphQL variable query returning instance references', () => {
    const base: VariableQueryData = {
      query: '',
      queryType: 'graphql',
      graphqlQuery: 'query MyQuery { listCogniteAsset { items { space externalId name } } }',
      dataModel: { space: 'test-space', externalId: 'test-model', version: '1' },
      valueType: { value: INSTANCE_ID_FIELD, label: 'Instance ID' },
    };

    const respondWith = (items: any[]) => {
      ds.connector.fetchQuery = jest
        .fn()
        .mockImplementation(() =>
          Promise.resolve({ data: { listCogniteAsset: { items } } })
        );
    };

    it('emits an encoded reference from top-level identifiers', async () => {
      respondWith([
        { space: 'paper_mill', externalId: 'ASSET_PM_AREA', name: '60-PM - Paper Machine Area' },
        { space: 'paper_mill', externalId: 'ASSET_BL_AREA', name: '40-BL - Bleaching Area' },
      ]);
      const result = await ds.metricFindQuery(base);
      // Unset display field: the text is the value itself, so what the picker
      // shows is exactly what the variable emits.
      expect(result).toEqual([
        {
          text: '{"space":"paper_mill","externalId":"ASSET_PM_AREA"}',
          value: '{"space":"paper_mill","externalId":"ASSET_PM_AREA"}',
        },
        {
          text: '{"space":"paper_mill","externalId":"ASSET_BL_AREA"}',
          value: '{"space":"paper_mill","externalId":"ASSET_BL_AREA"}',
        },
      ]);
    });

    it('reads identifiers nested under a field', async () => {
      respondWith([{ name: 'Pump', instanceId: { space: 's', externalId: 'e' } }]);
      const result = await ds.metricFindQuery(base);
      expect(result).toEqual([
        { text: '{"space":"s","externalId":"e"}', value: '{"space":"s","externalId":"e"}' },
      ]);
    });

    it('shows the encoded reference even when the item has a name', async () => {
      // Readable text is opt-in via the display field; by default the picker
      // shows the emitted reference so the two never disagree.
      respondWith([{ space: 's', externalId: 'ASSET_1', name: 'Asset one' }]);
      const result = await ds.metricFindQuery(base);
      expect(result[0].text).toBe('{"space":"s","externalId":"ASSET_1"}');
    });

    it('skips items that carry no usable reference', async () => {
      respondWith([{ space: 's', externalId: 'ok' }, { name: 'no ids here' }]);
      const result = await ds.metricFindQuery(base);
      expect(result).toHaveLength(1);
      expect(result[0].value).toBe('{"space":"s","externalId":"ok"}');
    });

    it('never emits "[object Object]" for an object-valued field', async () => {
      // Regression: String(val) used to turn a reference into a poison string that
      // reached dashboards intact.
      respondWith([{ name: 'Pump', instanceId: { space: 's', externalId: 'e' } }]);
      const asObjectField = await ds.metricFindQuery({
        ...base,
        valueType: { value: 'instanceId', label: 'Instance Id' },
      });
      expect(asObjectField[0].value).toBe('{"space":"s","externalId":"e"}');
      expect(JSON.stringify(asObjectField)).not.toContain('[object Object]');
    });

    it('skips a list-valued field rather than emitting its first element', async () => {
      respondWith([
        { name: 'Pump', assets: [{ space: 's', externalId: 'a' }, { space: 's', externalId: 'b' }] },
        { name: 'Valve', assets: [] },
      ]);
      const result = await ds.metricFindQuery({
        ...base,
        valueType: { value: 'assets', label: 'assets' },
      });
      expect(result).toEqual([]);
    });

    it('skips a row where two nested objects could be the reference', async () => {
      respondWith([
        {
          name: 'Pump',
          asset: { space: 's', externalId: 'ASSET' },
          unit: { space: 's', externalId: 'UNIT' },
        },
      ]);
      expect(await ds.metricFindQuery(base)).toEqual([]);
    });

    it('resolves a dotted path to a scalar', async () => {
      respondWith([{ instanceId: { space: 'sp', externalId: 'e' } }]);
      const result = await ds.metricFindQuery({
        ...base,
        valueType: { value: 'instanceId.space', label: 'Space' },
      });
      expect(result[0].value).toBe('sp');
    });

    describe('with an explicit display field', () => {
      it('labels instance references with the chosen field', async () => {
        respondWith([
          {
            space: 'paper_mill',
            externalId: 'ASSET_PM_AREA',
            name: '60-PM',
            description: 'Paper Machine Area',
          },
        ]);
        const result = await ds.metricFindQuery({ ...base, displayField: 'description' });
        expect(result).toEqual([
          {
            text: 'Paper Machine Area',
            value: '{"space":"paper_mill","externalId":"ASSET_PM_AREA"}',
          },
        ]);
      });

      it('labels scalar values with the chosen field', async () => {
        respondWith([{ externalId: 'ASSET_1', name: 'Pump', description: 'Feed pump' }]);
        const result = await ds.metricFindQuery({
          ...base,
          valueType: { value: 'externalId', label: 'externalId' },
          displayField: 'description',
        });
        expect(result).toEqual([{ text: 'Feed pump', value: 'ASSET_1' }]);
      });

      it('resolves a dotted display path', async () => {
        respondWith([{ externalId: 'e', metadata: { owner: 'Ops team' } }]);
        const result = await ds.metricFindQuery({
          ...base,
          valueType: { value: 'externalId', label: 'externalId' },
          displayField: 'metadata.owner',
        });
        expect(result[0].text).toBe('Ops team');
      });

      it('falls back to the value when the display field is empty on a row', async () => {
        respondWith([{ space: 's', externalId: 'e', name: 'Pump' }]);
        const result = await ds.metricFindQuery({ ...base, displayField: 'description' });
        expect(result[0].text).toBe('{"space":"s","externalId":"e"}');
      });
    });

    it('surfaces a GraphQL error instead of resolving to nothing', async () => {
      ds.connector.fetchQuery = jest
        .fn()
        .mockImplementation(() =>
          Promise.resolve({ errors: [{ message: 'Cannot query field "nope"' }] })
        );
      await expect(ds.metricFindQuery(base)).rejects.toThrow('Cannot query field "nope"');
    });
  });
});
