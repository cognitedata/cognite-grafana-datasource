import { MultiSelect, Select } from '@grafana/ui';
import { flatMapDeep, get, isEqual, map, reduce, set, upperFirst } from 'lodash';
import React, { useState, useEffect } from 'react';

const selectors = [
  'dataSetId',
  'externalId',
  'labels',
  'sourceExternalId',
  'sourceType',
  'targetExternalId',
  'targetType',
];

export const RelationshipsListTab = ({ query, onQueryChange, datasource }) => {
  const { relationsShipsQuery } = query;
  const [configs, setConfigs] = useState(
    reduce(
      selectors,
      (result, value) => {
        set(result, [value], []);
        return result;
      },
      {}
    )
  );
  const [selectedDataSetId, setSelectedDataSetId] = useState([]);
  const [selectedSearchKey, setSelectedSearchKey] = useState('');
  const [selectedLabel, setSelectedLabel] = useState([]);
  const [customSearchValue, setCustomSearchValue] = useState([]);
  const handleChange = (value, selector) => {
    // onQueryChange({}, false);
  };

  // console.log(query);
  const getList = async () => {
    const { settings } = await datasource.createRelationshipsNode();
    setConfigs(settings);
  };
  const mappedLabes = flatMapDeep(get(configs, 'labels'), (_) =>
    map(_, ({ externalId }) => ({
      label: upperFirst(externalId),
      value: externalId,
    }))
  );
  const mappedOptions = (selector) => {
    return isEqual(selector, 'labels')
      ? mappedLabes
      : map(get(configs, selector), (value: any) => ({ label: upperFirst(value), value }));
  };
  useEffect(() => {
    getList();
  }, []);
  return (
    <div>
      <div className="templateRow">
        <MultiSelect
          options={mappedOptions('dataSetId')}
          value={selectedDataSetId}
          allowCustomValue
          onChange={(value) => handleChange(value, 'dataSetId')}
          className="cognite-dropdown"
          placeholder="Search relations by dataSetId"
          maxMenuHeight={150}
        />
        <MultiSelect
          options={mappedLabes}
          value={selectedLabel}
          allowCustomValue
          onChange={setSelectedLabel}
          className="cognite-dropdown"
          placeholder="Search relations by Labale"
          maxMenuHeight={150}
        />
      </div>
      <div className="templateRow">
        <Select
          prefix="Select key for search: "
          options={map(selectors, (value) => ({ value, label: upperFirst(value) }))}
          onChange={({ value }) => {
            setSelectedSearchKey(value);
          }}
          className="width-20"
          value={selectedSearchKey}
          maxMenuHeight={150}
        />
        <MultiSelect
          options={mappedOptions(selectedSearchKey)}
          value={customSearchValue}
          placeholder="Search value"
          className="cognite-dropdown"
          allowCustomValue
          onChange={setCustomSearchValue}
          maxMenuHeight={150}
        />
      </div>
    </div>
  );
};
