import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { GranularityPicker, granularityInputId } from '../components/common/GranularityPicker';

const renderPicker = (value?: string, intervalMs = 10 * 60_000) => {
  const onChange = jest.fn();
  render(<GranularityPicker refId="A" value={value} intervalMs={intervalMs} onChange={onChange} />);
  return onChange;
};

const checked = (label: string) => (screen.getByLabelText(label) as HTMLInputElement).checked;

/** Opens the auto step dropdown and picks an option by its label. */
const pickAutoStep = async (label: string) => {
  const input = document.getElementById('granularity-auto-A') as HTMLInputElement;
  fireEvent.focus(input);
  fireEvent.keyDown(input, { key: 'ArrowDown', code: 'ArrowDown' });
  fireEvent.click(await screen.findByText(label));
};

describe('GranularityPicker', () => {
  it('reads an empty granularity as Auto, standard, and shows what it resolves to', () => {
    renderPicker('');
    expect(checked('Auto')).toBe(true);
    expect(screen.getByText('Standard')).toBeTruthy();
    expect(screen.getByTestId('granularity-badge-A').textContent).toBe('= 10m');
    expect(document.getElementById('granularity-A')).toBeNull();
  });

  it('reads the coarser step as Auto with fewer points', () => {
    renderPicker('auto:fewer');
    expect(checked('Auto')).toBe(true);
    expect(screen.getByText('Fewer points')).toBeTruthy();
    expect(screen.getByTestId('granularity-badge-A').textContent).toBe('= 1h');
  });

  it('picks fewer points', async () => {
    const onChange = renderPicker('');
    await pickAutoStep('Fewer points');
    expect(onChange).toHaveBeenLastCalledWith('auto:fewer');
  });

  it('saves standard as an empty granularity, as before the auto steps', async () => {
    const onChange = renderPicker('auto:fewer');
    await pickAutoStep('Standard');
    expect(onChange).toHaveBeenLastCalledWith('');
  });

  it('switching to Fixed keeps the granularity in effect', () => {
    const onChange = renderPicker('auto:fewer');
    fireEvent.click(screen.getByLabelText('Fixed'));
    expect(onChange).toHaveBeenCalledWith('1h');
  });

  it('switching to Auto goes back to standard', () => {
    const onChange = renderPicker('2h');
    fireEvent.click(screen.getByLabelText('Auto'));
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('applies a typed fixed granularity when the field loses focus', () => {
    const onChange = renderPicker('2h');
    expect(checked('Fixed')).toBe(true);
    const input = document.getElementById('granularity-A') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '3h' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith('3h');
  });

  it('flags a fixed granularity CDF would reject', () => {
    renderPicker('1w');
    expect(screen.getByTestId('granularity-badge-A').textContent).toContain('not a granularity');
  });

  it('does not flag a variable', () => {
    renderPicker('$interval');
    expect(screen.queryByTestId('granularity-badge-A')).toBeNull();
  });

  it('names the control a label points at: the auto step, or the fixed value', () => {
    expect(granularityInputId('A', '')).toBe('granularity-auto-A');
    expect(granularityInputId('A', 'auto:fewer')).toBe('granularity-auto-A');
    expect(granularityInputId('A', '12h')).toBe('granularity-A');
  });
});
