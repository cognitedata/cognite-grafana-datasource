import defaults from 'lodash/defaults';
import React, { useState, useEffect } from 'react';
import {
  LegacyForms,
  Tab,
  TabsBar,
  TabContent,
  Select,
  InlineFormLabel,
  Icon,
  Switch,
  AsyncSelect,
  Segment,
  Button,
  AsyncMultiSelect,
} from '@grafana/ui';
import { QueryEditorProps } from '@grafana/data';
import { SystemJS } from '@grafana/runtime';
import { get, set } from 'lodash';
import { EventQueryHelp, CustomQueryHelp } from './queryHelp';
import CogniteDatasource from '../datasource';
import {
  defaultQuery,
  CogniteDataSourceOptions,
  CogniteQuery,
  Tab as Tabs,
  QueryRequestError,
  QueryWarning,
  CogniteTargetObj,
  CogniteQueryBase,
  EventQuery,
  TabTitles,
} from '../types';
import { failedResponseEvent, EventFields, responseWarningEvent } from '../constants';
import '../css/query_editor.css';
import { ResourceSelect } from './resourceSelect';
import '../css/common.css';

const { FormField } = LegacyForms;
type EditorProps = QueryEditorProps<CogniteDatasource, CogniteQuery, CogniteDataSourceOptions>;
type OnQueryChange = (
  patch: Partial<CogniteQueryBase> | CogniteTargetObj,
  shouldRunQuery?: boolean
) => void;
export type SelectedProps = Pick<EditorProps, 'query'> & { onQueryChange: OnQueryChange };
export type RelationshipSelectedProps = Pick<EditorProps, 'query'> & { handleRelationshipChange };
const appEventsLoader = SystemJS.load('app/core/app_events');

const aggregateOptions = [
  { value: 'none', label: 'None' },
  { value: 'average', label: 'Average' },
  { value: 'max', label: 'Max' },
  { value: 'min', label: 'Min' },
  { value: 'count', label: 'Count' },
  { value: 'sum', label: 'Sum' },
  { value: 'interpolation', label: 'Interpolation' },
  { value: 'stepInterpolation', label: 'Step Interpolation' },
  { value: 'continuousVariance', label: 'Continuous Variance' },
  { value: 'discreteVariance', label: 'Discrete Variance' },
  { value: 'totalVariation', label: 'Total Variation' },
];

const MultiSelectAsync = (props) => {
  const { datasource, query, onQueryChange, selector, placeholder } = props;
  const { refId } = query;
  return (
    <AsyncMultiSelect
      loadOptions={() => datasource.getRelationshipsDropdowns(refId, selector)}
      value={[...get(query, selector.rout)]}
      defaultOptions
      allowCustomValue
      onChange={(values) => onQueryChange(set(query, selector.rout, values))}
      placeholder={placeholder}
      maxMenuHeight={150}
    />
  );
};

const GranularityEditor = (props: SelectedProps) => {
  const { query, onQueryChange } = props;
  return (
    query.aggregation &&
    query.aggregation !== 'none' && (
      <div className="gf-form">
        <FormField
          label="Granularity"
          labelWidth={6}
          inputWidth={10}
          onChange={({ target }) => onQueryChange({ granularity: target.value })}
          value={query.granularity}
          placeholder="default"
          tooltip="The granularity of the aggregate values. Valid entries are: 'day' (or 'd'), 'hour' (or 'h'), 'minute' (or 'm'), 'second' (or 's'). Example: 12h."
        />
      </div>
    )
  );
};

const AggregationEditor = (props: SelectedProps) => {
  const { query, onQueryChange } = props;
  return (
    <div className="gf-form">
      <InlineFormLabel width={6}>Aggregation</InlineFormLabel>
      <Select
        onChange={({ value }) => onQueryChange({ aggregation: value })}
        options={aggregateOptions}
        menuPosition="fixed"
        value={query.aggregation}
        className="cognite-dropdown width-10"
      />
    </div>
  );
};

