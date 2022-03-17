import { MultiSelect } from '@grafana/ui';
import React, { useState, useEffect } from 'react';
import { get, set } from 'lodash';
import { SelectableValue } from '@grafana/data';
import { RelationshipsSelectableValue, RelationshipsQuery } from '../types';
import CogniteDatasource from '../datasource';
import { SelectedProps } from './queryEditor';

const relationshipQueryToSelectable = (
  relationsShipsQuery: RelationshipsQuery[],
  identifier: string
): SelectableValue[] => {
  return relationsShipsQuery.map((value) => ({
    value: value[identifier],
    text: value[identifier],
  }));
};

const selectedToQuery = (
  identifier: string,
  values: RelationshipsSelectableValue[]
): RelationshipsQuery[] => values.map(({ value }) => ({ [identifier]: value }));

const MultiSelectField = ({
  name,
  type,
  selector,
  datasource,
  relationsShipsQuery,
  onQueryChange,
  identifier,
  refId,
}) => {
  const [options, setOptions] = useState({ [selector]: [] });
  useEffect(() => {
    datasource.getRelationshipsDropdownOptions(type, selector, refId).then(setOptions);
  }, []);
  const handleChange = (values) => {
    onQueryChange({
      relationsShipsQuery: {
        ...set(relationsShipsQuery, selector, selectedToQuery(identifier, values)),
      },
    });
  };
  return (
    <MultiSelect
      options={options[selector]}
      value={relationshipQueryToSelectable(get(relationsShipsQuery, selector), identifier)}
      allowCustomValue
      onChange={handleChange}
      className="cognite-dropdown"
      placeholder={`Filter relations by ${name}`}
      maxMenuHeight={150}
    />
  );
};

export const RelationshipsListTab = (props: SelectedProps & { datasource: CogniteDatasource }) => {
  const { query, datasource, onQueryChange } = props;
  const { relationsShipsQuery } = query;
  const fieldSettings = [
    {
      type: 'datasets',
      name: 'Dataset',
      selector: 'dataSetIds',
      identifier: 'id',
    },
    {
      type: 'labels',
      name: 'Label',
      selector: 'labels.containsAll',
      identifier: 'externalId',
    },
  ];
  return (
    <div className="full-width-row">
      {fieldSettings.map(({ type, name, selector, identifier }) => (
        <MultiSelectField
          {...{
            name,
            type,
            selector,
            datasource,
            relationsShipsQuery,
            onQueryChange,
            identifier,
            refId: query.refId,
          }}
          key={type}
        />
      ))}
    </div>
  );
};
