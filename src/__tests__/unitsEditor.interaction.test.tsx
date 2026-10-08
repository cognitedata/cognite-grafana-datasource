import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { UnitsEditor } from '../components/records/UnitsEditor';
import { RecordViewDefinition } from '../types/records';
import { CogniteUnit } from '../types/dms';

const viewDef = {
  space: 'sp',
  externalId: 'V',
  version: 'v1',
  streamId: ['s'],
  properties: {
    pressure: {
      type: { type: 'float64', list: false, unit: { externalId: 'pressure:pa' } },
      container: { type: 'container', space: 'sp', externalId: 'C' },
      containerPropertyIdentifier: 'pressure',
    },
  },
} as unknown as RecordViewDefinition;

const renderEditor = (hideUnitSuffix?: boolean) => {
  const onChange = jest.fn();
  render(
    <UnitsEditor
      viewDef={viewDef}
      targetUnits={[]}
      hideUnitSuffix={hideUnitSuffix}
      unitSystems={[]}
      unitIndex={new Map<string, CogniteUnit>()}
      onChange={onChange}
    />
  );
  return onChange;
};

describe('unit-in-label switch', () => {
  it('turning it off stores the opt-out flag', () => {
    const onChange = renderEditor();
    fireEvent.click(screen.getByTestId('records-unit-suffix'));
    expect(onChange).toHaveBeenCalledWith({ hideUnitSuffix: true });
  });

  it('turning it back on removes the flag instead of storing false', () => {
    // On is the default, so a query that never opted out round-trips unchanged.
    const onChange = renderEditor(true);
    fireEvent.click(screen.getByTestId('records-unit-suffix'));
    expect(onChange).toHaveBeenCalledWith({ hideUnitSuffix: undefined });
  });
});
