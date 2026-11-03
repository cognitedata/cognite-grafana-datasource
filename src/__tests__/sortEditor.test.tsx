import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { SortEditor } from '../components/records/SortEditor';
import { RecordsSortRow } from '../types';

const MAPPED: RecordsSortRow = {
  property: 'temperature',
  direction: 'asc',
  containerSpace: 'sp',
  containerExternalId: 'Readings',
  containerPropertyIdentifier: 'temperature',
};

describe('Records SortEditor', () => {
  it('keeps the other rows\' container mapping when a row is removed, even without the view', () => {
    const onChange = jest.fn();
    render(<SortEditor sort={[MAPPED, { ...MAPPED, property: 'pressure' }]} viewDef={null} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('records-remove-sort-1'));
    expect(onChange).toHaveBeenCalledWith([MAPPED]);
  });

  it('adds a row with no property yet', () => {
    const onChange = jest.fn();
    render(<SortEditor sort={[MAPPED]} viewDef={null} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('records-add-sort'));
    expect(onChange.mock.calls[0][0][0]).toBe(MAPPED);
    expect(onChange.mock.calls[0][0][1]).toEqual(expect.objectContaining({ property: '', direction: 'desc' }));
  });
});
