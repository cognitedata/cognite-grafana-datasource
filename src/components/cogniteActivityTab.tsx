import React, { useState, useEffect, useCallback } from 'react';
import {
  Select,
  InlineFieldRow,
  InlineField,
  InlineSwitch,
  InlineFormLabel,
  InlineSegmentGroup,
  Segment,
  Button,
} from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { SelectedProps, CogniteActivityResourceType, ActivitySortProp, EventsOrderDirection, CogniteActivityTabQuery, defaultCogniteActivityTabQuery } from '../types';
import {
  fetchDMSSpaces,
  fetchDMSViewProperties,
  stringifyError,
} from '../cdf/client';
import { InvolvedView } from '../types/dms';
import { Connector } from '../connector';
import { encodeInstanceRef, InstancePicker, PickedInstance } from './common/InstancePicker';
import { ViewPicker } from './common/ViewPicker';

interface CogniteActivityTabProps extends SelectedProps {
  connector: Connector;
}

const RESOURCE_TYPE_OPTIONS: Array<SelectableValue<CogniteActivityResourceType>> = [
  { label: 'CogniteAsset', value: 'CogniteAsset' },
  { label: 'CogniteEquipment', value: 'CogniteEquipment' },
  { label: 'CogniteTimeSeries', value: 'CogniteTimeSeries' },
];

const LABEL_WIDTH = 16;

const ActivityOrderDirectionEditor = ({
  onChange,
  direction = 'asc',
}: {
  direction: EventsOrderDirection;
  onChange: (val: EventsOrderDirection) => void;
}) => {
  const options = [
    { label: 'ascending', value: 'asc' as EventsOrderDirection },
    { label: 'descending', value: 'desc' as EventsOrderDirection },
  ];
  return (
    <InlineFieldRow>
      <InlineFormLabel width={6}>Order</InlineFormLabel>
      <Select
        onChange={({ value }) => onChange(value!)}
        options={options}
        menuPosition="fixed"
        value={direction}
        className="cog-mr-4 width-10"
      />
    </InlineFieldRow>
  );
};

interface ActivitySubProps {
  query: CogniteActivityTabQuery;
  onChange: (e: Partial<CogniteActivityTabQuery>) => void;
  fields: string[];
}

const ActiveOnlySwitch = ({ query, onChange, fields: _ }: ActivitySubProps) => (
  <InlineFieldRow>
    <InlineField
      label="Active only"
      labelWidth={LABEL_WIDTH}
      tooltip="Show only activities that are active (overlapping) within the current time range"
    >
      <InlineSwitch
        label="Active only"
        id="activity-active-only"
        value={query.activeOnly ?? true}
        onChange={({ currentTarget }) => onChange({ activeOnly: currentTarget.checked })}
      />
    </InlineField>
  </InlineFieldRow>
);

const ActivityColumnsPicker = ({ query, onChange, fields }: ActivitySubProps) => {
  const allOptions = fields.map((value) => ({ value, label: value }));
  const columns = query.columns ?? defaultCogniteActivityTabQuery.columns!;
  const addOptions = fields
    .filter((f) => !columns.includes(f))
    .map((value) => ({ value, label: value }));
  return (
    <InlineFieldRow>
      <InlineFormLabel tooltip="Choose which columns to display" width={LABEL_WIDTH}>
        Columns
      </InlineFormLabel>
      <InlineSegmentGroup>
        {columns.map((val, key) => (
          <React.Fragment key={key}>
            <Segment
              value={val}
              options={allOptions}
              onChange={({ value }) =>
                onChange({ columns: columns.map((old, i) => (i === key ? value! : old)) })
              }
              allowCustomValue
            />
            <Button
              variant="secondary"
              onClick={() => onChange({ columns: columns.filter((_, i) => i !== key) })}
              icon="times"
              className="cog-mr-4"
              data-testId={`activity-remove-col-${key}`}
            />
          </React.Fragment>
        ))}
        {addOptions.length > 0 && (
          <Segment
            value="+"
            options={addOptions}
            onChange={({ value }) => onChange({ columns: [...columns, value!] })}
            data-testId="activity-add-col"
          />
        )}
      </InlineSegmentGroup>
    </InlineFieldRow>
  );
};