const LabelEditor = (props: SelectedProps) => {
  const { query, onQueryChange } = props;
  return (
    <div className="gf-form gf-form--grow">
      <FormField
        label="Label"
        labelWidth={6}
        inputWidth={10}
        onChange={({ target }) => onQueryChange({ label: target.value })}
        value={query.label}
        placeholder="default"
        tooltip="Set the label for each time series. Can also access time series properties via {{property}}. Eg: {{description}}-{{metadata.key}}"
      />
    </div>
  );
};

const LatestValueCheckbox = (props: SelectedProps) => {
  const { query, onQueryChange } = props;
  return (
    <div className="gf-form gf-form-inline">
      <InlineFormLabel tooltip="Fetch the latest data point in the provided time range" width={7}>
        Latest value
      </InlineFormLabel>
      <div className="gf-form-switch">
        <Switch
          css=""
          value={query.latestValue}
          onChange={({ currentTarget }) => onQueryChange({ latestValue: currentTarget.checked })}
        />
      </div>
    </div>
  );
};

const RelationshipCheckbox = (props: SelectedProps) => {
  const { query, onQueryChange } = props;
  return (
    <div className="gf-form gf-form-inline">
      <InlineFormLabel tooltip="Fetch the realationship" width={7}>
        Relationships
      </InlineFormLabel>
      <div className="gf-form-switch">
        <Switch
          css=""
          value={query.assetQuery.withRelationship}
          onChange={({ currentTarget }) =>
            onQueryChange({
              assetQuery: {
                ...query.assetQuery,
                withRelationship: currentTarget.checked,
              },
            })
          }
        />
      </div>
    </div>
  );
};

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
          css=""
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

const CommonEditors = ({ onQueryChange, query }: SelectedProps) => (
  <div className="gf-form-inline">
    <AggregationEditor {...{ onQueryChange, query }} />
    <GranularityEditor {...{ onQueryChange, query }} />
    <LabelEditor {...{ onQueryChange, query }} />
  </div>
);

const IncludeSubAssetsCheckbox = (props: SelectedProps) => {
  const { query, onQueryChange } = props;
  const { includeSubtrees } = query.assetQuery;

  const onIncludeSubtreesChange = (checked: boolean) => {
    onQueryChange({
      assetQuery: {
        ...query.assetQuery,
        includeSubtrees: checked,
      },
    });
  };

  return (
    <div className="gf-form">
      <InlineFormLabel width={9}>Include sub-assets</InlineFormLabel>
      <div className="gf-form-switch">
        <Switch
          value={includeSubtrees}
          onChange={({ currentTarget }) => onIncludeSubtreesChange(currentTarget.checked)}
          css=""
        />
      </div>
    </div>
  );
};

function AssetTab(props: SelectedProps & { datasource: CogniteDatasource }) {
  const { query, datasource, onQueryChange } = props;

  return (
    <div className="gf-form-inline">
      <div className="gf-form">
        <InlineFormLabel width={6}>Asset Tag</InlineFormLabel>
        <AsyncSelect
          loadOptions={(query) => datasource.getOptionsForDropdown(query, 'Asset')}
          value={query.assetQuery}
          defaultOptions
          placeholder="Search asset by name/description"
          className="cognite-dropdown width-20"
          allowCustomValue
          onChange={({ value, label, externalId }) => {
            onQueryChange({
              assetQuery: {
                ...query.assetQuery,
                target: value,
                assetExternalId: externalId,
                label,
                value,
              },
            });
          }}
        />
      </div>
      <IncludeSubAssetsCheckbox {...{ onQueryChange, query }} />
      <LatestValueCheckbox {...{ query, onQueryChange }} />
      <div className="gf-form">
        <InlineFormLabel width={9}>Child timeseries</InlineFormLabel>
        <div className="gf-form-switch">
          <Switch
            value={query.assetQuery.withDefaultCall}
            onChange={({ currentTarget }) =>
              onQueryChange({
                assetQuery: {
                  ...query.assetQuery,
                  withDefaultCall: currentTarget.checked,
                },
              })
            }
            css=""
          />
        </div>
      </div>

      {query.latestValue ? (
        <LabelEditor {...{ onQueryChange, query }} />
      ) : (
        <CommonEditors {...{ query, onQueryChange }} />
      )}
      <div>
        <RelationshipCheckbox {...{ query, onQueryChange }} />
        {query.assetQuery.withRelationship && (
          <RelationshipsListTab
            {...{
              query,
              onQueryChange,
              datasource,
              selectors: [
                {
                  rout: 'assetQuery.relationships.dataSetIds',
                  type: 'datasets',
                  keyPropName: 'id',
                },
                {
                  rout: 'assetQuery.relationships.labels.containsAny',
                  type: 'labels',
                  keyPropName: 'externalId',
                },
                'assetQuery.relationships.isActiveAtTime',
              ],
            }}
          />
        )}
      </div>
    </div>
  );
}

