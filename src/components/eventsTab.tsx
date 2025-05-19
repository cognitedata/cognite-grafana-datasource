import React, { useCallback, useEffect, useState, ChangeEvent } from 'react';
import {
  Button,
  CodeEditor,
  InlineFormLabel,
  Label,
  InlineField,
  InlineFieldRow,
  FieldSet,
  Segment,
  Tooltip,
  Select,
  InlineSwitch,
  Input,
  InlineSegmentGroup,
  Icon,
  Field,
} from '@grafana/ui';
import jsonlint from 'jsonlint-mod';
import { EventQuery, SelectedProps, EditorProps, EventsOrderDirection } from '../types';
import { EventFields, EventSortByFields } from '../constants';
import CogniteDatasource from '../datasource';
import { EventQueryHelp, EventAdvancedFilterHelp } from './queryHelp';

const ActiveAtTimeRangeCheckbox = (props: SelectedProps) => {
  const { query, onQueryChange } = props;
  return (
    <InlineFieldRow>
      <InlineFormLabel
        htmlFor={`active-at-time-range-${query.refId}`}
        tooltip="Fetch active events in the provided time range. This is essentially the same as writing the following query: events{activeAtTime={min=$__from, max=$__to}} "
        width={7}
      >
        Active only
      </InlineFormLabel>
      <InlineSwitch
        label='Active only'
        id={`active-at-time-range-${query.refId}`}
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
    </InlineFieldRow>
  );
};
const ColumnsPicker = ({ query, onQueryChange }: SelectedProps) => {
  const options = EventFields.map((value) => ({ value, label: value }));
  const { columns, aggregate } = query.eventQuery;
  
  useEffect(() => {
    if (aggregate?.withAggregate) {
      ['count', 'map'].map((v) => !columns.includes(v) && columns.push(v));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    <InlineFieldRow>
      <InlineFormLabel
        tooltip="Choose which columns to display. To access metadata property, use 'metadata.propertyName'"
        width={7}
      >
        Columns
      </InlineFormLabel>
      <InlineSegmentGroup>
        {columns.map((val, key) => (
          <React.Fragment key={key}>
            <Segment
              value={val}
              options={options}
              onChange={({ value }) => {
                onEventQueryChange({
                  columns: columns.map((old, i) => (i === key ? value : old)),
                });
              }}
              allowCustomValue
            />
            <Button
              variant='secondary'
              onClick={() => {
                onEventQueryChange({
                  columns: columns.filter((_, i) => i !== key),
                });
              }}
              icon="times"
              data-testId={"event-remove-col-" + key}
            />
          </React.Fragment>
        ))}
        <Button
          variant='secondary'
          onClick={() => {
            onEventQueryChange({
              columns: [...columns, `column${columns.length}`],
            });
          }}
          icon="plus-circle"
          data-testId={"event-add-col"}
        />
      </InlineSegmentGroup>
    </InlineFieldRow>
  );
};

const OrderDirectionEditor = (
  { onChange, direction = "asc" }:
  { direction: EventsOrderDirection, onChange: (val: EventsOrderDirection) => void }
) => {
  const options = [{ label: "ascending", value: "asc" }, { label: "descending", value: "desc" }];
  return (
    <InlineFieldRow>
      <InlineFormLabel width={6}>Order</InlineFormLabel>
      <Select
        onChange={({ value }) => onChange(value as  EventsOrderDirection)}
        options={options}
        menuPosition="fixed"
        value={direction}
        className="cog-mr-4 width-10"
      />
    </InlineFieldRow>
  );
};


const SortByPicker = ({ query, onQueryChange }: SelectedProps ) => {
  const options = EventSortByFields.map((value) => ({ value, label: value }));
  const { sort = [] } = query.eventQuery;

  const onEventQueryChange = (e: Partial<EventQuery>) => {
    onQueryChange({
      eventQuery: {
        ...query.eventQuery,
        ...e,
      },
    });
  };

  return (
    <InlineFieldRow>
      <InlineFormLabel
        tooltip="Property to sort on. To access metadata property, use 'metadata.propertyName'"
        width={7}
      >
        Sort by
      </InlineFormLabel>
      <InlineSegmentGroup>
        {sort.map((val, key) => (
          <React.Fragment key={key}>
            <Segment
              value={val.property}
              options={options}
              onChange={({ value }) => {
                onEventQueryChange({
                  sort: sort.map((old, i) => (i === key ? { ...old, property: value } : old)),
                });
              }}
              allowCustomValue
            />
            <OrderDirectionEditor direction={val.order} onChange={value => {
                onEventQueryChange({
                  sort: sort.map((old, i) => (i === key ? { ...old, order: value } : old)),
                });
              }} />
            <Button
              variant='secondary'
              onClick={() => {
                onEventQueryChange({
                  sort: sort.filter((_, i) => i !== key),
                });
              }}
              icon="times"
              data-testId={"event-remove-sort-" + key}
            />
          </React.Fragment>
        ))}
        {sort?.length < 2 ? <Button
          variant='secondary'
          onClick={() => {
            onEventQueryChange({
              sort: [...sort, { property: 'type', order: 'asc' }],
            });
          }}
          icon="plus-circle"
          data-testId={"event-add-sort"}
        /> : null}
      </InlineSegmentGroup>
    </InlineFieldRow>
  );
};

const ActiveAggregateCheckbox = ({ query, onQueryChange }: SelectedProps) => {
  return (
    <InlineFieldRow>
      <InlineFormLabel htmlFor={`with-aggregate-${query.refId}`} tooltip="Fetch with Aggregate count " width={10}>
        With Aggregate
      </InlineFormLabel>
      <InlineSwitch
        id={`with-aggregate-${query.refId}`}
        label='With Aggregate'
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
    </InlineFieldRow>
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    <InlineFieldRow>
      <InlineFormLabel tooltip="Choose which fields properties" width={10}>
        Field properties
      </InlineFormLabel>
      <InlineSegmentGroup>
        {properties.map(({ property }, key) => (
          <React.Fragment key={key}>
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
            <Button
              variant='secondary'
              onClick={() => {
                onEventQueryChange({
                  aggregate: {
                    ...query.eventQuery.aggregate,
                    properties: properties.filter((_, i) => i !== key),
                  },
                });
              }}
              icon="times"
              data-testId={"event-remove-aggr-field-" + key}
            />
          </React.Fragment>
        ))}
        <Button
          variant='secondary'
          onClick={() => {
            onEventQueryChange({
              aggregate: {
                ...query.eventQuery.aggregate,
                properties: [...properties, { property: 'type' }],
              },
            });
          }}
          icon="plus-circle"
          data-testId={"event-add-aggr-field"}
        />
      </InlineSegmentGroup>
    </InlineFieldRow>
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventQuery]);
  const valid = (advancedFilter): boolean => {
    return jsonlint.parse(advancedFilter) ?? false;
  };
  const onChange = (advancedFilter) => {
    if (valid(advancedFilter)) {
      patchEventQuery({ advancedFilter });
    }
  };

  return (
    <>
      <FieldSet style={{ marginBottom: 8 }}>
        <Label
          title='Advanced filter'
          htmlFor={`advanced-filter-${query.refId}`}
          style={{ margin: 10 }}
        >
          <>
            Advanced filter
            <Tooltip content="click here for more information">
              <Icon style={{ margin: 5 }} name="question-circle" onClick={() => setShowHelp(!showHelp)} />
            </Tooltip>
          </>
        </Label>
        {showHelp && <EventAdvancedFilterHelp onDismiss={() => setShowHelp(false)} />}
        <Field aria-labelledby={`advanced-filter-${query.refId}`}>
          <CodeEditor
            value={query.eventQuery.advancedFilter ?? ''}
            language="json"
            height={200}
            showLineNumbers
            showMiniMap
            onBlur={onChange}
            onSave={onChange}
          />
        </Field>
      </FieldSet>
      <ActiveAggregateCheckbox {...{ query, onQueryChange }} />
      {query.eventQuery.aggregate?.withAggregate && (
        <FieldsTypeColumnsPicker {...{ query, onQueryChange }} />
      )}
    </>
  );
};
export function EventsTab(
  props: SelectedProps & { datasource: CogniteDatasource } & Pick<EditorProps, 'onRunQuery'>
) {
  const { query, onQueryChange, datasource } = props;
  const [showHelp, setShowHelp] = useState(false);
  const [value, setValue] = useState(query.eventQuery.expr);

  return (
    <>
      <InlineFieldRow>
        <InlineField
          label="Query"
          labelWidth={14}
          tooltip="Click [?] button for help."
        >
          <Input
            value={value}
            id={`event-query-${query.refId}`}
            width={30}
            placeholder="events{}"
            onChange={(e: ChangeEvent<HTMLInputElement>) => setValue(e.target.value)}
            onBlur={() =>
              onQueryChange({
                eventQuery: {
                  ...query.eventQuery,
                  expr: value,
                },
              })
            }
            className="custom-query"
          />
        </InlineField>
        <Button
          variant='secondary' icon="question-circle" onClick={() => setShowHelp(!showHelp)} data-testId="event-query-help" />
      </InlineFieldRow>
      {showHelp && <EventQueryHelp onDismiss={() => setShowHelp(false)} />}
      <ActiveAtTimeRangeCheckbox {...{ query, onQueryChange }} />
      <ColumnsPicker {...{ query, onQueryChange }} />
      <SortByPicker {...{ query, onQueryChange }} />
      {datasource.connector.isEventsAdvancedFilteringEnabled() && (
        <AdvancedEventFilter {...{ query, onQueryChange }} />
      )}
    </>
  );
}