const ActivitySortByPicker = ({ query, onChange, fields }: ActivitySubProps) => {
  const options = fields.map((value) => ({ value, label: value }));
  const sort: ActivitySortProp[] = query.sort ?? [];
  return (
    <InlineFieldRow>
      <InlineFormLabel tooltip="Property to sort results by" width={LABEL_WIDTH}>
        Sort by
      </InlineFormLabel>
      <InlineSegmentGroup>
        {sort.map((val, key) => (
          <React.Fragment key={key}>
            <Segment
              value={val.property}
              options={options}
              onChange={({ value }) =>
                onChange({ sort: sort.map((old, i) => (i === key ? { ...old, property: value! } : old)) })
              }
              allowCustomValue
            />
            <ActivityOrderDirectionEditor
              direction={val.order}
              onChange={(value) =>
                onChange({ sort: sort.map((old, i) => (i === key ? { ...old, order: value } : old)) })
              }
            />
            <Button
              variant="secondary"
              onClick={() => onChange({ sort: sort.filter((_, i) => i !== key) })}
              icon="times"
              className="cog-mr-4"
              data-testId={`activity-remove-sort-${key}`}
            />
          </React.Fragment>
        ))}
        {sort.length < 2 && (
          <Button
            variant="secondary"
            onClick={() => onChange({ sort: [...sort, { property: 'startTime', order: 'asc' }] })}
            icon="plus-circle"
            data-testId="activity-add-sort"
          />
        )}
      </InlineSegmentGroup>
    </InlineFieldRow>
  );
};