function TimeseriesTab(props: SelectedProps & { datasource: CogniteDatasource }) {
  const { query, datasource, onQueryChange } = props;

  return (
    <div>
      <ResourceSelect
        {...{
          query,
          onTargetQueryChange: onQueryChange,
          resourceType: Tabs.Timeseries,
          fetchSingleResource: datasource.fetchSingleTimeseries,
          searchResource: (query) => datasource.getOptionsForDropdown(query, Tabs.Timeseries),
        }}
      />
      <LatestValueCheckbox {...{ query, onQueryChange }} />
      {query.latestValue ? (
        <LabelEditor {...{ onQueryChange, query }} />
      ) : (
        <CommonEditors {...{ query, onQueryChange }} />
      )}
    </div>
  );
}

function CustomTab(props: SelectedProps & Pick<EditorProps, 'onRunQuery'>) {
  const { query, onQueryChange } = props;
  const [showHelp, setShowHelp] = useState(false);
  const [value, setValue] = useState(query.expr);

  return (
    <>
      <div className="gf-form">
        <FormField
          label="Query"
          labelWidth={6}
          inputWidth={30}
          className="custom-query"
          placeholder="ts{externalIdPrefix='PT_123'}"
          onChange={({ target }) => setValue(target.value)}
          onBlur={() => onQueryChange({ expr: value })}
          value={value}
          tooltip="Click [?] button for help."
        />
        <Button variant="secondary" icon="question-circle" onClick={() => setShowHelp(!showHelp)} />
      </div>
      <CommonEditors {...{ onQueryChange, query }} />
      {showHelp && <CustomQueryHelp onDismiss={() => setShowHelp(false)} />}
    </>
  );
}

function EventsTab(props: SelectedProps & Pick<EditorProps, 'onRunQuery'>) {
  const { query, onQueryChange } = props;
  const [showHelp, setShowHelp] = useState(false);
  const [value, setValue] = useState(query.eventQuery.expr);

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
      <ColumnsPicker {...{ query, onQueryChange }} />
      {showHelp && <EventQueryHelp onDismiss={() => setShowHelp(false)} />}
    </>
  );
}

const InlineButton = ({ onClick, iconName }) => {
  return (
    <div
      role="button"
      className="gf-form-label query-part"
      onClick={onClick}
      onKeyPress={onClick}
      tabIndex={0}
    >
      <Icon name={iconName} />
    </div>
  );
};

const ColumnsPicker = ({ query, onQueryChange }: SelectedProps) => {
  const options = EventFields.map((value) => ({ value, label: value }));
  const { columns } = query.eventQuery;

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
      <InlineFormLabel
        tooltip="Choose which columns to display. To access metadata property, use 'metadata.propertyName'"
        width={7}
      >
        Columns
      </InlineFormLabel>
      <div className="gf-form" style={{ flexWrap: 'wrap' }}>
        {columns.map((val, key) => (
          <>
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
            <InlineButton
              onClick={() => {
                onEventQueryChange({
                  columns: columns.filter((_, i) => i !== key),
                });
              }}
              iconName="times"
            />
          </>
        ))}
        <InlineButton
          onClick={() => {
            onEventQueryChange({
              columns: [...columns, `column${columns.length}`],
            });
          }}
          iconName="plus-circle"
        />
      </div>
    </div>
  );
};

