import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { AsyncMultiSelect, AsyncSelect, Badge, BadgeColor } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { Connector } from '../../connector';
import { searchDMSInstances, stringifyError } from '../../cdf/client';
import { DMSFilter, DMSInstance, DMSSearchRequest, ViewRef } from '../../types/dms';

const MAX_LIMIT = 1000;
const DEBOUNCE_MS = 300;

export type { ViewRef };

/** A data modelling instance identifier, as the APIs expect it. */
export interface InstanceRef {
  space: string;
  externalId: string;
}

/**
 * A select needs a primitive option value, so a reference travels encoded. JSON rather
 * than a `space:externalId` shorthand: an instance externalId may itself contain colons
 * (`asset:equip:iaa_met_34es7512`), which makes a delimiter ambiguous to read back.
 */
export const encodeInstanceRef = ({ space, externalId }: InstanceRef): string =>
  JSON.stringify({ space, externalId });

/**
 * Reads a reference back, or null when the value is not one. Returning null rather than
 * throwing keeps a malformed value from taking the query editor down with it.
 */
export function parseInstanceRef(raw: string): InstanceRef | null {
  const text = raw?.trim();
  if (!text || !text.startsWith('{')) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null;
  }
  const { space, externalId } = parsed as Record<string, unknown>;
  const isFilled = (value: unknown): value is string =>
    typeof value === 'string' && value.trim().length > 0;
  if (!isFilled(space) || !isFilled(externalId)) {
    return null;
  }
  return { space: space.trim(), externalId: externalId.trim() };
}

/** A chosen instance, as stored in a query. */
export interface PickedInstance {
  value: string;
  space?: string;
  externalId?: string;
  name?: string;
  /** The searched view's properties for this instance, for callers that read one. */
  props?: Record<string, any>;
}

export type InstanceOption = SelectableValue<string> & {
  space?: string;
  externalId?: string;
  name?: string;
  props?: Record<string, any>;
};

/**
 * Maps search results to options. Pure, so it can be covered without a DOM.
 *
 * The description is the same in every tab that shows instances, one unit should
 * never read two different ways across the query editor.
 */
export function toInstanceOptions(
  instances: DMSInstance[],
  view: ViewRef
): InstanceOption[] {
  const viewKey = `${view.externalId}/${view.version}`;
  return (instances ?? []).map((instance) => {
    const props = instance.properties?.[view.space]?.[viewKey] ?? {};
    const name = typeof props.name === 'string' && props.name ? props.name : undefined;
    return {
      label: name ?? instance.externalId,
      value: encodeInstanceRef({
        space: instance.space,
        externalId: instance.externalId,
      }),
      description: `Space: ${instance.space}, External ID: ${instance.externalId}`,
      space: instance.space,
      externalId: instance.externalId,
      name,
      props,
    };
  });
}

/** Turns whatever the select hands back into the stored shape. */
export const toPickedInstance = (option: InstanceOption): PickedInstance => {
  const raw = String(option.value ?? '');
  const ref = parseInstanceRef(raw);
  return {
    value: raw,
    space: option.space ?? ref?.space,
    externalId: option.externalId ?? ref?.externalId,
    name: option.name,
    props: option.props,
  };
};

/**
 * The search request for one keystroke.
 */
export const buildInstanceSearchRequest = (
  view: ViewRef,
  query: string,
  filter?: DMSFilter,
  limit: number = MAX_LIMIT
): DMSSearchRequest => ({
  view: { type: 'view', ...view },
  query: query.trim(),
  filter,
  limit: Math.min(limit, MAX_LIMIT),
  operator: 'AND',
});

/** Rebuilds display options for values already saved in a query. */
export const toStoredOptions = (values: PickedInstance[]): InstanceOption[] =>
  (values ?? [])
    .filter((entry) => entry?.value)
    .map((entry) => {
      const ref = parseInstanceRef(entry.value);
      return {
        label: entry.name ?? ref?.externalId ?? entry.value,
        value: entry.value,
        description: ref ? `Space: ${ref.space}, External ID: ${ref.externalId}` : undefined,
        space: entry.space ?? ref?.space,
        externalId: entry.externalId ?? ref?.externalId,
        name: entry.name,
      };
    });

