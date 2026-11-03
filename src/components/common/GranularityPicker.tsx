import React from 'react';
import { Badge, RadioButtonGroup, Select, Stack } from '@grafana/ui';
import { autoStepFactor, resolveDatapointsGranularity } from '../../cdf/granularity';
import { granularityToMs } from '../../cdf/gapFill';
import { BlurInput } from '../records/BlurInput';

type Mode = 'auto' | 'fixed';

const MODE_OPTIONS: Array<{ label: string; value: Mode; description: string }> = [
  { label: 'Auto', value: 'auto', description: 'Follows the time range and the panel width' },
  { label: 'Fixed', value: 'fixed', description: 'A granularity of your choice, for example 1h' },
];

/** The auto steps, as saved: plain auto is an empty granularity. */
const AUTO_OPTIONS = [
  { value: '', label: 'Standard', description: 'About one interval per panel pixel' },
  {
    value: 'auto:fewer',
    label: 'Fewer points',
    description: 'Intervals 4 times wider, loads faster',
  },
];

const FALLBACK_GRANULARITY = '1h';

interface GranularityPickerProps {
  refId: string;
  /** The saved granularity. Empty means Auto, as it always has. */
  value?: string;
  onChange: (granularity: string) => void;
  /** The panel's interval, used to show what an auto step resolves to. */
  intervalMs?: number;
}

/**
 * Picks a datapoints granularity the way gap filling picks its limit: Auto, which
 * follows the time range (standard, or with fewer points), or a fixed value
 * typed in. Plain Auto is saved as an empty granularity, so queries saved before the
 * steps existed read back unchanged.
 */
/** The id of the control a granularity label points at: the auto step, or the fixed value. */
export const granularityInputId = (refId: string, value?: string) =>
  autoStepFactor(value) === undefined ? `granularity-${refId}` : `granularity-auto-${refId}`;

export const GranularityPicker = ({ refId, value, onChange, intervalMs }: GranularityPickerProps) => {
  const factor = autoStepFactor(value);
  const mode: Mode = factor === undefined ? 'fixed' : 'auto';
  const resolved = intervalMs ? resolveDatapointsGranularity(value, intervalMs) : undefined;
  // A value held in a dashboard variable is only known once the query interpolates it.
  const invalid = mode === 'fixed' && !!value && !value.includes('$') && granularityToMs(value.trim()) === undefined;

  const changeMode = (next: Mode) => {
    if (next === 'auto') {
      onChange('');
    } else {
      // Start from the granularity currently in effect, so switching keeps the behaviour.
      onChange(resolved ?? FALLBACK_GRANULARITY);
    }
  };

  return (
    <Stack direction="row" alignItems="center" gap={1}>
      <RadioButtonGroup options={MODE_OPTIONS} value={mode} onChange={changeMode} aria-label="Granularity" />
      {mode === 'auto' && (
        <Select
          inputId={granularityInputId(refId, value)}
          aria-label="Auto granularity"
          // The option list is as wide as the field: wide enough for the descriptions
          // to read on one or two lines.
          width={32}
          options={AUTO_OPTIONS}
          value={factor === 1 ? '' : 'auto:fewer'}
          menuPosition="fixed"
          onChange={({ value: next }) => onChange(next ?? '')}
        />
      )}
      {mode === 'fixed' && (
        <BlurInput
          id={granularityInputId(refId, value)}
          aria-label="Fixed granularity"
          width={10}
          placeholder={FALLBACK_GRANULARITY}
          value={value ?? ''}
          // Clearing the value goes back to Auto.
          onCommit={(text) => onChange(text.trim())}
        />
      )}
      {mode === 'auto' && resolved && (
        <Badge
          color="blue"
          text={`= ${resolved}`}
          tooltip="Recomputed whenever the time range or the panel size changes."
          data-testid={`granularity-badge-${refId}`}
        />
      )}
      {invalid && (
        <Badge
          color="orange"
          icon="exclamation-triangle"
          text="not a granularity"
          tooltip="Use a whole number of s, m, h, d or mo (or second, minute, hour, day, month), for example 12h."
          data-testid={`granularity-badge-${refId}`}
        />
      )}
    </Stack>
  );
};
