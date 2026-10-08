import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { UnitsEditor } from '../components/records/UnitsEditor';
import { availableUnitProperties, canAddUnitRow } from '../cdf/units';
import { RecordViewDefinition } from '../types/records';
import { CogniteUnit } from '../types/dms';
import { RecordsTargetUnit } from '../types';
import { unitBearingProperties } from '../cdf/records';

/**
 * No record view in the test project declares more than one unit-bearing property
 * yet, so the multi-property behaviour is only reachable through a synthetic view.
 * The option filtering is a pure reducer, so it is covered
 * through its pure helpers and the rest by a server render.
 */
const multiUnitView = {
  space: 'plant',
  externalId: 'PumpReading',
  version: 'v1',
  streamId: ['readings'],
  properties: {
    inletPressure: { type: { type: 'float64', unit: { externalId: 'pressure:bar' } } },
    outletPressure: { type: { type: 'float64', unit: { externalId: 'pressure:bar' } } },
    runtime: { type: { type: 'float64', unit: { externalId: 'time:sec' } } },
    label: { type: { type: 'text' } },
  },
} as unknown as RecordViewDefinition;

const unitIndex = new Map<string, CogniteUnit>([
  ['pressure:bar', { space: 'u', externalId: 'pressure:bar', name: 'BAR', description: 'bar', symbol: 'bar', quantity: 'Pressure' }],
  ['pressure:psi', { space: 'u', externalId: 'pressure:psi', name: 'PSI', description: 'pound per square inch', symbol: 'psi', quantity: 'Pressure' }],
  ['time:sec', { space: 'u', externalId: 'time:sec', name: 'SEC', description: 'second', symbol: 's', quantity: 'Time' }],
  ['time:min', { space: 'u', externalId: 'time:min', name: 'MIN', description: 'minute', symbol: 'min', quantity: 'Time' }],
]);

const CONVERTIBLE = ['inletPressure', 'outletPressure', 'runtime'];

const renderEditor = (targetUnits: RecordsTargetUnit[], viewDef = multiUnitView) =>
  renderToStaticMarkup(
    <UnitsEditor
      viewDef={viewDef}
      targetUnits={targetUnits}
      unitSystems={[]}
      unitIndex={unitIndex}
      onChange={jest.fn()}
    />
  );

describe('convertible properties', () => {
  it('are every property whose container declares a unit', () => {
    // `label` has no unit, so it can never be converted
    expect(unitBearingProperties(multiUnitView).map((e) => e.property)).toEqual(CONVERTIBLE);
  });
});

describe('availableUnitProperties', () => {
  it('offers every convertible property to the only row', () => {
    expect(
      availableUnitProperties(CONVERTIBLE, [{ property: '', unitExternalId: '' }], 0)
    ).toEqual(CONVERTIBLE);
  });

  it('hides a property another row already claimed', () => {
    // The API accepts a duplicate and silently applies the last one, which would
    // leave the earlier row displaying a target unit that is not in effect.
    const rows = [
      { property: 'inletPressure', unitExternalId: 'pressure:psi' },
      { property: '', unitExternalId: '' },
    ];
    expect(availableUnitProperties(CONVERTIBLE, rows, 1)).toEqual([
      'outletPressure',
      'runtime',
    ]);
  });

  it('still offers a row its own current property, so it stays changeable', () => {
    const rows = [
      { property: 'inletPressure', unitExternalId: 'pressure:psi' },
      { property: 'runtime', unitExternalId: 'time:min' },
    ];
    expect(availableUnitProperties(CONVERTIBLE, rows, 0)).toEqual([
      'inletPressure',
      'outletPressure',
    ]);
  });
});

describe('canAddUnitRow', () => {
  it('offers a row while properties remain unclaimed', () => {
    expect(
      canAddUnitRow(3, [{ property: 'inletPressure', unitExternalId: 'pressure:psi' }])
    ).toBe(true);
  });

  it('stops once every property is claimed', () => {
    expect(
      canAddUnitRow(3, [
        { property: 'inletPressure', unitExternalId: 'pressure:psi' },
        { property: 'outletPressure', unitExternalId: 'pressure:psi' },
        { property: 'runtime', unitExternalId: 'time:min' },
      ])
    ).toBe(false);
  });

  it('does not stack blank rows', () => {
    expect(
      canAddUnitRow(3, [
        { property: 'inletPressure', unitExternalId: 'pressure:psi' },
        { property: '', unitExternalId: '' },
      ])
    ).toBe(false);
  });
});

describe('rendering', () => {
  it('shows a row and its storage unit for each claimed property', () => {
    const html = renderEditor([
      { property: 'inletPressure', unitExternalId: 'pressure:psi' },
      { property: 'runtime', unitExternalId: 'time:min' },
    ]);
    expect(html).toContain('Storage unit: bar (bar)');
    expect(html).toContain('Storage unit: second (s)');
    expect(html).toContain('records-remove-unit-0');
    expect(html).toContain('records-remove-unit-1');
  });

  it('keeps the add button reachable until the last property is claimed', () => {
    const twoOfThree = renderEditor([
      { property: 'inletPressure', unitExternalId: 'pressure:psi' },
      { property: 'outletPressure', unitExternalId: 'pressure:psi' },
    ]);
    expect(twoOfThree).toContain('records-add-unit');

    const allThree = renderEditor([
      { property: 'inletPressure', unitExternalId: 'pressure:psi' },
      { property: 'outletPressure', unitExternalId: 'pressure:psi' },
      { property: 'runtime', unitExternalId: 'time:min' },
    ]);
    expect(allThree).not.toContain('records-add-unit');
  });

  it('renders nothing for a view with no unit-bearing property', () => {
    const html = renderEditor([], {
      ...multiUnitView,
      properties: { label: { type: { type: 'text' } } },
    } as unknown as RecordViewDefinition);
    expect(html).toBe('');
  });
});

describe('unit-in-label switch', () => {
  const suffixSwitch = (html: string) =>
    html.slice(html.indexOf('records-unit-suffix') - 200, html.indexOf('records-unit-suffix') + 120);

  it('is present and on by default', () => {
    const html = renderEditor([]);
    expect(suffixSwitch(html)).toContain('checked=""');
  });

  it('renders off when the query opted out', () => {
    const html = renderToStaticMarkup(
      <UnitsEditor
        viewDef={multiUnitView}
        targetUnits={[]}
        hideUnitSuffix
        unitSystems={[]}
        unitIndex={unitIndex}
        onChange={jest.fn()}
      />
    );
    expect(suffixSwitch(html)).not.toContain('checked=""');
  });
});
