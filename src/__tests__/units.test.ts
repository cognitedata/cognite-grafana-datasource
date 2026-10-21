import { CogniteUnit } from '../types/dms';
import {
  storageUnitLabel,
  targetUnitApplies,
  unitDisplayName,
  unitSymbol,
  withUnitSuffix,
} from '../cdf/units';

const index = new Map<string, CogniteUnit>([
  [
    'time:sec',
    { space: 'u', externalId: 'time:sec', name: 'SEC', description: 'second', symbol: 's' },
  ],
  // Some catalog entries carry no symbol
  ['time:shake', { space: 'u', externalId: 'time:shake', name: 'SHAKE' }],
]);

describe('unit display', () => {
  it('prefers the description over the terse catalog name', () => {
    // The Time Series tab already read units this way; the Records tab now matches
    expect(unitDisplayName('time:sec', index)).toBe('second (s)');
  });

  it('drops the parenthetical when the unit has no symbol', () => {
    expect(unitDisplayName('time:shake', index)).toBe('SHAKE');
  });

  it('falls back to the externalId when the catalog has not loaded', () => {
    expect(unitDisplayName('time:sec', new Map())).toBe('time:sec');
    expect(unitDisplayName('time:sec')).toBe('time:sec');
  });

  it('reads as "no unit" when there is none', () => {
    expect(unitDisplayName(undefined, index)).toBe('no unit');
  });

  it('labels storage units identically in both tabs', () => {
    expect(storageUnitLabel('time:sec', index)).toBe('Storage unit: second (s)');
  });
});

describe('unit suffixes', () => {
  it('uses the catalog symbol', () => {
    expect(unitSymbol('time:sec', index)).toBe('s');
    expect(withUnitSuffix('ActiveDuration', 'time:sec', index)).toBe('ActiveDuration (s)');
  });

  it('falls back to the externalId suffix without a catalog', () => {
    expect(unitSymbol('pressure:psi')).toBe('psi');
    expect(withUnitSuffix('avg', 'pressure:psi')).toBe('avg (psi)');
  });

  it('leaves the name alone when there is no unit', () => {
    expect(unitSymbol(undefined, index)).toBeUndefined();
    expect(withUnitSuffix('count', undefined, index)).toBe('count');
  });
});

describe('targetUnitApplies', () => {
  const index = new Map(
    [
      { externalId: 'temperature:deg_c', quantity: 'Temperature' },
      { externalId: 'temperature:deg_f', quantity: 'Temperature' },
      { externalId: 'pressure:bar', quantity: 'Pressure' },
    ].map((unit) => [unit.externalId, unit as CogniteUnit])
  );

  it('keeps a conversion for a series that measures the same quantity', () => {
    expect(targetUnitApplies('temperature:deg_f', 'temperature:deg_c', index)).toBe(true);
  });

  it('drops it for another quantity or a series without a unit', () => {
    expect(targetUnitApplies('temperature:deg_f', 'pressure:bar', index)).toBe(false);
    expect(targetUnitApplies('temperature:deg_f', undefined, index)).toBe(false);
    expect(targetUnitApplies(undefined, 'temperature:deg_c', index)).toBe(false);
  });

  it('keeps it when the catalog cannot place a unit, before it has loaded for one', () => {
    expect(targetUnitApplies('temperature:deg_f', 'unknown:unit', index)).toBe(true);
    expect(targetUnitApplies('temperature:deg_f', 'temperature:deg_c', new Map())).toBe(true);
  });
});
