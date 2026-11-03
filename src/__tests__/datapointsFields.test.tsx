import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { DatapointsFields } from '../components/common/DatapointsFields';

const renderFields = (query: Record<string, unknown>, kind?: 'numeric' | 'string' | 'state') => {
  const onQueryChange = jest.fn();
  render(<DatapointsFields query={{ refId: 'A', ...query } as any} kind={kind} intervalMs={60_000} onQueryChange={onQueryChange} />);
  return onQueryChange;
};

const checked = (name: string) => (screen.getByRole('radio', { name }) as HTMLInputElement).checked;

describe('DatapointsFields', () => {
  it('shows the aggregation, granularity and gap filling for an aggregated read', () => {
    renderFields({ aggregation: 'average' });
    expect(checked('Aggregate')).toBe(true);
    expect(document.getElementById('aggregation-A')).not.toBeNull();
    expect(document.getElementById('granularity-auto-A')).not.toBeNull();
    expect(screen.getByRole('radio', { name: 'Off' })).toBeTruthy();
  });

  it.each([
    ['Raw', { aggregation: 'none' }],
    ['Latest', { aggregation: 'average', latestValue: true }],
  ])('%s collapses the row to the mode', (name, query) => {
    renderFields(query);
    expect(checked(name)).toBe(true);
    expect(document.getElementById('aggregation-A')).toBeNull();
    expect(document.getElementById('granularity-auto-A')).toBeNull();
    expect(screen.queryByRole('radio', { name: 'Off' })).toBeNull();
  });

  it('switches modes through the query: Latest keeps the aggregation for later', () => {
    const onQueryChange = renderFields({ aggregation: 'max' }, 'numeric');
    fireEvent.click(screen.getByRole('radio', { name: 'Latest' }));
    expect(onQueryChange).toHaveBeenCalledWith({ latestValue: true });
    fireEvent.click(screen.getByRole('radio', { name: 'Raw' }));
    expect(onQueryChange).toHaveBeenCalledWith({ aggregation: 'none' });
  });

  it('starts a string series on its first aggregate when switched to Aggregate', () => {
    const onQueryChange = renderFields({ aggregation: 'none' }, 'string');
    fireEvent.click(screen.getByRole('radio', { name: 'Aggregate' }));
    expect(onQueryChange).toHaveBeenCalledWith({ aggregation: 'interpolation' });
  });

  it('offers the aggregates of the type, without None', () => {
    renderFields({ aggregation: 'stateDuration' }, 'state');
    fireEvent.keyDown(document.getElementById('aggregation-A')!, { key: 'ArrowDown' });
    expect(screen.getByText('Most time in state')).toBeTruthy();
    expect(screen.queryByText('None')).toBeNull();
    expect(screen.queryByText('Average')).toBeNull();
    expect(screen.queryByText('Step Interpolation')).toBeNull();
  });

  it('goes back to the aggregate in use before Raw', () => {
    const onQueryChange = jest.fn();
    const props = { intervalMs: 60_000, onQueryChange, kind: 'numeric' as const };
    const { rerender } = render(<DatapointsFields query={{ refId: 'A', aggregation: 'max' } as any} {...props} />);
    rerender(<DatapointsFields query={{ refId: 'A', aggregation: 'none' } as any} {...props} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Aggregate' }));
    expect(onQueryChange).toHaveBeenCalledWith({ aggregation: 'max' });
  });

  it('holds the mode while disabled', () => {
    render(<DatapointsFields query={{ refId: 'A', aggregation: 'none' } as any} onQueryChange={jest.fn()} disabled />);
    expect((screen.getByRole('radio', { name: 'Aggregate' }) as HTMLInputElement).disabled).toBe(true);
  });
});
