import { InlineFormLabel, Switch } from '@grafana/ui';
import React from 'react';
import { SelectedProps } from '../types';

export const LatestValueCheckbox = (props: SelectedProps) => {
  const { query, onQueryChange } = props;
  return (
    <div className="gf-form gf-form-inline">
      <InlineFormLabel tooltip="Fetch the latest data point in the provided time range" width={7}>
        Latest value
      </InlineFormLabel>
      <div className="gf-form-switch">
        <Switch
          value={query.latestValue}
          onChange={({ currentTarget }) => onQueryChange({ latestValue: currentTarget.checked })}
        />
      </div>
    </div>
  );
};
