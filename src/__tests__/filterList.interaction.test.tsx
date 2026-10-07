import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { FilterList } from '../components/records/FilterList';
import { RecordViewDefinition } from '../types/records';
import { RecordsFilterRow } from '../types';
import { Connector } from '../connector';

const connector = {
  fetchItems: jest.fn().mockResolvedValue([]),
  fetchData: jest.fn().mockResolvedValue({ data: {} }),
} as unknown as Connector;

const viewDef = {
  space: 'sp',
  externalId: 'V',
  version: 'v1',
  streamId: ['s'],
  properties: {
    Message: { type: { type: 'text', list: false } },
  },
} as unknown as RecordViewDefinition;

const row: RecordsFilterRow = {
  property: 'Message',
  propertyType: 'text',
  operator: 'prefix',
  value: 'Compressor',
};

describe('negation toggle', () => {
  it('turns negation on for exactly the clicked row', () => {
    const onChange = jest.fn();
    render(
      <FilterList filters={[row, { ...row, value: 'Pump' }]} viewDef={viewDef} connector={connector} onChange={onChange} />
    );

    fireEvent.click(screen.getByTestId('records-negate-filter-1'));

    const next = onChange.mock.calls[0][0];
    expect(next[0].negate).toBeUndefined();
    expect(next[1].negate).toBe(true);
  });

  it('turning it off removes the key instead of storing false', () => {
    // Off is the default, so a plain row round-trips to exactly what it was.
    const onChange = jest.fn();
    render(
      <FilterList filters={[{ ...row, negate: true }]} viewDef={viewDef} connector={connector} onChange={onChange} />
    );

    fireEvent.click(screen.getByTestId('records-negate-filter-0'));

    expect(onChange.mock.calls[0][0][0].negate).toBeUndefined();
  });
});

describe('typing a value', () => {
  // Every committed change re-runs the query, so a keystroke must not commit.
  const renderRow = (onChange = jest.fn()) => {
    const view = render(
      <FilterList filters={[row]} viewDef={viewDef} connector={connector} onChange={onChange} />
    );
    return { onChange, input: screen.getByDisplayValue('Compressor'), ...view };
  };

  it('commits on blur, not per keystroke', () => {
    const { onChange, input } = renderRow();
    fireEvent.change(input, { target: { value: 'Compressor A' } });
    fireEvent.change(input, { target: { value: 'Compressor AB' } });
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0][0].value).toBe('Compressor AB');
  });

  it('does not commit a blur that changed nothing', () => {
    const { onChange, input } = renderRow();
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows a value changed from outside, such as a view switch', () => {
    const { rerender } = renderRow();
    rerender(
      <FilterList
        filters={[{ ...row, value: 'Pump' }]}
        viewDef={viewDef}
        connector={connector}
        onChange={jest.fn()}
      />
    );
    expect(screen.getByDisplayValue('Pump')).toBeTruthy();
  });
});
