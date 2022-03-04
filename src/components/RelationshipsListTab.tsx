import { MultiSelect } from '@grafana/ui';
import { isEqual, map } from 'lodash';
import React, { useState, useEffect } from 'react';

export const RelationshipsListTab = ({ query, onQueryChange, datasource }) => {
  const { relationsShipsQuery } = query;
  const [options, setOptions] = useState({ datasets: [], labels: [] });
  const [selectedOptions, setSelectedOptions] = useState({ datasets: [], labels: [] });
  const handleChange = (value, target) => {
    const { refId } = query;
    setSelectedOptions({ ...selectedOptions, [target]: value });
    if (isEqual(target, 'labels')) {
      onQueryChange({
        relationsShipsQuery: {
          ...relationsShipsQuery,
          labels: {
            containsAll: map(value, ({ value }) => ({ externalId: value })),
          },
          refId,
        },
      });
    } else {
      onQueryChange({
        relationsShipsQuery: {
          ...relationsShipsQuery,
          dataSetIds: map(value, ({ value }) => ({ id: value })),
          refId,
        },
      });
    }
  };
  const getDropdowns = async () => {
    const { labels, datasets } = await datasource.getRelationshipsDropdowns();
    setOptions({
      datasets,
      labels,
    });
  };
  useEffect(() => {
    getDropdowns();
  }, []);
  return (
    <div className="templateRow">
      <MultiSelect
        options={options.datasets}
        value={selectedOptions.datasets}
        allowCustomValue
        onChange={(value) => handleChange(value, 'datasets')}
        className="cognite-dropdown"
        placeholder="Filter relations by dataset"
        maxMenuHeight={150}
      />
      <MultiSelect
        options={options.labels}
        value={selectedOptions.labels}
        allowCustomValue
        onChange={(value) => handleChange(value, 'labels')}
        className="cognite-dropdown"
        placeholder="Filter relations by Label"
        maxMenuHeight={150}
      />
    </div>
  );
};
