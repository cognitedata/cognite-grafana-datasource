import React from 'react';
import { AsyncMultiSelect, Field, Input, Switch, Tooltip } from '@grafana/ui';
import { get, set } from 'lodash';
import CogniteDatasource from '../datasource';
import { SelectedProps } from './queryEditor';
import '../css/relationships.css';

const queryTypeSelector = 'relationshipsQuery';

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
  const { datasource, query, onQueryChange, selector, placeholder, queryBinder } = props;
  const route = queryBinder
    ? `${queryBinder}.${queryTypeSelector}.${selector.route}`
    : `${queryTypeSelector}.${selector.route}`;
  const s = route.split('.');
  return (
    <Field label={`Filter relations by ${selector.type}`} className="relationships-select">
      <AsyncMultiSelect
        loadOptions={() => datasource.relationshipsDatasource.getRelationshipsDropdowns(selector)}
        value={get(query, s)}
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
  props: SelectedProps & { datasource: CogniteDatasource } & { queryBinder: string | null }
) => {
  const { datasource, query, onQueryChange, queryBinder } = props;
  const route = queryBinder ? `${queryBinder}.${queryTypeSelector}` : `${queryTypeSelector}`;

  return (
    <div className="relationships-row">
      <MultiSelectAsync
        query={query}
        datasource={datasource}
        selector={dataSetIds}
        placeholder="Filter relations by datasets"
        onQueryChange={onQueryChange}
        queryBinder={queryBinder}
      />
      <MultiSelectAsync
        query={query}
        datasource={datasource}
        selector={labels}
        placeholder="Filter relations by Labels"
        onQueryChange={onQueryChange}
        queryBinder={queryBinder}
      />
      <Field label="Limit" className="relationships-item">
        <Tooltip content="Limit must been between 1 and 1000">
          <Input
            type="number"
            value={get(query, `${route}.limit`)}
            onChange={(targetValue) => {
              const { value } = targetValue.target as any;
              if (value < 1001 && value > 0) {
                return onQueryChange(set(query, `${route}.limit`, value));
              }
              return null;
            }}
            defaultValue={1000}
            max={1000}
          />
        </Tooltip>
      </Field>
      <Field label="Active at Time" className="relationships-item">
        <Switch
          value={get(query, `${route}.isActiveAtTime`)}
          onChange={({ currentTarget }) =>
            onQueryChange(set(query, `${route}.isActiveAtTime`, currentTarget.checked))
          }
        />
      </Field>
    </div>
  );
};
