import React, { useState, useEffect } from 'react';
import { SelectableValue } from '@grafana/data';
import { InlineFormLabel, Switch, AsyncSelect } from '@grafana/ui';
import CogniteDatasource, { resource2DropdownOption } from '../datasource';
import { SelectedProps } from '../types';
import { LatestValueCheckbox } from './latestValueCheckbox';
import { CommonEditors } from './commonEditors';
import { RelationshipsTab } from './relationships';
import { LabelEditor } from './labelEditor';

const IncludeTimeseriesCheckbox = (props: SelectedProps) => {
  const { query, onQueryChange } = props;
  const { includeSubTimeseries } = query.assetQuery;
  return (
    <div className="gf-form">
      <InlineFormLabel width={11} tooltip="Fetch time series linked to the asset">
        Include sub-timeseries
      </InlineFormLabel>
      <div className="gf-form-switch">
        <Switch
          value={includeSubTimeseries !== false}
          onChange={({ currentTarget }) => {
            const { checked } = currentTarget;
            onQueryChange({
              assetQuery: {
                ...query.assetQuery,
                includeSubTimeseries: checked,
              },
            });
          }}
        />
      </div>
    </div>
  );
};
const IncludeSubAssetsCheckbox = (props: SelectedProps) => {
  const { query, onQueryChange } = props;
  const { includeSubtrees } = query.assetQuery;

  const onIncludeSubtreesChange = (checked: boolean) => {
    onQueryChange({
      assetQuery: {
        ...query.assetQuery,
        includeSubtrees: checked,
      },
    });
  };

  return (
    <div className="gf-form">
      <InlineFormLabel width={9}>Include sub-assets</InlineFormLabel>
      <div className="gf-form-switch">
        <Switch
          value={includeSubtrees}
          onChange={({ currentTarget }) => onIncludeSubtreesChange(currentTarget.checked)}
        />
      </div>
    </div>
  );
};
const IncludeRelationshipsCheckbox = (props: SelectedProps) => {
  const { query, onQueryChange } = props;
  const { withRelationships } = query.assetQuery;

  const onIncludeRelationshipsChange = (checked: boolean) => {
    onQueryChange({
      assetQuery: {
        ...query.assetQuery,
        withRelationships: checked,
      },
    });
  };

  return (
    <div className="gf-form">
      <InlineFormLabel tooltip="Fetch time series related to the asset" width={12}>
        Include relationships
      </InlineFormLabel>
      <div className="gf-form-switch">
        <Switch
          value={withRelationships}
          onChange={({ currentTarget }) => onIncludeRelationshipsChange(currentTarget.checked)}
        />
      </div>
    </div>
  );
};

export function AssetTab(props: SelectedProps & { datasource: CogniteDatasource }) {
  const { query, datasource, onQueryChange } = props;

  const [current, setCurrent] = useState<SelectableValue<string>>({
    value: query.assetQuery.target,
  });

  const fetchAndSetDropdownLabel = async (idInput: string) => {
    const id = Number(idInput);
    if (Number.isNaN(id)) {
      setCurrent({ label: idInput, value: idInput });
    } else {
      const [res] = await datasource.fetchSingleAsset({ id });
      setCurrent(resource2DropdownOption(res));
    }
  };

  useEffect(() => {
    if (current.value && !current.label) {
      fetchAndSetDropdownLabel(current.value);
    }
  }, [current.value]);

  useEffect(() => {
    const relationshipsQuery = current.externalId
      ? {
          ...query.assetQuery.relationshipsQuery,
          sourceExternalIds: [current.externalId],
        }
      : null;
    onQueryChange({
      assetQuery: {
        ...query.assetQuery,
        relationshipsQuery,
        target: current.value,
      },
    });
  }, [current.value, current.externalId]);

  return (
    <div className="gf-form-inline">
      <div className="gf-form">
        <InlineFormLabel width={6}>Asset Tag</InlineFormLabel>
        <AsyncSelect
          loadOptions={(query) => datasource.getOptionsForDropdown(query, 'Asset')}
          value={current}
          defaultOptions
          placeholder="Search asset by name/description"
          className="cognite-dropdown width-20"
          allowCustomValue
          onChange={setCurrent}
        />
      </div>
      <IncludeSubAssetsCheckbox {...{ onQueryChange, query }} />
      <IncludeTimeseriesCheckbox {...{ onQueryChange, query }} />
      <LatestValueCheckbox {...{ query, onQueryChange }} />
      {query.latestValue ? (
        <LabelEditor {...{ onQueryChange, query }} />
      ) : (
        <CommonEditors {...{ query, onQueryChange }} />
      )}
      <IncludeRelationshipsCheckbox {...{ onQueryChange, query }} />
      {query.assetQuery.withRelationships && (
        <RelationshipsTab
          {...{
            query,
            datasource,
            onQueryChange,
            queryBinder: 'assetQuery',
          }}
        />
      )}
    </div>
  );
}
