import React from 'react';
import { Segment } from '@grafana/ui';
import { InlineButton } from './inlineButton';

export const ColumnPicker = ({ columns, options, onQueryChange }) => {
  return (
    <div className="gf-form" style={{ flexWrap: 'wrap' }}>
      {columns.map((val, key) => (
        <>
          <Segment
            value={val}
            options={options}
            onChange={({ value }) => {
              onQueryChange({
                columns: columns.map((old, i) => (i === key ? value : old)),
              });
            }}
            allowCustomValue
          />
          <InlineButton
            onClick={() => {
              onQueryChange({
                columns: columns.filter((_, i) => i !== key),
              });
            }}
            iconName="times"
          />
        </>
      ))}
      <InlineButton
        onClick={() => {
          onQueryChange({
            columns: [...columns, `column${columns.length}`],
          });
        }}
        iconName="plus-circle"
      />
    </div>
  );
};