interface InstancePickerProps {
  connector: Connector;
  /** The view whose instances are searched. */
  view: ViewRef;
  multi?: boolean;
  value: PickedInstance[];
  onChange: (picked: PickedInstance[]) => void;
  /** Extra server-side scoping, e.g. `{ inSpace }`. */
  filter?: DMSFilter;
  limit?: number;
  /** Optional trailing badge, e.g. a time series' value type. */
  badgeOf?: (props: Record<string, any>) => { text: string; color: BadgeColor } | undefined;
  /** Notified with the failure message, and with null once a later search succeeds. */
  onError?: (message: string | null) => void;
  placeholder?: string;
  width?: number;
  inputId?: string;
  noOptionsMessage?: string;
  disabled?: boolean;
}

/**
 * Searchable picker over the instances of a view. Shared by every tab that needs one
 * so the search, the option layout and the debounce behave the same everywhere.
 */
export const InstancePicker = ({
  connector,
  view,
  multi,
  value,
  onChange,
  filter,
  limit = MAX_LIMIT,
  badgeOf,
  onError,
  placeholder = 'Search instances',
  width,
  inputId,
  noOptionsMessage = 'No instances found',
  disabled,
}: InstancePickerProps) => {
  const pending = useRef<ReturnType<typeof setTimeout>>();
  /** Settles the in-flight search when a newer keystroke replaces it. */
  const supersede = useRef<(() => void) | undefined>();
  /** Marks each search so a reply from a superseded one is dropped explicitly. */
  const generation = useRef(0);

  // Callers pass fresh `view`/`filter`/`onError` literals every render; primitives and
  // refs keep the callbacks below stable instead of reconfiguring the select each time.
  const filterKey = JSON.stringify(filter ?? null);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- filterKey stands in for filter by value
  const stableFilter = useMemo(() => filter, [filterKey]);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const { space: viewSpace, externalId: viewExternalId, version: viewVersion } = view ?? {};

  const search = useCallback(
    async (query: string): Promise<InstanceOption[]> => {
      if (!viewSpace || !viewExternalId || !viewVersion) {
        return [];
      }
      const searchView = { space: viewSpace, externalId: viewExternalId, version: viewVersion };
      const gen = ++generation.current;
      try {
        const request = buildInstanceSearchRequest(searchView, query, stableFilter, limit);
        const instances = await searchDMSInstances(connector, request);
        if (gen !== generation.current) {
          // Superseded while in flight; the newer search owns the dropdown now
          return [];
        }
        // A search after a failure clears the caller's error surface again.
        onErrorRef.current?.(null);
        return toInstanceOptions(instances, searchView);
      } catch (error) {
        if (gen !== generation.current) {
          return [];
        }
        onErrorRef.current?.(`Search failed: ${stringifyError(error)}`);
        return [];
      }
    },
    [connector, viewSpace, viewExternalId, viewVersion, stableFilter, limit]
  );

  const loadOptions = useCallback(
    (query: string) =>
      new Promise<InstanceOption[]>((resolve) => {
        // A superseded keystroke resolves empty rather than being abandoned: an
        // unsettled promise per character would leak for the life of the editor.
        supersede.current?.();
        clearTimeout(pending.current);
        const superseded = () => resolve([]);
        pending.current = setTimeout(() => resolve(search(query)), DEBOUNCE_MS);
        supersede.current = superseded;
      }),
    [search]
  );

  // A search still pending when the tab closes would otherwise fire a request for a
  // component that is gone.
  useEffect(
    () => () => {
      clearTimeout(pending.current);
      supersede.current?.();
    },
    []
  );

  const formatOptionLabel = useMemo(() => {
    if (!badgeOf) {
      return undefined;
    }
    return (option: InstanceOption) => {
      const badge = badgeOf(option.props ?? {});
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span>{option.label}</span>
          {badge && <Badge text={badge.text} color={badge.color} />}
        </span>
      );
    };
  }, [badgeOf]);

  const options = toStoredOptions(value);
  // Remount when the searched view or scope changes so `defaultOptions` refetch.
  const key = `${viewSpace}:${viewExternalId}:${viewVersion}:${filterKey}`;

  const shared = {
    key,
    loadOptions,
    defaultOptions: true,
    placeholder,
    width,
    inputId,
    noOptionsMessage,
    disabled,
    formatOptionLabel,
  };

  return multi ? (
    <AsyncMultiSelect
      {...shared}
      value={options}
      onChange={(selected: InstanceOption[]) =>
        onChange((selected ?? []).map(toPickedInstance))
      }
    />
  ) : (
    <AsyncSelect
      {...shared}
      isClearable
      value={options[0] ?? null}
      onChange={(selected: InstanceOption | null) =>
        onChange(selected ? [toPickedInstance(selected)] : [])
      }
    />
  );
};
