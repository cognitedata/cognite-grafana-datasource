import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, CodeEditor, InlineFormLabel, Segment, Switch, Tooltip } from '@grafana/ui';
import jsonlint from 'jsonlint-mod';
import { EventQuery } from '../types';
import { EventAdvancedFilterHelp } from './queryHelp';
import { InlineButton, SelectedProps } from './queryEditor';

const ActiveAggregateCheckbox = ({ query, onQueryChange }: SelectedProps) => {
  return (
    <div className="gf-form gf-form-inline">
      <InlineFormLabel tooltip="Fetch with Aggregate count " width={10}>
        With Aggregate
      </InlineFormLabel>
      <div className="gf-form-switch">
        <Switch
          value={query.eventQuery.withAggregate}
          onChange={({ currentTarget }) =>
            onQueryChange({
              eventQuery: {
                ...query.eventQuery,
                withAggregate: currentTarget.checked,
              },
            })
          }
        />
      </div>
    </div>
  );
};
const FieldsTypeColumnsPicker = ({ query, onQueryChange }: SelectedProps) => {
  const options = [];
  useEffect(() => {
    if (!query.eventQuery.property?.length) {
      onQueryChange({
        eventQuery: {
          ...query.eventQuery,
          property: [],
        },
      });
    }
  }, []);
  const property = query.eventQuery.property || [];
  const onEventQueryChange = (e: Partial<EventQuery>) => {
    onQueryChange({
      eventQuery: {
        ...query.eventQuery,
        ...e,
      },
    });
  };
  return (
    <div className="gf-form">
      <InlineFormLabel tooltip="Choose which fields properties" width={10}>
        Field properties
      </InlineFormLabel>
      <div className="gf-form" style={{ flexWrap: 'wrap' }}>
        {property.map((val, key) => (
          <>
            <Segment
              value={val}
              options={options}
              onChange={({ value }) => {
                onEventQueryChange({
                  property: property.map((old, i) => (i === key ? value : old)),
                });
              }}
              allowCustomValue
            />
            <InlineButton
              onClick={() => {
                onEventQueryChange({
                  property: property.filter((_, i) => i !== key),
                });
              }}
              iconName="times"
            />
          </>
        ))}
        <InlineButton
          onClick={() => {
            onEventQueryChange({
              property: [...property, 'type'],
            });
          }}
          iconName="plus-circle"
        />
      </div>
    </div>
  );
};
export const AdvancedEventFilter = (props) => {
  const { query, onQueryChange } = props;
  const [eventQuery, setEventQuery] = useState(query.eventQuery);
  const [showHelp, setShowHelp] = useState(false);
  const patchEventQuery = useCallback(
    (eventQueryPatch: Partial<EventQuery>) => {
      setEventQuery({ ...eventQuery, ...eventQueryPatch });
    },
    [eventQuery]
  );
  useEffect(() => {
    onQueryChange({
      eventQuery,
    });
  }, [eventQuery]);
  const valid = (advancedFilter): boolean => {
    return jsonlint.parse(advancedFilter) ?? false;
  };
  const onChange = (advancedFilter) => {
    if (valid(advancedFilter)) patchEventQuery({ advancedFilter });
  };

  return (
    <>
      <div className="gf-form gf-form--grow">
        <Tooltip content="click here for more information">
          <Button
            variant="secondary"
            icon="question-circle"
            onClick={() => setShowHelp(!showHelp)}
          />
        </Tooltip>
        <span className="gf-form-label query-keyword fix-query-keyword width-8">
          Advanced Query
        </span>
        <CodeEditor
          value={query.eventQuery.advancedFilter ?? ''}
          language="json"
          height={200}
          width="80rem"
          showLineNumbers
          showMiniMap
          onBlur={onChange}
          onSave={onChange}
        />
      </div>
      <ActiveAggregateCheckbox {...{ query, onQueryChange }} />
      {query.eventQuery.withAggregate && <FieldsTypeColumnsPicker {...{ query, onQueryChange }} />}
      {showHelp && <EventAdvancedFilterHelp onDismiss={() => setShowHelp(false)} />}
    </>
  );
};
