import React from 'react';
import { Badge, RadioButtonGroup, Stack } from '@grafana/ui';
import { CogniteQuery, GapFill } from '../../types';
import { DEFAULT_FILL_MULTIPLE, resolveFillLimit } from '../../cdf/gapFill';
import { isAutoInterval, resolveDatapointsGranularity } from '../../cdf/granularity';
import { BlurInput } from '../records/BlurInput';

export const GAP_FILL_TOOLTIP =
  'Fill intervals that have no data points. CDF interpolates across gaps in the raw data up to the limit, ' +
  'and carries the last value forward for the limit after the last data point; longer gaps stay empty. ' +
  'Fixed: the limit as typed, for example 4h (s, m, h or d), never less than the granularity. ' +
  '× granularity: a multiple of the granularity, so the limit follows an auto granularity as the time range changes. ' +
  'A time series panel draws its line across intervals without a value; set its "Disconnect values" option to see the gaps left open.';

type Mode = 'off' | GapFill['mode'];

const MODE_OPTIONS: Array<{ label: string; value: Mode; description: string }> = [
  { label: 'Off', value: 'off', description: 'Intervals without data points are left out' },
  { label: 'Fixed', value: 'duration', description: 'Fill gaps up to a fixed duration' },
  { label: '× granularity', value: 'granularity', description: 'Fill gaps up to a multiple of the granularity' },
];

const FALLBACK_LIMIT = '1h';

interface GapFillControlsProps {
  query: Pick<CogniteQuery, 'refId' | 'aggregation' | 'granularity' | 'gapFill'>;
  onChange: (gapFill: GapFill | undefined) => void;
  /** The panel's interval, used to show the limit an auto granularity resolves to. */
  intervalMs?: number;
}

/**
 * The gap filling controls: a mode switch, then the limit or the multiple. A badge
 * shows the limit that will be sent, resolved the same way as the request.
 */
export const GapFillControls = ({ query, onChange, intervalMs }: GapFillControlsProps) => {
  const { refId, aggregation, granularity, gapFill } = query;
  const mode: Mode = gapFill?.mode ?? 'off';
  const resolvedGranularity =
    granularity && !isAutoInterval(granularity)
      ? granularity
      : intervalMs
        ? resolveDatapointsGranularity(granularity, intervalMs)
        : undefined;
  // A limit held in a dashboard variable is only known once the query interpolates it.
  const variableLimit = gapFill?.mode === 'duration' && !!gapFill.limit?.includes('$');
  const resolution = resolvedGranularity && !variableLimit
    ? resolveFillLimit(gapFill, resolvedGranularity, aggregation)
    : {};

  const changeMode = (next: Mode) => {
    if (next === 'off') {
      onChange(undefined);
    } else if (next === 'granularity') {
      onChange({ mode: 'granularity', multiple: gapFill?.multiple ?? DEFAULT_FILL_MULTIPLE });
    } else {
      // Start from the limit currently in effect, so switching modes keeps the behaviour.
      onChange({ mode: 'duration', limit: gapFill?.limit ?? resolution.limit ?? FALLBACK_LIMIT });
    }
  };

  return (
    <Stack direction="row" alignItems="center" gap={1}>
      <RadioButtonGroup
        options={MODE_OPTIONS}
        value={mode}
        onChange={changeMode}
        aria-label="Gap filling"
      />
      {mode === 'duration' && (
        <BlurInput
          id={`gap-fill-limit-${refId}`}
          aria-label="Fill limit"
          width={10}
          placeholder="4h"
          value={gapFill?.limit ?? ''}
          onCommit={(limit) => onChange({ mode: 'duration', limit })}
        />
      )}
      {mode === 'granularity' && (
        <BlurInput
          id={`gap-fill-multiple-${refId}`}
          aria-label="Fill limit multiple"
          type="number"
          min={1}
          step={1}
          width={8}
          prefix="×"
          value={String(gapFill?.multiple ?? DEFAULT_FILL_MULTIPLE)}
          onCommit={(text) => onChange({ mode: 'granularity', multiple: Number(text) })}
        />
      )}
      {mode !== 'off' && resolution.warning && (
        <Badge
          color="orange"
          icon="exclamation-triangle"
          text={resolution.limit ? `= ${resolution.limit}` : 'not applied'}
          tooltip={resolution.warning}
          data-testid={`gap-fill-badge-${refId}`}
        />
      )}
      {/* A fixed limit used as typed needs no echo; a multiple does, it is computed. */}
      {mode === 'granularity' && !resolution.warning && resolution.limit && (
        <Badge
          color="blue"
          text={`= ${resolution.limit}`}
          tooltip="The fill limit sent to CDF. It follows the granularity, which can change with the time range."
          data-testid={`gap-fill-badge-${refId}`}
        />
      )}
    </Stack>
  );
};
