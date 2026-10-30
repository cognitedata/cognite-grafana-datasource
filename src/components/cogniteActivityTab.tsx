import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { EditorField, EditorFieldGroup, EditorRow, EditorRows } from '@grafana/plugin-ui';
import { RadioButtonGroup, Select } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import {
  SelectedProps,
  CogniteActivityResourceType,
  ActivitySortProp,
  CogniteActivityTabQuery,
  defaultCogniteActivityTabQuery,
  ALL_ACTIVITY_COLUMNS,
  LEGACY_ACTIVITY_COLUMNS,
} from '../types';
import { fetchDMSSpaces, fetchDMSView, stringifyError } from '../cdf/client';
import { DMSViewWithProperties, InvolvedView } from '../types/dms';
import { Connector } from '../connector';
import { encodeInstanceRef, InstancePicker, PickedInstance } from './common/InstancePicker';
import { ViewPicker } from './common/ViewPicker';
import { PropertySortEditor } from './common/PropertySortEditor';
import { PropertyColumnsField } from './common/PropertyColumnsField';
import { instancePropertyOptions, PropertyOption, viewPropertyOptions } from './records/shared';

interface CogniteActivityTabProps extends SelectedProps {
  connector: Connector;
}

const RESOURCE_TYPE_OPTIONS: Array<{ label: string; value: CogniteActivityResourceType; description: string }> = [
  { label: 'Assets', value: 'CogniteAsset', description: 'Activities related to CogniteAsset instances' },
  { label: 'Equipment', value: 'CogniteEquipment', description: 'Activities related to CogniteEquipment instances' },
  { label: 'Time series', value: 'CogniteTimeSeries', description: 'Activities related to CogniteTimeSeries instances' },
];

/** Which of the instances' activities are shown: the saved `activeOnly` flag. */
type Shown = 'active' | 'all';

const SHOWN_OPTIONS: Array<{ label: string; value: Shown; description: string }> = [
  { label: 'Active in time range', value: 'active', description: 'Activities that overlap the dashboard time range' },
  { label: 'All', value: 'all', description: 'Every activity related to the instances, whenever it was' },
];

/** Sorting is done client side, over the activities fetched; two keys suffice. */
const MAX_SORT_ROWS = 2;

/** A property a query was saved with that the view no longer lists, kept so it can be seen and removed. */
const unlistedOption = (value: string): PropertyOption => ({ value, label: value });

/**
 * Activities related to picked instances, laid out like the Records tab: the
 * activity view, then the instances the activities relate to, then which of their
 * activities are shown, then how the rows are sorted and which columns they show.
 */
