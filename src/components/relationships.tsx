import React from 'react';
import { AsyncMultiSelect, Field, Input, Switch, Tooltip } from '@grafana/ui';
import _ from 'lodash';
import CogniteDatasource from '../datasource';
import { SelectedProps } from './queryEditor';
import { EVENTS_PAGE_LIMIT } from '../constants';
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
    <Field label={`Filter relationships by ${selector.type}`} className="relationships-select">
      <AsyncMultiSelect
        loadOptions={() => datasource.relationshipsDatasource.getRelationshipsDropdowns(selector)}
        value={_.get(query, s)}
        defaultOptions
        allowCustomValue
        onChange={(values) => onQueryChange(_.set(query, s, values))}
        placeholder={placeholder}
        maxMenuHeight={150}
        filterOption={(option, searchQuery) =>
          _.includes(_.toLower(option.label), _.toLower(searchQuery))
        }
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
        placeholder="Filter relationships by datasets"
        onQueryChange={onQueryChange}
        queryBinder={queryBinder}
      />
      <MultiSelectAsync
        query={query}
        datasource={datasource}
        selector={labels}
        placeholder="Filter relationships by labels"
        onQueryChange={onQueryChange}
        queryBinder={queryBinder}
      />
      <Field label="Limit" className="relationships-item">
        <Tooltip content="Limit must been between 1 and 1000">
          <Input
            type="number"
            value={_.get(query, `${route}.limit`)}
            onChange={(targetValue) => {
              const { value } = targetValue.target as any;
              if (value <= EVENTS_PAGE_LIMIT && value > 0) {
                return onQueryChange(_.set(query, `${route}.limit`, value));
              }
              return null;
            }}
            defaultValue={EVENTS_PAGE_LIMIT}
            max={EVENTS_PAGE_LIMIT}
          />
        </Tooltip>
      </Field>
      <Field label="Active at Time" className="relationships-item">
        <Switch
          value={_.get(query, `${route}.isActiveAtTime`)}
          onChange={({ currentTarget }) =>
            onQueryChange(_.set(query, `${route}.isActiveAtTime`, currentTarget.checked))
          }
        />
      </Field>
    </div>
  );
};
