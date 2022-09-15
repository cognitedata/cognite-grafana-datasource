import React, { useState } from 'react';
import { AsyncSelect, Field, Switch, Tooltip } from '@grafana/ui';
import _ from 'lodash';
import { SelectedProps } from './queryEditor';
import CogniteDatasource from '../datasource';

export const ExtractionPipelineTab = (props: SelectedProps & { datasource: CogniteDatasource }) => {
  const { query, onQueryChange, datasource } = props;
  const [error, setError] = useState(undefined);
  return (
    <div className="gf-form-inline" style={{ marginTop: 8 }}>
      <Field label="Extraction Pipeline ExternalId" className="">
        <Tooltip content="Enter or select Extraction Pipeline externalId">
          <AsyncSelect
            loadOptions={() => {
              return datasource.extractionPipelineDatasource
                .getExtractionPipelinesDropdowns()
                .then((response) => {
                  setError(undefined);
                  return _.sortBy(
                    _.map(response, ({ name, externalId, id }) => ({
                      value: externalId,
                      label: name.trim(),
                      id,
                    })),
                    ['label']
                  );
                })
                .catch((e) => {
                  setError(e.toString());
                  return [];
                });
            }}
            value={query.extractionPipelineQuery.selection}
            defaultOptions
            allowCustomValue
            onChange={(values) => {
              return onQueryChange({
                extractionPipelineQuery: {
                  ...query.extractionPipelineQuery,
                  selection: values,
                },
              });
            }}
            placeholder="Extraction Pipeline ExternalId"
            maxMenuHeight={150}
            filterOption={(option, searchQuery) =>
              _.includes(_.toLower(option.label), _.toLower(searchQuery))
            }
          />
        </Tooltip>
      </Field>
      <Field label="Show Extraction Pipeline Runs" className="gf-field-switch">
        <Tooltip content="Enable for Extraction Pipeline runs">
          <Switch
            value={query.extractionPipelineQuery?.getRuns}
            onChange={() =>
              onQueryChange({
                extractionPipelineQuery: {
                  ...query.extractionPipelineQuery,
                  getRuns: !query.extractionPipelineQuery?.getRuns,
                },
              })
            }
          />
        </Tooltip>
      </Field>
      {error && <pre className="gf-formatted-error">{error}</pre>}
    </div>
  );
};
