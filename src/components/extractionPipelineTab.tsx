import React, { useCallback, useEffect, useState } from 'react';
import { AsyncMultiSelect, Field, Segment, Switch, Tooltip } from '@grafana/ui';
import _ from 'lodash';
import { ExtractionPipelineQuery, SelectedProps } from '../types';
import CogniteDatasource from '../datasource';
import { EventFields } from '../constants';
import { InlineButton } from './inlineButton';

export const ExtractionPipelineTab = (props: SelectedProps & { datasource: CogniteDatasource }) => {
  const options = EventFields.map((value) => ({ value, label: value }));
  const { query, onQueryChange, datasource } = props;
  const [extractionPipelineQuery, setExtractionPipelineQuery] = useState(
    query.extractionPipelineQuery
  );
  const onExtractionPipelinesQueryChange = useCallback(
    (extractionPipelineQueryPatch: Partial<ExtractionPipelineQuery>) =>
      setExtractionPipelineQuery({ ...extractionPipelineQuery, ...extractionPipelineQueryPatch }),
    [extractionPipelineQuery]
  );
  useEffect(() => {
    onQueryChange({
      extractionPipelineQuery,
    });
  }, [extractionPipelineQuery]);
  const { columns, selection, getRuns } = extractionPipelineQuery;
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
              value={selection}
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
              value={getRuns}
              onChange={() =>
                onExtractionPipelinesQueryChange({
                  getRuns: !getRuns,
                })
              }
            />
          </Tooltip>
        </Field>
      </div>
    </div>
  );
};
