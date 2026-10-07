import React, { ComponentProps, useEffect, useState } from 'react';
import { Input } from '@grafana/ui';

type BlurInputProps = Omit<ComponentProps<typeof Input>, 'value' | 'onChange' | 'onBlur'> & {
  value: string;
  /** Receives the typed text when the input loses focus, and only if it changed. */
  onCommit: (value: string) => void;
};

/**
 * An Input that holds its text locally and commits it on blur. Every change to the
 * query re-runs it, so committing per keystroke would send a records request for
 * each character typed.
 */
export const BlurInput = ({ value, onCommit, ...rest }: BlurInputProps) => {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <Input
      {...rest}
      value={draft}
      onChange={({ currentTarget }) => setDraft(currentTarget.value)}
      onBlur={() => draft !== value && onCommit(draft)}
    />
  );
};
