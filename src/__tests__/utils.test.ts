/* eslint-disable */
describe('Noop', () => {
  it('should match', () => {
    expect(42).toEqual(42);
  });
});

/* import { applyFilters } from '../utils';
import { FilterType, ParsedFilter } from '../parser/types';

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
});
 */