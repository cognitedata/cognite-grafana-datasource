import { InlineFormLabel, MultiSelect, Switch } from '@grafana/ui';
import React, { useState, useEffect } from 'react';
import { RelationshipsQuerySelector } from '../types';
import CogniteDatasource from '../datasource';
import { SelectedProps } from './queryEditor';

export const RelationshipsListTab = (props: SelectedProps & { datasource: CogniteDatasource }) => {
  const { query, datasource, onQueryChange } = props;
  const { relationsShipsQuery } = query;
  const [options, setOptions] = useState<RelationshipsQuerySelector>({
    dataSetIds: [],
    labels: {
      containsAny: [],
    },
  });
  const [selectedOptions, setSelectedOptions] = useState<RelationshipsQuerySelector>({
    dataSetIds: [],
    labels: {
      containsAny: [],
    },
  });
  const handleChange = (values, target: string) => {
    setSelectedOptions({ ...selectedOptions, [target]: values });
    if (target === 'labels') {
      onQueryChange({
        relationsShipsQuery: {
          ...relationsShipsQuery,
          labels: {
            containsAny: values.map(({ value }) => ({ externalId: value })),
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
    const { labels, dataSetIds } = await datasource.getRelationshipsDropdowns(query.refId);
    setOptions({
      dataSetIds,
      labels,
    });
  };
  useEffect(() => {
    getDropdowns();
  }, []);
  return (
    <div className="full-width-row">
      <MultiSelect
        options={options.dataSetIds}
        value={selectedOptions.dataSetIds}
        allowCustomValue
        onChange={(value) => handleChange(value, 'dataSetIds')}
        className="cognite-dropdown"
        placeholder="Filter relations by dataset"
        maxMenuHeight={150}
      />
      <MultiSelect
        options={options.labels.containsAny}
        value={selectedOptions.labels.containsAny}
        allowCustomValue
        onChange={(value) => handleChange(value, 'labels')}
        className="cognite-dropdown"
        placeholder="Filter relations by Label"
        maxMenuHeight={150}
      />
      <InlineFormLabel tooltip="Fetch the latest relationship in the provided time range" width={8}>
        Active at Time
      </InlineFormLabel>
      <div className="gf-form-switch">
        <Switch
          css=""
          value={relationsShipsQuery.isActiveAtTime}
          onChange={({ currentTarget }) =>
            onQueryChange({
              relationsShipsQuery: {
                ...relationsShipsQuery,
                isActiveAtTime: currentTarget.checked,
              },
            })
          }
        />
      </div>
    </div>
  );
};
