import React, { useCallback, useEffect, useState } from 'react';
import { AsyncMultiSelect, Field, Input, Segment, Switch, Tooltip } from '@grafana/ui';
import _ from 'lodash';
import { ExtractionPipelinesQuery, SelectedProps } from '../types';
import CogniteDatasource from '../datasource';
import { EVENTS_PAGE_LIMIT, ExtractionPipelinesFields } from '../constants';
import { InlineButton } from './inlineButton';

export const ExtractionPipelinesTab = (
  props: SelectedProps & { datasource: CogniteDatasource }
) => {
  const options = ExtractionPipelinesFields.map((value) => ({ value, label: value }));
  const { query, onQueryChange, datasource } = props;
  const [extractionPipelinesQuery, setExtractionPipelinesQuery] = useState(
    query.extractionPipelinesQuery
  );
  const onExtractionPipelinesQueryChange = useCallback(
    (extractionPipelinesQueryPatch: Partial<ExtractionPipelinesQuery>) =>
      setExtractionPipelinesQuery({
        ...extractionPipelinesQuery,
        ...extractionPipelinesQueryPatch,
      }),
    [extractionPipelinesQuery]
  );
  useEffect(() => {
    onQueryChange({
      extractionPipelinesQuery,
    });
  }, [extractionPipelinesQuery]);
  const { columns, selections, getRuns, limit } = extractionPipelinesQuery;
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
                return datasource.extractionPipelinesDatasource
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
              value={selections}
              defaultOptions
              allowCustomValue
              onChange={(values) => {
                return onExtractionPipelinesQueryChange({
                  selections: values,
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
        <Field label="Limit" className="">
          <Tooltip content="change limit to response value max 1000">
            <Input
              type="number"
              value={limit}
              onChange={(targetValue) => {
                const { value } = targetValue.target as any;
                if (value <= EVENTS_PAGE_LIMIT && value > 0) {
                  return onExtractionPipelinesQueryChange({ limit: value });
                }
                return null;
              }}
              defaultValue={EVENTS_PAGE_LIMIT}
              max={EVENTS_PAGE_LIMIT}
            />
          </Tooltip>
        </Field>
      </div>
    </div>
  );
};
