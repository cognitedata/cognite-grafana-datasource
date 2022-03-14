import { MultiSelect } from '@grafana/ui';
import React, { useState, useEffect } from 'react';
import { RelationshipSelectableValue, RelationshipsQuerySelector } from '../types';
import CogniteDatasource from '../datasource';
import { SelectedProps } from './queryEditor';

export const RelationshipsListTab = (props: SelectedProps & { datasource: CogniteDatasource }) => {
  const { query, datasource, onQueryChange } = props;
  const { relationsShipsQuery } = query;
  const [options, setOptions] = useState<RelationshipsQuerySelector>({ datasets: [], labels: [] });
  const [selectedOptions, setSelectedOptions] = useState<RelationshipsQuerySelector>({
    datasets: [],
    labels: [],
  });
  const handleChange = (values: RelationshipSelectableValue[], target: string) => {
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
          datasets: values.map(({ value }) => ({ id: value })),
        },
      });
    }
  };
  const getDropdowns = async () => {
    const { labels, datasets } = await datasource.getRelationshipsDropdowns(query.refId);
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
