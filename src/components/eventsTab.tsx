import React, { useCallback, useEffect, useState } from 'react';
import {
  Button,
  CodeEditor,
  InlineFormLabel,
  LegacyForms,
  Switch,
  Segment,
  Tooltip,
} from '@grafana/ui';
import jsonlint from 'jsonlint-mod';
import { EventQuery, SelectedProps, EditorProps } from '../types';
import { EventFields } from '../constants';
import CogniteDatasource from '../datasource';
import { EventQueryHelp, EventAdvancedFilterHelp } from './queryHelp';
import { InlineButton } from './inlineButton';
import { ColumnPicker } from './columnPicker';

const { FormField } = LegacyForms;
const ActiveAtTimeRangeCheckbox = (props: SelectedProps) => {
  const { query, onQueryChange } = props;
  return (
    <div className="gf-form gf-form-inline">
      <InlineFormLabel
        tooltip="Fetch active events in the provided time range. This is essentially the same as writing the following query: events{activeAtTime={min=$__from, max=$__to}} "
        width={7}
      >
        Active only
      </InlineFormLabel>
      <div className="gf-form-switch">
        <Switch
          value={query.eventQuery.activeAtTimeRange}
          onChange={({ currentTarget }) =>
            onQueryChange({
              eventQuery: {
                ...query.eventQuery,
                activeAtTimeRange: currentTarget.checked,
              },
            })
          }
        />
      </div>
    </div>
  );
};
const ActiveAggregateCheckbox = ({ query, onQueryChange }: SelectedProps) => {
  return (
    <div className="gf-form gf-form-inline">
      <InlineFormLabel tooltip="Fetch with Aggregate count " width={10}>
        With Aggregate
      </InlineFormLabel>
      <div className="gf-form-switch">
        <Switch
          value={query.eventQuery.aggregate?.withAggregate}
          onChange={({ currentTarget }) =>
            onQueryChange({
              eventQuery: {
                ...query.eventQuery,
                aggregate: {
                  ...query.eventQuery.aggregate,
                  withAggregate: currentTarget.checked,
                },
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
    if (!query.eventQuery.aggregate?.properties?.length) {
      onQueryChange({
        eventQuery: {
          ...query.eventQuery,
          aggregate: {
            ...query.eventQuery.aggregate,
            properties: [],
          },
        },
      });
    }
  }, []);
  const properties = query.eventQuery.aggregate?.properties || [];
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
        {properties.map(({ property }, key) => (
          <>
            <Segment
              value={property}
              options={options}
              onChange={({ value }) => {
                onEventQueryChange({
                  aggregate: {
                    ...query.eventQuery.aggregate,
                    properties: properties.map((old, i) => (i === key ? { property: value } : old)),
                  },
                });
              }}
              allowCustomValue
            />
            <InlineButton
              onClick={() => {
                onEventQueryChange({
                  aggregate: {
                    ...query.eventQuery.aggregate,
                    properties: properties.filter((_, i) => i !== key),
                  },
                });
              }}
              iconName="times"
            />
          </>
        ))}
        <InlineButton
          onClick={() => {
            onEventQueryChange({
              aggregate: {
                ...query.eventQuery.aggregate,
                properties: [...properties, { property: 'type' }],
              },
            });
          }}
          iconName="plus-circle"
        />
      </div>
    </div>
  );
};
const AdvancedEventFilter = (props) => {
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
      {query.eventQuery.aggregate?.withAggregate && (
        <FieldsTypeColumnsPicker {...{ query, onQueryChange }} />
      )}
      {showHelp && <EventAdvancedFilterHelp onDismiss={() => setShowHelp(false)} />}
    </>
  );
};
export function EventsTab(
  props: SelectedProps & { datasource: CogniteDatasource } & Pick<EditorProps, 'onRunQuery'>
) {
  const options = EventFields.map((value) => ({ value, label: value }));
  const { query, onQueryChange, datasource } = props;
  const [showHelp, setShowHelp] = useState(false);
  const [value, setValue] = useState(query.eventQuery.expr);
  const { columns, aggregate } = query.eventQuery;
  useEffect(() => {
    if (aggregate?.withAggregate) {
      ['count', 'map'].map((v) => !columns.includes(v) && columns.push(v));
    }
  }, [aggregate]);
  const onEventQueryChange = (e: Partial<EventQuery>) => {
    onQueryChange({
      eventQuery: {
        ...query.eventQuery,
        ...e,
      },
    });
  };
  return (
    <>
      <div className="gf-form">
        <FormField
          label="Query"
          labelWidth={7}
          inputWidth={30}
          className="custom-query"
          onChange={({ target }) => setValue(target.value)}
          placeholder="events{}"
          onBlur={() =>
            onQueryChange({
              eventQuery: {
                ...query.eventQuery,
                expr: value,
              },
            })
          }
          value={value}
          tooltip="Click [?] button for help."
        />
        <Button variant="secondary" icon="question-circle" onClick={() => setShowHelp(!showHelp)} />
      </div>
      <ActiveAtTimeRangeCheckbox {...{ query, onQueryChange }} />
      <div className="gf-form">
        <InlineFormLabel
          tooltip="Choose which columns to display. To access metadata property, use 'metadata.propertyName'"
          width={7}
        >
          Columns
        </InlineFormLabel>
        <ColumnPicker {...{ columns, options, onQueryChange: onEventQueryChange }} />
      </div>
      {datasource.connector.isEventsAdvancedFilteringEnabled() && (
        <AdvancedEventFilter {...{ query, onQueryChange }} />
      )}
      {showHelp && <EventQueryHelp onDismiss={() => setShowHelp(false)} />}
    </>
  );
}
