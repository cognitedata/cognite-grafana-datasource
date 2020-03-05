import { parseQuery, formatQueryParse, parse } from '../query-parser';
import { QueryParserTypes } from '../query-parser/types';

describe('Query parser', () => {
  describe('Query parsing', () => {
    it('should parse string', () => {
      const assetsInput = `assets{rootIds={id=123}}`;
      const eventsInput = `events{description=~'some.*', assetIds=[123]}`;
      const { type: assetType, query: assetQuery } = parseQuery(assetsInput);
      const { type: eventsType, query: eventsQuery } = parseQuery(eventsInput);

      expect(assetType).toEqual(QueryParserTypes.assets);
      expect(assetQuery.length).toEqual(1);

      expect(eventsType).toEqual(QueryParserTypes.events);
      expect(eventsQuery.length).toEqual(2);
    });
    it('should throw error in case of empty query', () => {
      const input = ``;

      expect(() => parseQuery(input)).toThrowErrorMatchingSnapshot();
    });
    it('should fail if string with double quotes', () => {
      const input = `assets{name="name"}`;

      expect(() => parseQuery(input)).toThrowErrorMatchingSnapshot();
    });
    it('should throw error if wrong type provided', () => {
      const input = `asset{name='name'}`;

      expect(() => parseQuery(input)).toThrowErrorMatchingSnapshot();
    });
    it('should throw error if wrong filter provided', () => {
      const input = `assets{name~='name'}`;

      expect(() => parseQuery(input)).toThrowErrorMatchingSnapshot();
    });
  });

  describe('Formatting', () => {
    it('should return filters', () => {
      const parsed = {
        type: QueryParserTypes.events,
        query: [
          {
            assetIds: [123],
            metadata: {
              'some unique hash here': {
                key: 'key1',
                filter: '=~',
                value: 'test.*',
              },
              key2: 'test',
            },
          },
        ],
      };

      const {
        type,
        params: { metadata, assetIds },
        filters: [filter],
      } = formatQueryParse(parsed);

      expect(type).toEqual(QueryParserTypes.events);
      expect(metadata).toEqual({ key2: 'test' });
      expect(assetIds).toEqual([123]);
      expect(filter).toEqual({ path: 'metadata.key1', filter: '=~', value: 'test.*' });
    });
  });

  describe('Parser result', () => {
    it('should parse empty request', () => {
      const assets = `assets{}`;
      const events = `events{}`;

      const { type: assetsType, params: assetsParams, filters: assetFilters } = parse(assets);
      const { type: eventsType, params: eventsParams, filters: eventsFilters } = parse(events);

      expect(assetsType).toEqual(QueryParserTypes.assets);
      expect(assetsParams).toEqual({});
      expect(assetFilters).toEqual([]);

      expect(eventsType).toEqual(QueryParserTypes.events);
      expect(eventsParams).toEqual({});
      expect(eventsFilters).toEqual([]);
    });

    it('should parse filters and params', () => {
      const query = `assets{rootIds=[{id=123}], description!='non-description'}`;
      const { params, filters } = parse(query);

      expect(params).toEqual({ rootIds: [{ id: 123 }] });
      expect(filters).toEqual([
        {
          path: 'description',
          filter: '!=',
          value: 'non-description',
        },
      ]);
    });

    it('should parse inherited filters', () => {
      const query = `assets{metadata={key1='value1', key2!~'value2'}}`;
      const {
        params,
        filters: [filter],
      } = parse(query);

      expect(params).toEqual({ metadata: { key1: 'value1' } });
      expect(filter).toEqual({
        path: 'metadata.key2',
        filter: '!~',
        value: 'value2',
      });
    });

    it('should produce right number of filters', () => {
      const query = `assets{metadata={key1='value1', key2!~'value2', key2!='value', key2=~'value'}}`;

      const { filters } = parse(query);
      expect(filters.length).toEqual(3);
    });

    it('should remove empty params', () => {
      const query = `assets{name='name', metadata={key2!~'value2'}}`;
      const {
        params: { name, metadata },
        filters,
      } = parse(query);
      expect(name).toEqual('name');
      expect(filters.length).toEqual(1);
      expect(metadata).toBeFalsy();
    });

    it('should be space agnostic', () => {
      const query = ` assets{ name = 'name' , metadata = { key2 !~ 'value2'}  }  `;
      const {
        params: { name },
        filters: [filter],
      } = parse(query);

      expect(name).toEqual('name');
      expect(filter).toEqual({ path: 'metadata.key2', filter: '!~', value: 'value2' });
    });
  });
});
