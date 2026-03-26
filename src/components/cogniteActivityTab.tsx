import React, { useState, useEffect, useCallback } from 'react';
import { Select, AsyncMultiSelect, InlineFieldRow, InlineField } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { SelectedProps, CogniteActivityResourceType } from '../types';
import {
  fetchCogniteActivityViews,
  fetchCogniteAssetViews,
  fetchCogniteEquipmentViews,
  fetchCogniteTimeSeriesViews,
  fetchDMSSpaces,
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
    </>
  );
};
