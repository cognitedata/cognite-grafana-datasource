import React from 'react';
import { EditorField } from '@grafana/plugin-ui';
import { BlurInput } from '../records/BlurInput';

interface LabelFieldProps {
  id: string;
  value?: string;
  tooltip: string;
  placeholder?: string;
  onCommit: (label: string) => void;
}

/**
 * The series label, last on a CDM tab: it names whatever the rows above produce.
 * Committed on blur, since every change to the query re-runs it.
 */
export const LabelField = ({ id, value, tooltip, placeholder = '{{name}}', onCommit }: LabelFieldProps) => (
  <EditorField label="Label" optional tooltip={tooltip} htmlFor={id}>
    <BlurInput id={id} width={64} value={value ?? ''} placeholder={placeholder} onCommit={onCommit} />
  </EditorField>
);
