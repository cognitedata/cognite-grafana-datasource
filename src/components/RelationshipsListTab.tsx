import { MultiSelect } from '@grafana/ui';
import React, { useState, useEffect } from 'react';

// FIX //
export const RelationshipsListTab = ({ query, onQueryChange, datasource }) => {
  const { relationsShipsQuery } = query;
  const [options, setOptions] = useState({ datasets: [], labels: [] });
  const [selectedOptions, setSelectedOptions] = useState({ datasets: [], labels: [] });
  const handleChange = (values, target) => {
    setSelectedOptions({ ...selectedOptions, [target]: values });
    if (target === 'labels') {
      onQueryChange({
        relationsShipsQuery: {
          ...relationsShipsQuery,
          labels: {
            containsAll: values.map(({ value }) => ({ externalId: value })),
          },
        },
      });
    } else {
      onQueryChange({
        relationsShipsQuery: {
          ...relationsShipsQuery,
          dataSetIds: values.map(({ value }) => ({ id: value })),
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
    <div className="full-width-row">
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
