import React from 'react';
import { LegacyForms } from '@grafana/ui';
import { SelectedProps } from '../types';

const { FormField } = LegacyForms;
export const LabelEditor = (props: SelectedProps) => {
  const { query, onQueryChange } = props;
  return (
    <div className="gf-form gf-form--grow">
      <FormField
        label="Label"
        labelWidth={6}
        inputWidth={10}
        onChange={({ target }) => onQueryChange({ label: target.value })}
        value={query.label}
        placeholder="default"
        tooltip="Set the label for each time series. Can also access time series properties via {{property}}. Eg: {{description}}-{{metadata.key}}"
      />
    </div>
  );
};
