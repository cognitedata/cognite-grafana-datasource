import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Select } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { Connector } from '../../connector';
import { fetchContainerViews, stringifyError } from '../../cdf/client';
import { InvolvedView, ViewRef } from '../../types/dms';

export type { ViewRef };

/** How a view reads everywhere one can be chosen, e.g. "CogniteTimeSeries (cdf_cdm) v1". */
export const viewLabel = (view: ViewRef): string =>
  `${view.externalId} (${view.space}) ${view.version}`;

export const viewDescription = (view: ViewRef): string =>
  `Space: ${view.space}, Version: ${view.version}`;

/**
 * A view triple as a single option value. Unlike instance externalIds — which may
 * contain colons and therefore travel as JSON (see `encodeInstanceRef`) — view
 * externalIds are DMS identifiers that cannot contain colons, so the readable
 * colon-joined form is unambiguous here.
 */
export const encodeViewRef = ({ space, externalId, version }: ViewRef): string =>
  `${space}:${externalId}:${version}`;

export function parseViewRef(raw: string): ViewRef | null {
  const parts = (raw ?? '').split(':');
  if (parts.length !== 3 || parts.some((part) => !part.trim())) {
    return null;
  }
  const [space, externalId, version] = parts.map((part) => part.trim());
  return { space, externalId, version };
}

/** Maps views to options. Pure, so it can be covered without a DOM. */
export const toViewOptions = (views: InvolvedView[]): Array<SelectableValue<string>> =>
  (views ?? []).map((view) => ({
    label: viewLabel(view),
    value: encodeViewRef(view),
    description: viewDescription(view),
  }));

export interface ContainerViewsState {
  views: InvolvedView[];
  options: Array<SelectableValue<string>>;
  loading: boolean;
  /** True once a fetch for the current container has succeeded. */
  loaded: boolean;
  error: string | null;
}

/**
 * The views implementing a `cdf_cdm` container, as state plus ready-made options.
 * Shared by every view dropdown so fetching, loading and error handling behave the
 * same everywhere; callers with bespoke rendering can use this without `ViewPicker`.
 */
export function useContainerViews(connector: Connector, container: string): ContainerViewsState {
  const [views, setViews] = useState<InvolvedView[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoaded(false);
    setError(null);
    fetchContainerViews(connector, container)
      .then((result) => {
        if (!cancelled) {
          setViews(result);
          setLoaded(true);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setViews([]);
          setError(`Failed to load ${container} views: ${stringifyError(err)}`);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [connector, container]);

  const options = useMemo(() => toViewOptions(views), [views]);
  return { views, options, loading, loaded, error };
}

export interface ViewPickerProps {
  connector: Connector;
  /** The `cdf_cdm` container whose implementing views are listed, e.g. 'CogniteTimeSeries'. */
  container: string;
  /** The selected view, matched against the loaded views by its triple. */
  value?: ViewRef | null;
  onChange: (view: InvolvedView | null) => void;
  /** Fires once per successful load, e.g. to apply a default selection. */
  onViewsLoaded?: (views: InvolvedView[]) => void;
  onError?: (message: string) => void;
  placeholder?: string;
  width?: number;
  inputId?: string;
  disabled?: boolean;
  isClearable?: boolean;
}

/**
 * Dropdown over the views that implement a container. Shared by every tab that needs
 * one so the option layout, matching and error handling behave the same everywhere.
 */
export const ViewPicker = ({
  connector,
  container,
  value,
  onChange,
  onViewsLoaded,
  onError,
  placeholder = 'Select a view',
  width = 40,
  inputId,
  disabled,
  isClearable,
}: ViewPickerProps) => {
  const { views, options, loading, loaded, error } = useContainerViews(connector, container);

  // Refs so inline callbacks don't retrigger the notification effects.
  const onViewsLoadedRef = useRef(onViewsLoaded);
  onViewsLoadedRef.current = onViewsLoaded;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    if (loaded) {
      onViewsLoadedRef.current?.(views);
    }
  }, [loaded, views]);

  useEffect(() => {
    if (error) {
      (onErrorRef.current ?? console.warn)(error);
    }
  }, [error]);

  const selectedValue = value?.space && value?.externalId && value?.version ? encodeViewRef(value) : null;
  const selectedOption = selectedValue
    ? options.find((option) => option.value === selectedValue) ?? null
    : null;

  const handleChange = (option: SelectableValue<string> | null) => {
    if (!option?.value) {
      onChange(null);
      return;
    }
    onChange(views.find((view) => encodeViewRef(view) === option.value) ?? parseViewRef(option.value));
  };

  return (
    <Select
      options={options}
      value={selectedOption}
      onChange={handleChange}
      placeholder={placeholder}
      isLoading={loading}
      isClearable={isClearable}
      width={width}
      inputId={inputId}
      disabled={disabled}
    />
  );
};
