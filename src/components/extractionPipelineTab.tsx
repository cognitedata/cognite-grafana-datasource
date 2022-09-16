import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AsyncMultiSelect, Field, Segment, Switch, Tooltip } from '@grafana/ui';
import _ from 'lodash';
import { ExtractionPipelineQuery } from '../types';
import { InlineButton, SelectedProps } from './queryEditor';
import CogniteDatasource from '../datasource';
import { EventFields, ExtractionPipelineFields, PipelineRunsFields } from '../constants';

export const ExtractionPipelineTab = (props: SelectedProps & { datasource: CogniteDatasource }) => {
  const options = EventFields.map((value) => ({ value, label: value }));
  const { query, onQueryChange, datasource } = props;
  const [extractionPipelineQuery, setExtractionPipelineQuery] = useState(
    query.extractionPipelineQuery
  );
  const { columns } = extractionPipelineQuery;
  const onExtractionPipelinesQueryChange = useCallback(
    (extractionPipelineQueryPatch: Partial<ExtractionPipelineQuery>) =>
      setExtractionPipelineQuery({ ...extractionPipelineQuery, ...extractionPipelineQueryPatch }),
    [extractionPipelineQuery]
  );
  useEffect(() => {
    onExtractionPipelinesQueryChange({
      columns: extractionPipelineQuery.getRuns ? PipelineRunsFields : ExtractionPipelineFields,
    });
  }, [extractionPipelineQuery.getRuns]);
  useEffect(() => {
    onQueryChange({
      extractionPipelineQuery,
    });
  }, [extractionPipelineQuery]);
  return (
    <div style={{ marginTop: 8 }}>
      <div className="gf-form-inline">
        <Field label="Collumns">
          <Tooltip content="Add or remove columns">
            <div className="gf-form" style={{ flexWrap: 'wrap' }}>
              {columns.map((val, key) => (
                <>
                  <Segment
                    value={val}
                    options={options}
                    onChange={({ value }) => {
                      onExtractionPipelinesQueryChange({
                        columns: columns.map((old, i) => (i === key ? value : old)),
                      });
                    }}
                    allowCustomValue
                  />
                  <InlineButton
                    onClick={() => {
                      onExtractionPipelinesQueryChange({
                        columns: columns.filter((_, i) => i !== key),
                      });
                    }}
                    iconName="times"
                  />
                </>
              ))}
              <InlineButton
                onClick={() => {
                  onExtractionPipelinesQueryChange({
                    columns: [...columns, `column${columns.length}`],
                  });
                }}
                iconName="plus-circle"
              />
            </div>
          </Tooltip>
        </Field>
      </div>
      <div className="gf-form-inline">
        <Field label="Extraction Pipeline ExternalId" className="">
          <Tooltip content="Enter or select Extraction Pipeline externalId">
            <AsyncMultiSelect
              loadOptions={() => {
                return datasource.extractionPipelineDatasource
                  .getExtractionPipelinesDropdowns(query.refId)
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
              value={extractionPipelineQuery.selection}
              defaultOptions
              allowCustomValue
              onChange={(values) => {
                return onExtractionPipelinesQueryChange({
                  selection: values,
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
              value={extractionPipelineQuery?.getRuns}
              onChange={() =>
                onExtractionPipelinesQueryChange({
                  getRuns: !extractionPipelineQuery?.getRuns,
                })
              }
            />
          </Tooltip>
        </Field>
      </div>
    </div>
  );
};