const RelationshipsListTab = (
  props: SelectedProps & { datasource: CogniteDatasource } & { selectors }
) => {
  const { datasource, query, onQueryChange, selectors } = props;
  return (
    <div className={query.tab === Tabs.Relationships ? 'full-width-row' : ''}>
      <MultiSelectAsync
        query={query}
        datasource={datasource}
        selector={selectors[0]}
        placeholder="Filter relations by dataset"
        onQueryChange={onQueryChange}
      />
      <MultiSelectAsync
        query={query}
        datasource={datasource}
        selector={selectors[1]}
        placeholder="Filter relations by Label"
        onQueryChange={onQueryChange}
      />
      <div style={{ display: 'flex' }}>
        <InlineFormLabel tooltip="Fetch the latest relationship in the provided time range">
          Active at Time
        </InlineFormLabel>
        <div className="gf-form-switch">
          <Switch
            css=""
            value={get(query, selectors[2])}
            onChange={({ currentTarget }) =>
              onQueryChange(set(query, selectors[2], currentTarget.checked))
            }
          />
        </div>
      </div>
    </div>
  );
};

export function QueryEditor(props: EditorProps) {
  const { query: queryWithoutDefaults, onChange, onRunQuery, datasource } = props;
  const query = defaults(queryWithoutDefaults, defaultQuery);
  const { refId: thisRefId, tab } = query;
  const [errorMessage, setErrorMessage] = useState('');
  const [warningMessage, setWarningMessage] = useState('');

  const onQueryChange: OnQueryChange = (patch, shouldRunQuery = true) => {
    onChange({ ...query, ...patch } as CogniteQuery);
    if (shouldRunQuery) {
      setErrorMessage('');
      setWarningMessage('');
      onRunQuery();
    }
  };

  const onSelectTab = (tab: Tabs) => () => {
    onQueryChange({ tab });
  };

  const handleError = ({ refId, error }: QueryRequestError) => {
    if (thisRefId === refId) {
      setErrorMessage(error);
    }
  };
  const handleWarning = ({ refId, warning }: QueryWarning) => {
    if (thisRefId === refId) {
      setWarningMessage(warning);
    }
  };

  const eventsSubscribe = async () => {
    const appEvents = await appEventsLoader;
    appEvents.on(failedResponseEvent, handleError);
    appEvents.on(responseWarningEvent, handleWarning);
  };

  const eventsUnsubscribe = async () => {
    const appEvents = await appEventsLoader;
    appEvents.off(failedResponseEvent, handleError);
    appEvents.on(responseWarningEvent, handleWarning);
  };

  useEffect(() => {
    eventsSubscribe();
    return () => {
      eventsUnsubscribe();
    };
  }, [tab]);

  return (
    <div>
      <TabsBar>
        {Object.values(Tabs).map((t) => (
          <Tab
            label={TabTitles[t]}
            key={t}
            active={tab === t}
            onChangeTab={onSelectTab(t)}
            css=""
          />
        ))}
      </TabsBar>
      <TabContent>
        {tab === Tabs.Asset && <AssetTab {...{ onQueryChange, query, datasource }} />}
        {tab === Tabs.Timeseries && <TimeseriesTab {...{ onQueryChange, query, datasource }} />}
        {tab === Tabs.Custom && <CustomTab {...{ onQueryChange, query, onRunQuery }} />}
        {tab === Tabs.Event && <EventsTab {...{ onQueryChange, query, onRunQuery }} />}
        {tab === Tabs.Relationships && (
          <RelationshipsListTab
            {...{
              query,
              datasource,
              onQueryChange,
              selectors: [
                {
                  rout: 'relationsShipsQuery.dataSetIds',
                  type: 'datasets',
                  keyPropName: 'id',
                },
                {
                  rout: 'relationsShipsQuery.labels.containsAny',
                  type: 'labels',
                  keyPropName: 'externalId',
                },
                'relationsShipsQuery.isActiveAtTime',
              ],
            }}
          />
        )}
      </TabContent>
      {errorMessage && <pre className="gf-formatted-error">{errorMessage}</pre>}
      {warningMessage && <pre className="gf-formatted-warning">{warningMessage}</pre>}
    </div>
  );
}
