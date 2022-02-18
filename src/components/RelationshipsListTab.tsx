import { MultiSelect, Select } from '@grafana/ui';
import { groupBy, isEqual, map, uniqBy, upperFirst } from 'lodash';
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
  const {
    relationsShipsQuery: { dataSetId, expr, labels },
  } = query;
  const [current, setCurrent] = useState([]);
  const [selecetedDataSetId, setSelecetedDataSetId] = useState(dataSetId);
  const [selectedSearchKey, setSelectedSearchKey] = useState('');
  const [selectedLabel, setSelectedLabel] = useState([]);
  const [labelsOptions, setLabelsOptions] = useState([]);
  const [customSearchValue, setCustomSearchValue] = useState([]);

  const handleChange = (value, selector) => {
    // onQueryChange({}, false);
  };

  // console.log(query);
  const getList = async () => {
    const r = await datasource.fetchRelationshipsList();
    const labels = [];
    map(r, (value) => {
      map(value.labels, ({ externalId }, key) => {
        labels.push({ value: externalId, label: externalId });
        // console.log(value);
      });
    });
    setCurrent(r);
    setLabelsOptions(uniqBy(labels, 'label'));
  };

  const mappedOptions = (selector) =>
    map(groupBy(current, selector), (value, label) => ({
      label,
      value: label,
    }));
  /* 
  useEffect(() => {
    getList();
  }, []); */
  return (
    <div>
      <div className="templateRow">
        <MultiSelect
          options={mappedOptions('dataSetId')}
          value={dataSetId}
          allowCustomValue
          onChange={(value) => handleChange(value, 'dataSetId')}
          className="cognite-dropdown"
          placeholder="Search relations by dataSetId"
          maxMenuHeight={150}
        />
        <MultiSelect
          options={labelsOptions}
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
          options={
            isEqual(selectedSearchKey, 'labels') ? labelsOptions : mappedOptions(selectedSearchKey)
          }
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
