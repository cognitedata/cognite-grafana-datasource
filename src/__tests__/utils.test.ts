import { applyFilters, checkFilter } from '../utils';
import { FilterType } from '../query-parser/types';

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
      },
      { id: 999, name: 'foo', description: 'bar', metadata: { key1: 'value1' } },
    ];
    const rootFilter = { path: 'name', filter: FilterType.NotEquals, value: 'foo' };
    const notEndWith = { path: 'metadata.key1', filter: FilterType.RegexNotEquals, value: '.*1' };
    const caseSensitive = { path: 'metadata.key1', filter: FilterType.RegexEquals, value: 'VAL.*' };
    const noFilterField = {
      path: 'metadata.key2',
      filter: FilterType.RegexNotEquals,
      value: '.*3',
    };
    const filters = [caseSensitive, notEndWith, rootFilter];
    it('should be case insensitive', () => {
      expect(applyFilters(assets, [caseSensitive]).length).toEqual(4);
    });
    it('should filter root props', () => {
      expect(applyFilters(assets, [rootFilter]).length).toEqual(3);
    });
    it('should drop all results which miss filter key', () => {
      expect(applyFilters(assets, [noFilterField]).length).toEqual(1);
    });
    it('should follow "and" logic for multiple filter', () => {
      expect(applyFilters(assets, filters).length).toEqual(2);
    });
  });
});