export const CogniteActivityTab: React.FC<CogniteActivityTabProps> = ({
  query,
  onQueryChange,
  connector,
}) => {
  const cogniteActivityTabQuery = query.cogniteActivityTabQuery ?? defaultCogniteActivityTabQuery;
  const { space, externalId, version, resourceType, instanceView, instanceSpace, assetInstances } =
    cogniteActivityTabQuery;

  // The loaded instance views, lifted out of the picker to derive the default below.
  const [instanceViewCandidates, setInstanceViewCandidates] = useState<InvolvedView[]>([]);
  const [spaceOptions, setSpaceOptions] = useState<Array<SelectableValue<string>>>([]);
  const [loadingSpaces, setLoadingSpaces] = useState(false);
  const [activityView, setActivityView] = useState<DMSViewWithProperties | null>(null);
  // The view's properties, then the instance ones, then any a query was saved with.
  // Edges and reverse relations carry no stored type and never come back as values.
  const propertyOptionsOf = useMemo(
    () => [...viewPropertyOptions(activityView, (type) => !!type), ...instancePropertyOptions()],
    [activityView]
  );
  const withUnlisted = (names: string[]) => [
    ...propertyOptionsOf,
    ...names
      .filter((name) => name && !propertyOptionsOf.some((option) => option.value === name))
      .map(unlistedOption),
  ];

  // Queries saved before the instance view was persisted fall back to the cdf_cdm
  // standard view, or the first available one — the default the tab always applied.
  const effectiveInstanceView =
    instanceView ??
    instanceViewCandidates.find((v) => v.space === 'cdf_cdm') ??
    instanceViewCandidates[0] ??
    null;

  // Only the latest request is applied, so a slow earlier view never replaces it.
  const viewRequest = useRef(0);
  const loadViewProperties = useCallback(
    async (viewSpec: { space: string; externalId: string; version: string }) => {
      const request = ++viewRequest.current;
      // The previous view's properties are not offered while the new one loads.
      setActivityView(null);
      const view = await fetchDMSView(connector, viewSpec);
      if (request === viewRequest.current) {
        setActivityView(view);
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

  const patchTabQuery = (partial: Partial<CogniteActivityTabQuery>) =>
    onQueryChange({ cogniteActivityTabQuery: { ...cogniteActivityTabQuery, ...partial } });

  const handleActivityViewsLoaded = (views: InvolvedView[]) => {
    if (views.length !== 1) {
      return;
    }
    const v = views[0];
    if (v.space === space && v.externalId === externalId && v.version === version) {
      // Already saved: writing again would dirty the dashboard just by opening it
      return;
    }
    patchTabQuery({ space: v.space, externalId: v.externalId, version: v.version });
    loadViewProperties(v);
  };

  const handleActivityViewChange = (view: InvolvedView | null) => {
    if (view) {
      patchTabQuery({ space: view.space, externalId: view.externalId, version: view.version });
      loadViewProperties(view);
    }
  };

  const handleResourceTypeChange = (next: CogniteActivityResourceType) => {
    setInstanceViewCandidates([]);
    patchTabQuery({ resourceType: next, instanceView: undefined, assetInstances: [] });
  };

  const handleInstanceViewChange = (view: InvolvedView | null) => {
    if (view) {
      // Persisted so the instances keep the view they were searched in across reloads
      patchTabQuery({ instanceView: view, assetInstances: [] });
    }
  };

  const handleInstancesChange = (picked: PickedInstance[]) =>
    patchTabQuery({
      assetInstances: picked
        .filter((v) => v.space && v.externalId)
        .map((v) => ({
          space: v.space!,
          externalId: v.externalId!,
          name: v.name ?? v.externalId!,
        })),
    });

  const sort: ActivitySortProp[] = cogniteActivityTabQuery.sort ?? [];
  // Absent: the columns the tab always showed. '*': every property, shown as no chips.
  const savedColumns = cogniteActivityTabQuery.columns ?? LEGACY_ACTIVITY_COLUMNS;
  const allColumns = savedColumns.includes(ALL_ACTIVITY_COLUMNS);
  const columns = savedColumns.filter((column) => column !== ALL_ACTIVITY_COLUMNS);

  return (
    <EditorRows>
      <EditorRow>
        <EditorFieldGroup>
          <EditorField
            label="Activity view"
            tooltip="The CogniteActivity view the activities are read from."
            htmlFor={`activity-view-${query.refId}`}
          >
            <ViewPicker
              inputId={`activity-view-${query.refId}`}
              connector={connector}
              container="CogniteActivity"
              value={{ space, externalId, version }}
              onChange={handleActivityViewChange}
              onViewsLoaded={handleActivityViewsLoaded}
              placeholder="Select a CogniteActivity view"
              isClearable={false}
              width={44}
            />
          </EditorField>
        </EditorFieldGroup>
      </EditorRow>

      <EditorRow>
        <EditorFieldGroup>
          <EditorField
            label="Related to"
            tooltip="The type of instance the activities are related to: CogniteAsset, CogniteEquipment or CogniteTimeSeries."
          >
            <RadioButtonGroup
              options={RESOURCE_TYPE_OPTIONS}
              value={resourceType}
              onChange={handleResourceTypeChange}
              aria-label="Related to"
            />
          </EditorField>
          <EditorField
            label="Instance view"
            tooltip={`The ${resourceType} view the instances are searched in.`}
            htmlFor={`activity-instance-view-${query.refId}`}
          >
            <ViewPicker
              inputId={`activity-instance-view-${query.refId}`}
              connector={connector}
              container={resourceType}
              value={effectiveInstanceView}
              onChange={handleInstanceViewChange}
              onViewsLoaded={setInstanceViewCandidates}
              placeholder={`Select a ${resourceType} view`}
              isClearable={false}
              width={40}
            />
          </EditorField>
          <EditorField
            label="Space"
            optional
            tooltip="Narrows the instance search to one space."
            htmlFor={`activity-instance-space-${query.refId}`}
          >
            <Select
              inputId={`activity-instance-space-${query.refId}`}
              options={spaceOptions}
              value={instanceSpace || ''}
              onChange={({ value }) => patchTabQuery({ instanceSpace: value ?? '', assetInstances: [] })}
              isLoading={loadingSpaces}
              placeholder="All spaces"
              isClearable={false}
              width={24}
            />
          </EditorField>
        </EditorFieldGroup>
        <EditorFieldGroup>
          <EditorField
            label="Instances"
            tooltip={`The ${resourceType} instances whose activities are shown. Search by name.`}
            htmlFor={`cognite-activity-instances-${query.refId}`}
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
              width={44}
              noOptionsMessage="No instances found"
              inputId={`cognite-activity-instances-${query.refId}`}
            />
          </EditorField>
        </EditorFieldGroup>
      </EditorRow>

      <EditorRow>
        <EditorFieldGroup>
          <EditorField
            label="Show"
            tooltip={
              'Active in time range: the activities that overlap the dashboard time range, so those started ' +
              'before it ends and not ended before it starts. All: every activity related to the instances, ' +
              'whenever it took place.'
            }
          >
            <RadioButtonGroup
              options={SHOWN_OPTIONS}
              value={cogniteActivityTabQuery.activeOnly ?? true ? 'active' : 'all'}
              onChange={(next) => patchTabQuery({ activeOnly: next === 'active' })}
              aria-label="Show"
            />
          </EditorField>
        </EditorFieldGroup>
      </EditorRow>

      <EditorRow>
        <PropertySortEditor
          rows={sort.map(({ property, order }) => ({ property, direction: order }))}
          options={withUnlisted(sort.map(({ property }) => property))}
          max={MAX_SORT_ROWS}
          testIdPrefix="activity"
          newRow={{ property: 'startTime', direction: 'asc' }}
          tooltip="Properties to sort the activities by, in order."
          allowCustomValue
          onChange={(rows) => patchTabQuery({ sort: rows.map(({ property, direction }) => ({ property, order: direction })) })}
        />
        <PropertyColumnsField
          inputId={`activity-columns-${query.refId}`}
          columns={columns}
          options={withUnlisted(columns)}
          tooltip="The properties shown, in order. Removing them all shows every view property, then the instance properties."
          // A query saved with every column removed still shows only the related instances.
          placeholder={allColumns ? 'all properties' : 'related instances only'}
          optional
          allowCustomValue
          onChange={(next) => {
            // A typed '*' is not a property; every property is the empty field.
            const picked = next.filter((column) => column !== ALL_ACTIVITY_COLUMNS);
            patchTabQuery({ columns: picked.length ? picked : [ALL_ACTIVITY_COLUMNS] });
          }}
        />
      </EditorRow>
    </EditorRows>
  );
};
