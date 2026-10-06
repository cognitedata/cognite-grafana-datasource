import { extractFieldNamesFromQuery, leafFieldNames } from '../components/graphql/graphqlFields';

describe('extractFieldNamesFromQuery', () => {
  it('flattens the result envelope away', () => {
    const fields = extractFieldNamesFromQuery(`query MyQuery {
      listCogniteAsset {
        items {
          name
          externalId
        }
      }
    }`, 'test');
    expect(fields).toEqual(['name', 'externalId']);
  });

  it('offers a nested object both whole and as dotted paths', () => {
    const fields = extractFieldNamesFromQuery(`query MyQuery {
      listCogniteAsset {
        items {
          instanceId {
            space
            externalId
          }
          name
        }
      }
    }`, 'test');
    expect(fields).toEqual(['instanceId', 'instanceId.space', 'instanceId.externalId', 'name']);
  });

  it('offers no path into a nested connection, whose rows are many', () => {
    // `timeSeries.name` would resolve to nothing: the relation holds a list of
    // rows, not one value. The row's own fields are still offered.
    const fields = extractFieldNamesFromQuery(`query MyQuery {
      listCogniteActivity {
        items {
          name
          timeSeries {
            items {
              space
              externalId
              name
            }
          }
        }
      }
    }`, 'test');
    expect(fields).toEqual(['name']);
  });

  it('unwraps Relay edges/node envelopes', () => {
    const fields = extractFieldNamesFromQuery(`query MyQuery {
      listCogniteAsset {
        edges {
          node {
            name
          }
        }
      }
    }`, 'test');
    expect(fields).toEqual(['name']);
  });

  it('skips introspection fields and de-duplicates', () => {
    const fields = extractFieldNamesFromQuery(`query MyQuery {
      listCogniteAsset {
        items {
          __typename
          name
          name
        }
      }
    }`, 'test');
    expect(fields).toEqual(['name']);
  });

  it('skips pagination metadata, which describes the page and not a row', () => {
    // hasNextPage/endCursor used to be promoted as if they were row fields, and
    // picking one resolved to nothing at run time.
    const fields = extractFieldNamesFromQuery(
      `query MyQuery {
        listCogniteAsset {
          items {
            name
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }`,
      'test'
    );
    expect(fields).toEqual(['name']);
  });

  it('offers an aliased field by its alias, which is how the response is keyed', () => {
    const fields = extractFieldNamesFromQuery(
      `query MyQuery {
        listCogniteAsset {
          items {
            label: name
            ref: instanceId { space externalId }
          }
        }
      }`,
      'test'
    );
    expect(fields).toEqual(['label', 'ref', 'ref.space', 'ref.externalId']);
  });

  it('reads only the first root field, which is the one execution unwraps', () => {
    const fields = extractFieldNamesFromQuery(
      `query MyQuery {
        listCogniteAsset {
          items {
            name
          }
        }
        listCogniteActivity {
          items {
            title
          }
        }
      }`,
      'test'
    );
    expect(fields).toEqual(['name']);
  });

  it('returns nothing for an unparseable query instead of throwing', () => {
    expect(extractFieldNamesFromQuery('query MyQuery { listCogniteAsset {', 'test')).toEqual([]);
    expect(extractFieldNamesFromQuery('', 'test')).toEqual([]);
  });
});

describe('leafFieldNames', () => {
  it('drops a path that has children, keeping the children', () => {
    expect(leafFieldNames(['instanceId', 'instanceId.space', 'name'])).toEqual([
      'instanceId.space',
      'name',
    ]);
  });
});
