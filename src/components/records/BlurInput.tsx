import React, { ComponentProps, useLayoutEffect, useState } from 'react';
import { Input } from '@grafana/ui';

type BlurInputProps = Omit<ComponentProps<typeof Input>, 'value' | 'onChange' | 'onBlur'> & {
  value: string;
  /** Receives the typed text on Enter or when the input loses focus, and only if it changed. */
  onCommit: (value: string) => void;
};

/**
 * An Input that holds its text locally and commits it on Enter or blur. Every change
 * to the query re-runs it, so committing per keystroke would send a request for each
 * character typed.
 */
export const BlurInput = ({ value, onCommit, onKeyDown, ...rest }: BlurInputProps) => {
  const [draft, setDraft] = useState(value);
  // Before paint, so a committed value shows without a flash of the old one.
  useLayoutEffect(() => setDraft(value), [value]);
  const commit = () => {
    if (draft !== value) {
      onCommit(draft);
      // Back to the caller's value: it replaces this with the new one, or keeps it
      // when it rejects or clamps the text, so the field never shows what isn't sent.
      // It also stops the blur after an Enter from committing the same text again.
      setDraft(value);
    }
  };
  return (
    <Input
      {...rest}
      value={draft}
      onChange={({ currentTarget }) => setDraft(currentTarget.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        // Not while an input method is composing: there Enter confirms the composition.
        if (event.key === 'Enter' && !event.defaultPrevented && !event.nativeEvent.isComposing) {
          commit();
        }
      }}
    />
  );
};
