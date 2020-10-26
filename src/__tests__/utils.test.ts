import { applyFilters, flatten, isRFC3339_ISO6801 } from '../utils';
import { FilterType, ParsedFilter } from '../parser/types';
import { isArray } from 'lodash';

const { NotEquals, RegexNotEquals, RegexEquals } = FilterType;

describe('Utils', () => {
  describe('Filtering', () => {
    const assets = [
      { id: 123, name: 'asset 1', description: 'test asset 1', metadata: { key1: 'value1' } },
      { id: 456, name: 'asset 2', description: 'test asset 2', metadata: { key1: 'value2' } },
      {
        id: 789,
        name: 'asset 3',
        description: 'test asset 3',
        metadata: { key1: 'value3', key2: 'value2' },
        flag: true,
      },
      { id: 999, name: 'foo', description: 'bar', metadata: { key1: 'value1' }, flag: false },
    ];
    const rootFilter = { path: 'name', filter: NotEquals, value: 'foo' } as ParsedFilter;
    const idFilter = { path: 'id', filter: NotEquals, value: 123 } as ParsedFilter;
    const boolFilter = { path: 'flag', filter: NotEquals, value: true } as ParsedFilter;
    const notEndWith = {
      path: 'metadata.key1',
      filter: RegexNotEquals,
      value: '.*1',
    } as ParsedFilter;
    const caseSensitive = {
      path: 'metadata.key1',
      filter: RegexEquals,
      value: 'VAL.*',
    } as ParsedFilter;
    const noFilterField = {
      path: 'metadata.key2',
      filter: RegexNotEquals,
      value: '.*3',
    } as ParsedFilter;
    const filters = [notEndWith, rootFilter];
    it('should be case sensitive', () => {
      expect(applyFilters(assets, [caseSensitive]).length).toEqual(0);
    });
    it('should filter root props', () => {
      expect(applyFilters(assets, [rootFilter]).length).toEqual(3);
    });
    it('should filter numbers and booleans', () => {
      expect(applyFilters(assets, [idFilter, boolFilter]).length).toEqual(2);
    });
    it('should not drop all results which miss filter key', () => {
      expect(applyFilters(assets, [noFilterField]).length).toEqual(4);
    });
    it('should follow "and" logic for multiple filter', () => {
      expect(applyFilters(assets, filters).length).toEqual(2);
    });
  });

  describe('Flatten', () => {
    const obj = {
      undefined,
      null: null,
      string: 'hello',
      number: 123,
      float: 123.4,
      array: [1, 2, 3],
      nested: {
        undefined,
        null: null,
        string: 'hello',
        number: 123,
        float: 123.4,
      },
    };

    const flattenObj = {
      undefined,
      null: null,
      string: 'hello',
      number: 123,
      float: 123.4,
      array: [1, 2, 3],
      'nested.string': 'hello',
      'nested.number': 123,
      'nested.float': 123.4,
      'nested.null': null,
      'nested.undefined': undefined,
    };
    it('should flatten nested objects to dot notation', () => {
      expect(flatten(obj)).toEqual(flattenObj);
    });
    it('should not flatten arrays', () => {
      expect(isArray(flatten(obj).array)).toBeTruthy();
    });
  });

  describe('RFC3339 and ISO8601 valid string test', () => {
    it('should return false on bad string', () => {
      expect(isRFC3339_ISO6801('I am not a date but a string')).toBe(false);
    });
    it('should return false on a short numeric string', () => {});
    expect(isRFC3339_ISO6801('1234')).toBe(false);
    it('should return false on short numebrs', () => {
      expect(isRFC3339_ISO6801(8)).toBe(false);
    });
    it('should return false on null', () => {
      expect(isRFC3339_ISO6801(null)).toBe(false);
    });
    it('should return true on valid formatted date string with ms', () => {
      expect(isRFC3339_ISO6801('2020-06-01T00:00:00.000Z')).toBe(true);
    });
    it('should  return true on valid formatted date string without ms', () => {
      expect(isRFC3339_ISO6801('2020-06-01T00:00:00Z')).toBe(true);
    });
    it('should return false on true', () => {
      expect(isRFC3339_ISO6801(true)).toBe(false);
    });
    it('should return false on zero', () => {
      expect(isRFC3339_ISO6801(0)).toBe(false);
    });
    it('should return false on decimal', () => {
      expect(isRFC3339_ISO6801(0.111111)).toBe(false);
    });
  });
});
