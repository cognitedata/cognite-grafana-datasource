import React from 'react';
import { Field, Input, Tooltip } from '@grafana/ui';
import { SelectedProps } from './queryEditor';
import CogniteDatasource from '../datasource';

export const ExtractionPipelineTab = (props: SelectedProps & { datasource: CogniteDatasource }) => {
  const { datasource, query, onQueryChange } = props;
  return (
    <div className="gf-form-inline">
      <Field label="ExternalId" className="">
        <Tooltip content="Enter externalId">
          <Input
            type="text"
            value={query.extractionPipelineQuery?.externalId || ''}
            placeholder="externalId"
            onChange={({ target }) => {
              console.log(target);
              /* return onQueryChange({
                extractionPipelineQuery: {
                  externalId: target,
                },
              }); */
            }}
          />
        </Tooltip>
      </Field>
    </div>
  );
};
