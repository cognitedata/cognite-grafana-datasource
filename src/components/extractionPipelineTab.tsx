import React from 'react';
import { Field, Input, Tooltip } from '@grafana/ui';
import { SelectedProps } from './queryEditor';

export const ExtractionPipelineTab = (props: SelectedProps) => {
  const { query, onQueryChange } = props;
  return (
    <div className="gf-form-inline" style={{ marginTop: 8 }}>
      <Field label="ExternalId" className="">
        <Tooltip content="Enter externalId">
          <Input
            type="text"
            value={query.extractionPipelineQuery?.externalId || ''}
            placeholder="externalId"
            onChange={(e) => {
              const target = e.target as HTMLInputElement;
              return onQueryChange({
                extractionPipelineQuery: {
                  externalId: target.value,
                },
              });
            }}
          />
        </Tooltip>
      </Field>
    </div>
  );
};
