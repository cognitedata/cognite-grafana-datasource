import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { GapFillControls } from '../components/common/GapFillEditor';
import { GapFill } from '../types';

const renderControls = (gapFill?: GapFill, granularity = '', intervalMs = 15 * 60_000) => {
  const onChange = jest.fn();
  render(
    <GapFillControls
      query={{ refId: 'A', aggregation: 'average', granularity, gapFill }}
      intervalMs={intervalMs}
      onChange={onChange}
    />
  );
  return onChange;
};

describe('GapFillControls', () => {
  it('starts off, with no limit input', () => {
    renderControls();
    expect((screen.getByLabelText('Off') as HTMLInputElement).checked).toBe(true);
    expect(screen.queryByLabelText('Fill limit')).toBeNull();
    expect(screen.queryByTestId('gap-fill-badge-A')).toBeNull();
  });

  it('switches to a multiple of the granularity, 4 by default', () => {
    const onChange = renderControls();
    fireEvent.click(screen.getByLabelText('× granularity'));
    expect(onChange).toHaveBeenCalledWith({ mode: 'granularity', multiple: 4 });
  });

  it('shows the limit a multiple resolves to with an auto granularity', () => {
    renderControls({ mode: 'granularity', multiple: 4 });
    expect(screen.getByTestId('gap-fill-badge-A').textContent).toContain('= 1h');
  });

  it('commits a new multiple on blur', () => {
    const onChange = renderControls({ mode: 'granularity', multiple: 4 });
    const input = screen.getByLabelText('Fill limit multiple');
    fireEvent.change(input, { target: { value: '6' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith({ mode: 'granularity', multiple: 6 });
  });

  it('switching to a fixed limit keeps the limit in effect', () => {
    const onChange = renderControls({ mode: 'granularity', multiple: 4 }, '2h');
    fireEvent.click(screen.getByLabelText('Fixed'));
    expect(onChange).toHaveBeenCalledWith({ mode: 'duration', limit: '8h' });
  });

  it('commits a fixed limit on blur', () => {
    const onChange = renderControls({ mode: 'duration', limit: '1h' }, '1h');
    const input = screen.getByLabelText('Fill limit');
    fireEvent.change(input, { target: { value: '12h' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith({ mode: 'duration', limit: '12h' });
  });

  it('shows no badge for a fixed limit used as typed', () => {
    renderControls({ mode: 'duration', limit: '8m' }, '2m');
    expect(screen.queryByTestId('gap-fill-badge-A')).toBeNull();
  });

  it('flags a fixed limit shorter than the granularity', () => {
    renderControls({ mode: 'duration', limit: '30m' }, '1h');
    expect(screen.getByTestId('gap-fill-badge-A').textContent).toContain('= 1h');
  });

  it('flags a limit the API would reject', () => {
    renderControls({ mode: 'duration', limit: '1w' }, '1h');
    expect(screen.getByTestId('gap-fill-badge-A').textContent).toContain('not applied');
  });

  it('turns off', () => {
    const onChange = renderControls({ mode: 'duration', limit: '1h' }, '1h');
    fireEvent.click(screen.getByLabelText('Off'));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('shows no verdict for a limit held in a dashboard variable', () => {
    renderControls({ mode: 'duration', limit: '$fillLimit' }, '1h');
    expect(screen.queryByTestId('gap-fill-badge-A')).toBeNull();
  });
});
