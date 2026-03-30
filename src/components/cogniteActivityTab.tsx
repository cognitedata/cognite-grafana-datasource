import React, { useState, useEffect, useCallback } from 'react';
import {
  Select,
  AsyncMultiSelect,
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
  fetchCogniteActivityViews,
  fetchCogniteAssetViews,
  fetchCogniteEquipmentViews,
  fetchCogniteTimeSeriesViews,
  fetchDMSSpaces,
  fetchDMSViewProperties,
  searchDMSInstances,
  stringifyError,
} from '../cdf/client';
import { DMSSearchRequest, InvolvedView } from '../types/dms';
import { Connector } from '../connector';

interface CogniteActivityTabProps extends SelectedProps {
  connector: Connector;
}

const RESOURCE_TYPE_OPTIONS: Array<SelectableValue<CogniteActivityResourceType>> = [
  { label: 'CogniteAsset', value: 'CogniteAsset' },
  { label: 'CogniteEquipment', value: 'CogniteEquipment' },
  { label: 'CogniteTimeSeries', value: 'CogniteTimeSeries' },
];

const LABEL_WIDTH = 16;

async function fetchViewsForResourceType(
  connector: Connector,
  resourceType: CogniteActivityResourceType
): Promise<InvolvedView[]> {
  switch (resourceType) {
    case 'CogniteEquipment':
      return fetchCogniteEquipmentViews(connector);
    case 'CogniteTimeSeries':
      return fetchCogniteTimeSeriesViews(connector);
    case 'CogniteAsset':
    default:
      return fetchCogniteAssetViews(connector);
  }
}

