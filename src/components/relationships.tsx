import React from 'react';
import { AsyncMultiSelect, Field, Input, Switch } from '@grafana/ui';
import { get, set } from 'lodash';
import CogniteDatasource from '../datasource';
import { SelectedProps } from './queryEditor';
import '../css/relationships.css';

const dataSetIds = {
  route: 'dataSetIds',
  type: 'datasets',
  keyPropName: 'id',
};
const labels = {
  type: 'labels',
  keyPropName: 'externalId',
  route: 'labels.containsAny',
};

const MultiSelectAsync = (props) => {
  const { datasource, query, onQueryChange, selector, placeholder, queryTypeSelector } = props;
  const s = `${queryTypeSelector}.${selector.route}`.split('.');
  return (
    <Field label={`Filter relations by ${selector.type}`} className="relationships-select">
      <AsyncMultiSelect
        loadOptions={() => datasource.relationshipsDatasource.getRelationshipsDropdowns(selector)}
        value={[...get(query, s)]}
        defaultOptions
        allowCustomValue
        onChange={(values) => onQueryChange(set(query, s, values))}
        placeholder={placeholder}
        maxMenuHeight={150}
      />
    </Field>
  );
};
export const RelationshipsTab = (
  props: SelectedProps & { datasource: CogniteDatasource } & { queryTypeSelector: string }
) => {
  const { datasource, query, onQueryChange, queryTypeSelector } = props;

  return (
    <div className="relationships-row">
      <MultiSelectAsync
        query={query}
        datasource={datasource}
        selector={dataSetIds}
        placeholder="Filter relations by datasets"
        onQueryChange={onQueryChange}
        queryTypeSelector={queryTypeSelector}
      />
      <MultiSelectAsync
        query={query}
        datasource={datasource}
        selector={labels}
        placeholder="Filter relations by Labels"
        onQueryChange={onQueryChange}
        queryTypeSelector={queryTypeSelector}
      />
      <Field label="Limit" className="relationships-item">
        <Input
          type="number"
          value={get(query, `${queryTypeSelector}.limit`)}
          onChange={(value) =>
            onQueryChange(set(query, `${queryTypeSelector}.limit`, (value.target as any).value))
          }
          defaultValue={1000}
        />
      </Field>
      <Field label="Active at Time" className="relationships-item">
        <Switch
          value={get(query, `${queryTypeSelector}.isActiveAtTime`)}
          onChange={({ currentTarget }) =>
            onQueryChange(set(query, `${queryTypeSelector}.isActiveAtTime`, currentTarget.checked))
          }
        />
      </Field>
    </div>
  );
};
