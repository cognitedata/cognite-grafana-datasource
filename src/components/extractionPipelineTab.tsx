import React from 'react';
import { AsyncMultiSelect, Field, Switch, Tooltip } from '@grafana/ui';
import _ from 'lodash';
import { SelectedProps } from './queryEditor';
import CogniteDatasource from '../datasource';

export const ExtractionPipelineTab = (props: SelectedProps & { datasource: CogniteDatasource }) => {
  const { query, onQueryChange, datasource } = props;
  return (
    <div className="gf-form-inline" style={{ marginTop: 8 }}>
      <Field label="Extraction Pipeline ExternalId" className="">
        <Tooltip content="Enter or select Extraction Pipeline externalId">
          <AsyncMultiSelect
            loadOptions={() => {
              return datasource.extractionPipelineDatasource
                .getExtractionPipelinesDropdowns()
                .then((response) => {
                  return _.sortBy(
                    _.map(response, ({ name, externalId, id }) => ({
                      value: externalId,
                      label: name.trim(),
                      id,
                    })),
                    ['label']
                  );
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
    </div>
  );
};
