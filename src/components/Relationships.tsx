import React from 'react';
import { AsyncMultiSelect, InlineFormLabel, Switch } from '@grafana/ui';
import { get, set } from 'lodash';
import CogniteDatasource from '../datasource';
import { SelectedProps } from './queryEditor';

const MultiSelectAsync = (props) => {
  const { datasource, query, onQueryChange, selector, placeholder } = props;
  const { refId } = query;
  const s = selector.rout.split('.');
  return (
    <AsyncMultiSelect
      loadOptions={() => datasource.getRelationshipsDropdowns(refId, selector)}
      value={[...get(query, s)]}
      defaultOptions
      allowCustomValue
      onChange={(values) => onQueryChange(set(query, s, values))}
      placeholder={placeholder}
      maxMenuHeight={150}
    />
  );
};
export const Relationships = (
  props: SelectedProps & { datasource: CogniteDatasource } & { selectors } & { className }
) => {
  const { datasource, query, onQueryChange, selectors, className } = props;
  return (
    <div className={className}>
      <MultiSelectAsync
        query={query}
        datasource={datasource}
        selector={selectors[0]}
        placeholder="Filter relations by dataset"
        onQueryChange={onQueryChange}
      />
      <MultiSelectAsync
        query={query}
        datasource={datasource}
        selector={selectors[1]}
        placeholder="Filter relations by Label"
        onQueryChange={onQueryChange}
      />
      <div style={{ display: 'flex' }}>
        <InlineFormLabel tooltip="Fetch the latest relationship in the provided time range">
          Active at Time
        </InlineFormLabel>
        <div className="gf-form-switch">
          <Switch
            css=""
            value={get(query, selectors[2])}
            onChange={({ currentTarget }) =>
              onQueryChange(set(query, selectors[2], currentTarget.checked))
            }
          />
        </div>
      </div>
    </div>
  );
};
