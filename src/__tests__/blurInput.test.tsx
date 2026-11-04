import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { BlurInput } from '../components/records/BlurInput';

describe('BlurInput', () => {
  it('commits on Enter, and not again when the field then loses focus', () => {
    const onCommit = jest.fn();
    render(<BlurInput aria-label="limit" value="10" onCommit={onCommit} />);
    const input = screen.getByLabelText('limit');
    fireEvent.change(input, { target: { value: '25' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.blur(input);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('25');
  });

  it('shows the kept value when the caller rejects the text, and commits it again on request', () => {
    const onCommit = jest.fn();
    render(<BlurInput aria-label="limit" value="10" onCommit={onCommit} />);
    const input = screen.getByLabelText('limit') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '99999' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(input.value).toBe('10');
    fireEvent.change(input, { target: { value: '99999' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onCommit).toHaveBeenCalledTimes(2);
  });

  it('does not commit on Enter while an input method is composing', () => {
    const onCommit = jest.fn();
    render(<BlurInput aria-label="limit" value="10" onCommit={onCommit} />);
    const input = screen.getByLabelText('limit');
    fireEvent.change(input, { target: { value: '25' } });
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('commits on blur, and only when the text changed', () => {
    const onCommit = jest.fn();
    render(<BlurInput aria-label="limit" value="10" onCommit={onCommit} />);
    const input = screen.getByLabelText('limit');
    fireEvent.blur(input);
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: '11' } });
    fireEvent.blur(input);
    expect(onCommit).toHaveBeenCalledWith('11');
  });
});