function viewToOption(view: InvolvedView): SelectableValue<InvolvedView> {
  return {
    label: `${view.externalId} (${view.space}) ${view.version}`,
    value: view,
    description: `Space: ${view.space}, Version: ${view.version}`,
  };
}

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
    instanceSpace,
    assetInstances,
  } = cogniteActivityTabQuery ?? {
    space: 'cdf_cdm',
    externalId: 'CogniteActivity',
    version: 'v1',
    resourceType: 'CogniteAsset' as CogniteActivityResourceType,
    instanceSpace: '',
    assetInstances: [],
  };

  const [activityViewOptions, setActivityViewOptions] = useState<Array<SelectableValue<InvolvedView>>>([]);
  const [loadingActivityViews, setLoadingActivityViews] = useState(false);
  const [instanceViewOptions, setInstanceViewOptions] = useState<Array<SelectableValue<InvolvedView>>>([]);
  const [loadingInstanceViews, setLoadingInstanceViews] = useState(false);
  const [selectedInstanceView, setSelectedInstanceView] = useState<InvolvedView | null>(null);
  const [spaceOptions, setSpaceOptions] = useState<Array<SelectableValue<string>>>([]);
  const [loadingSpaces, setLoadingSpaces] = useState(false);
  const [viewProperties, setViewProperties] = useState<string[]>([]);

  const loadViewProperties = useCallback(
    async (viewSpec: { space: string; externalId: string; version: string }) => {
      const props = await fetchDMSViewProperties(connector, viewSpec);
      setViewProperties(props);
    },
    [connector]
  );

  const loadActivityViews = useCallback(async () => {
    try {
      setLoadingActivityViews(true);
      const views = await fetchCogniteActivityViews(connector);
      const options = views.map(viewToOption);
      setActivityViewOptions(options);
      if (options.length === 1) {
        const v = options[0].value!;
        onQueryChange({
          cogniteActivityTabQuery: {
            ...cogniteActivityTabQuery,
            space: v.space,
            externalId: v.externalId,
            version: v.version,
          },
        });
      }
    } catch (err) {
      console.warn('Failed to load CogniteActivity views:', stringifyError(err));
    } finally {
      setLoadingActivityViews(false);
    }
  }, [connector, onQueryChange]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadInstanceViews = useCallback(
    async (type: CogniteActivityResourceType) => {
      try {
        setLoadingInstanceViews(true);
        const views = await fetchViewsForResourceType(connector, type);
        const options = views.map(viewToOption);
        setInstanceViewOptions(options);
        // Pick cdf_cdm standard view by default, fall back to first
        const preferred =
          views.find((v) => v.space === 'cdf_cdm') || views[0] || null;
        setSelectedInstanceView(preferred);
      } catch (err) {
        console.warn(`Failed to load ${type} views:`, stringifyError(err));
      } finally {
        setLoadingInstanceViews(false);
      }
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
    loadActivityViews();
    loadSpaces();
    loadInstanceViews(resourceType);
    if (space && externalId && version) {
      loadViewProperties({ space, externalId, version });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- intentional: load once on mount; resource type changes handled by handleResourceTypeChange

  const searchInstances = useCallback(
    async (inputValue: string) => {
      if (!selectedInstanceView) {
        return [];
      }
      try {
        const searchRequest: DMSSearchRequest = {
          view: {
            type: 'view',
            space: selectedInstanceView.space,
            externalId: selectedInstanceView.externalId,
            version: selectedInstanceView.version,
          },
          query: inputValue,
          filter: instanceSpace ? { inSpace: instanceSpace } : undefined,
          limit: 100,
        };
        const instances = await searchDMSInstances(connector, searchRequest);
        return instances.map((i) => {
          const props =
            i.properties?.[selectedInstanceView.space]?.[
              `${selectedInstanceView.externalId}/${selectedInstanceView.version}`
            ] ?? {};
          const name = props.name ?? i.externalId;
          return {
            label: name,
            value: `${i.space}:${i.externalId}`,
            description: `Space: ${i.space} | ExternalId: ${i.externalId}`,
            space: i.space,
            externalId: i.externalId,
          };
        });
      } catch (err) {
        console.warn('Failed to search instances:', stringifyError(err));
        return [];
      }
    },
    [connector, selectedInstanceView, instanceSpace]
  );

  const selectedActivityViewOption =
    activityViewOptions.find(
      (o) =>
        o.value?.space === space &&
        o.value?.externalId === externalId &&
        o.value?.version === version
    ) ?? null;

  const selectedInstanceViewOption =
    instanceViewOptions.find(
      (o) =>
        o.value?.space === selectedInstanceView?.space &&
        o.value?.externalId === selectedInstanceView?.externalId &&
        o.value?.version === selectedInstanceView?.version
    ) ?? null;

  const selectedInstanceValues = assetInstances.map((a) => ({
    label: a.name ?? a.externalId,
    value: `${a.space}:${a.externalId}`,
    space: a.space,
    externalId: a.externalId,
  }));

  const handleActivityViewChange = (selected: SelectableValue<InvolvedView>) => {
    if (selected?.value) {
      const v = selected.value;
      onQueryChange({
        cogniteActivityTabQuery: {
          ...cogniteActivityTabQuery,
          space: v.space,
          externalId: v.externalId,
          version: v.version,
        },
      });
      loadViewProperties(v);
    }
  };

  const handleResourceTypeChange = (selected: SelectableValue<CogniteActivityResourceType>) => {
    if (selected?.value) {
      onQueryChange({
        cogniteActivityTabQuery: {
          ...cogniteActivityTabQuery,
          resourceType: selected.value,
          assetInstances: [],
        },
      });
      loadInstanceViews(selected.value);
    }
  };

  const handleInstanceViewChange = (selected: SelectableValue<InvolvedView>) => {
    if (selected?.value) {
      setSelectedInstanceView(selected.value);
      onQueryChange({
        cogniteActivityTabQuery: {
          ...cogniteActivityTabQuery,
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

  const handleInstancesChange = (
    values: Array<SelectableValue & { space?: string; externalId?: string }>
  ) => {
    onQueryChange({
      cogniteActivityTabQuery: {
        ...cogniteActivityTabQuery,
        assetInstances: values
          .filter((v) => v.space && v.externalId)
          .map((v) => ({ space: v.space!, externalId: v.externalId!, name: v.label })),
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
          <Select
            options={activityViewOptions}
            value={selectedActivityViewOption}
            onChange={handleActivityViewChange}
            placeholder="Select a CogniteActivity view"
            isLoading={loadingActivityViews}
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
          <Select
            options={instanceViewOptions}
            value={selectedInstanceViewOption}
            onChange={handleInstanceViewChange}
            placeholder={`Select a ${resourceType} view`}
            isLoading={loadingInstanceViews}
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
          <AsyncMultiSelect
            key={`${selectedInstanceView?.space}:${selectedInstanceView?.externalId}:${selectedInstanceView?.version}:${instanceSpace}`}
            loadOptions={searchInstances}
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
