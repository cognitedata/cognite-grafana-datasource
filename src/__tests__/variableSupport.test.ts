import { lastValueFrom } from 'rxjs';
import { DataQueryRequest } from '@grafana/data';
import { CogniteVariableSupport } from '../variableSupport';

const makeRequest = (targets: any[]) => ({ targets } as DataQueryRequest<any>);

describe('CogniteVariableSupport', () => {
  const results = [
    { text: 'Asset one', value: 'asset_1' },
    { text: 'Asset two', value: 'asset_2' },
  ];

  const makeSupport = (metricFindQuery = jest.fn().mockResolvedValue(results)) => {
    const datasource = { metricFindQuery } as any;
    return { support: new CogniteVariableSupport(datasource), metricFindQuery };
  };

  it('passes an object query through untouched', async () => {
    const { support, metricFindQuery } = makeSupport();
    const target = {
      query: '',
      queryType: 'graphql',
      graphqlQuery: 'query MyQuery { listCogniteAsset { items { name } } }',
      dataModel: { space: 'sp', externalId: 'model', version: '1' },
    };

    await lastValueFrom(support.query(makeRequest([target])));

    expect(metricFindQuery).toHaveBeenCalledWith(expect.objectContaining(target));
  });

  it('lifts a legacy string query into the asset-centric shape', async () => {
    const { support, metricFindQuery } = makeSupport();

    await lastValueFrom(support.query(makeRequest(['assets{name="x"}'])));

    expect(metricFindQuery).toHaveBeenCalledWith({ query: 'assets{name="x"}' });
  });

  it('tolerates a request with no target', async () => {
    const { support, metricFindQuery } = makeSupport();

    await lastValueFrom(support.query(makeRequest([])));

    expect(metricFindQuery).toHaveBeenCalledWith({ query: '' });
  });

  it('returns the rows Grafana turns into variable options', async () => {
    const { support } = makeSupport();

    const response = await lastValueFrom(support.query(makeRequest([{ query: '' }])));

    expect(response.data).toEqual(results);
  });

  it('propagates query failures instead of resolving to nothing', async () => {
    const { support } = makeSupport(
      jest.fn().mockRejectedValue(new Error('Cannot query field "nope"'))
    );

    await expect(
      lastValueFrom(support.query(makeRequest([{ query: '' }])))
    ).rejects.toThrow('Cannot query field "nope"');
  });

  it('survives being called unbound, as Grafana does', async () => {
    const { support } = makeSupport();
    const { query } = support;

    const response = await lastValueFrom(query(makeRequest([{ query: '' }])));

    expect(response.data).toEqual(results);
  });
});
