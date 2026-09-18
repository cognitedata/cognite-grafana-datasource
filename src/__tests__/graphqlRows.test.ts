import { readGraphqlRows, unwrapGraphqlRows } from '../cdf/graphqlRows';
import { graphqlEndpointPath } from '../cdf/graphqlEndpoint';

describe('readGraphqlRows', () => {
  it('reads the items envelope', () => {
    const envelope = readGraphqlRows({ items: [{ name: 'a' }, { name: 'b' }] });
    expect(envelope?.kind).toBe('items');
    expect(envelope?.rows).toEqual([{ name: 'a' }, { name: 'b' }]);
  });

  it('reads the Relay edges envelope, keeping the raw edges for the table', () => {
    const edges = [{ node: { name: 'a' } }, { node: { name: 'b' } }, {}];
    const envelope = readGraphqlRows({ edges });
    expect(envelope?.kind).toBe('edges');
    expect(envelope?.raw).toBe(edges);
    expect(envelope?.rows).toEqual([{ name: 'a' }, { name: 'b' }]);
  });

  it('reads a bare list', () => {
    expect(readGraphqlRows([{ name: 'a' }])?.rows).toEqual([{ name: 'a' }]);
  });

  it('finds no rows in anything else', () => {
    expect(readGraphqlRows(null)).toBeNull();
    expect(readGraphqlRows('text')).toBeNull();
    expect(readGraphqlRows({ pageInfo: {} })).toBeNull();
  });
});

describe('unwrapGraphqlRows', () => {
  it('reads the first populated root field', () => {
    expect(
      unwrapGraphqlRows({ empty: null, listCogniteAsset: { items: [{ name: 'a' }] } })
    ).toEqual([{ name: 'a' }]);
  });

  it('yields nothing for an empty response', () => {
    expect(unwrapGraphqlRows(undefined)).toEqual([]);
    expect(unwrapGraphqlRows({})).toEqual([]);
    expect(unwrapGraphqlRows({ listCogniteAsset: null })).toEqual([]);
  });
});

describe('graphqlEndpointPath', () => {
  it('builds the endpoint of one data model version', () => {
    expect(graphqlEndpointPath({ space: 'cdf_cdm', externalId: 'CogniteCore', version: 'v1' })).toBe(
      '/userapis/spaces/cdf_cdm/datamodels/CogniteCore/versions/v1/graphql'
    );
  });

  it('encodes each segment', () => {
    expect(graphqlEndpointPath({ space: 'a b', externalId: 'x/y', version: '1' })).toBe(
      '/userapis/spaces/a%20b/datamodels/x%2Fy/versions/1/graphql'
    );
  });
});