export const CogniteActivityTab: React.FC<CogniteActivityTabProps> = ({
  query,
  onQueryChange,
  connector,
}) => {
  const { cogniteActivityTabQuery } = query;
  const {
    space,
    externalId,
    version,
    resourceType,
    instanceView,
    instanceSpace,
    assetInstances,
  } = cogniteActivityTabQuery ?? {
    space: 'cdf_cdm',
    externalId: 'CogniteActivity',
    version: 'v1',
    resourceType: 'CogniteAsset' as CogniteActivityResourceType,
    instanceView: undefined,
    instanceSpace: '',
    assetInstances: [],
  };

  // The loaded instance views, lifted out of the picker to derive the default below.
  const [instanceViewCandidates, setInstanceViewCandidates] = useState<InvolvedView[]>([]);
  const [spaceOptions, setSpaceOptions] = useState<Array<SelectableValue<string>>>([]);
  const [loadingSpaces, setLoadingSpaces] = useState(false);
  const [viewProperties, setViewProperties] = useState<string[]>([]);

  // Queries saved before the instance view was persisted fall back to the cdf_cdm
  // standard view, or the first available one — the default the tab always applied.
  const effectiveInstanceView =
    instanceView ??
    instanceViewCandidates.find((v) => v.space === 'cdf_cdm') ??
    instanceViewCandidates[0] ??
    null;

  const loadViewProperties = useCallback(
    async (viewSpec: { space: string; externalId: string; version: string }) => {
      const props = await fetchDMSViewProperties(connector, viewSpec);
      setViewProperties(props);
    },
    [connector]
  );

  const loadSpaces = useCallback(async () => {
    try {
      setLoadingSpaces(true);
      const spaces = await fetchDMSSpaces(connector);
      setSpaceOptions([
        { label: 'All spaces', value: '' },
        ...spaces.map((s) => ({ label: s.space, value: s.space })),
      ]);
    } catch (err) {
      console.warn('Failed to load DMS spaces:', stringifyError(err));
    } finally {
      setLoadingSpaces(false);
    }
  }, [connector]);

  useEffect(() => {
    loadSpaces();
    if (space && externalId && version) {
      loadViewProperties({ space, externalId, version });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- intentional: load once on mount

  const selectedInstanceValues: PickedInstance[] = assetInstances.map((a) => ({
    value: encodeInstanceRef({ space: a.space, externalId: a.externalId }),
    space: a.space,
    externalId: a.externalId,
    name: a.name,
  }));

  const handleActivityViewsLoaded = (views: InvolvedView[]) => {
    if (views.length === 1) {
      const v = views[0];
      onQueryChange({
        cogniteActivityTabQuery: {
          ...cogniteActivityTabQuery,
          space: v.space,
          externalId: v.externalId,
          version: v.version,
        },
      });
    }
  };

  const handleActivityViewChange = (view: InvolvedView | null) => {
    if (view) {
      onQueryChange({
        cogniteActivityTabQuery: {
          ...cogniteActivityTabQuery,
          space: view.space,
          externalId: view.externalId,
          version: view.version,
        },
      });
      loadViewProperties(view);
    }
  };

  const handleResourceTypeChange = (selected: SelectableValue<CogniteActivityResourceType>) => {
    if (selected?.value) {
      setInstanceViewCandidates([]);
      onQueryChange({
        cogniteActivityTabQuery: {
          ...cogniteActivityTabQuery,
          resourceType: selected.value,
          instanceView: undefined,
          assetInstances: [],
        },
      });
    }
  };

  const handleInstanceViewChange = (view: InvolvedView | null) => {
    if (view) {
      // Persisted so the instances keep the view they were searched in across reloads
      onQueryChange({
        cogniteActivityTabQuery: {
          ...cogniteActivityTabQuery,
          instanceView: view,
          assetInstances: [],
        },
      });
    }
  };

  const handleSpaceChange = (selected: SelectableValue<string>) => {
    const newSpace = selected?.value ?? '';
    onQueryChange({
      cogniteActivityTabQuery: {
        ...cogniteActivityTabQuery,
        instanceSpace: newSpace,
        assetInstances: [],
      },
    });
  };

  const handleInstancesChange = (picked: PickedInstance[]) => {
    onQueryChange({
      cogniteActivityTabQuery: {
        ...cogniteActivityTabQuery,
        assetInstances: picked
          .filter((v) => v.space && v.externalId)
          .map((v) => ({
            space: v.space!,
            externalId: v.externalId!,
            name: v.name ?? v.externalId!,
          })),
      },
    });
  };

  const handleTabQueryChange = (partial: Partial<CogniteActivityTabQuery>) => {
    onQueryChange({ cogniteActivityTabQuery: { ...cogniteActivityTabQuery, ...partial } });
  };

  return (
    <>
      <InlineFieldRow>
        <InlineField
          label="Activity View"
          labelWidth={LABEL_WIDTH}
          tooltip="Select which CogniteActivity view to query"
        >
          <ViewPicker
            connector={connector}
            container="CogniteActivity"
            value={{ space, externalId, version }}
            onChange={handleActivityViewChange}
            onViewsLoaded={handleActivityViewsLoaded}
            placeholder="Select a CogniteActivity view"
            isClearable={false}
            width={40}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField
          label="Resource Type"
          labelWidth={LABEL_WIDTH}
          tooltip="Type of resource the activity is related to"
        >
          <Select
            options={RESOURCE_TYPE_OPTIONS}
            value={resourceType}
            onChange={handleResourceTypeChange}
            width={40}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField
          label="Instance View"
          labelWidth={LABEL_WIDTH}
          tooltip={`Select which ${resourceType} view to search instances in`}
        >
          <ViewPicker
            connector={connector}
            container={resourceType}
            value={effectiveInstanceView}
            onChange={handleInstanceViewChange}
            onViewsLoaded={setInstanceViewCandidates}
            placeholder={`Select a ${resourceType} view`}
            isClearable={false}
            width={40}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField
          label="Space"
          labelWidth={LABEL_WIDTH}
          tooltip="Filter instance search to a specific DMS space (leave empty to search all spaces)"
        >
          <Select
            options={spaceOptions}
            value={instanceSpace || ''}
            onChange={handleSpaceChange}
            isLoading={loadingSpaces}
            placeholder="All spaces"
            isClearable={false}
            width={40}
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField
          label="Instance(s)"
          labelWidth={LABEL_WIDTH}
          tooltip={`Select one or more ${resourceType} instances. Activities related to these will be shown.`}
        >
          <InstancePicker
            connector={connector}
            view={{
              space: effectiveInstanceView?.space ?? '',
              externalId: effectiveInstanceView?.externalId ?? '',
              version: effectiveInstanceView?.version ?? '',
            }}
            multi
            limit={100}
            filter={instanceSpace ? { inSpace: instanceSpace } : undefined}
            value={selectedInstanceValues}
            onChange={handleInstancesChange}
            placeholder={`Search ${resourceType} by name...`}
            width={40}
            noOptionsMessage="No instances found"
            inputId={`cognite-activity-instances-${query.refId}`}
          />
        </InlineField>
      </InlineFieldRow>
      <ActiveOnlySwitch query={cogniteActivityTabQuery} onChange={handleTabQueryChange} fields={viewProperties} />
      <ActivityColumnsPicker query={cogniteActivityTabQuery} onChange={handleTabQueryChange} fields={viewProperties} />
      <ActivitySortByPicker query={cogniteActivityTabQuery} onChange={handleTabQueryChange} fields={viewProperties} />
    </>
  );
};
