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
} from '@grafana/ui';
import { QueryEditorProps, SelectableValue } from '@grafana/data';
import { SystemJS } from '@grafana/runtime';
import { customQueryHelp } from './queryHelp';
import CogniteDatasource, { resource2DropdownOption } from '../datasource';
import {
  defaultQuery,
  CogniteDataSourceOptions,
  CogniteQuery,
  Tab as Tabs,
  QueryRequestError,
  QueryDatapointsWarning,
  CogniteTargetObj,
  CogniteQueryBase,
} from '../types';
import { failedResponseEvent, datapointsWarningEvent } from '../constants';
import '../css/query_editor.css';
import { ResourceSelect } from './resourceSelect';
import '../css/common.css';

const { FormField } = LegacyForms;
type EditorProps = QueryEditorProps<CogniteDatasource, CogniteQuery, CogniteDataSourceOptions>;
type OnQueryChange = (
  patch: Partial<CogniteQueryBase> | CogniteTargetObj,
  shouldRunQuery?: boolean
) => void;
type SelectedProps = Pick<EditorProps, 'query'> & { onQueryChange: OnQueryChange };
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
        className="width-10"
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
    <div className="gf-form-inline">
      <InlineFormLabel width={9}>Latest value</InlineFormLabel>
      <div className="gf-form-switch">
        <Switch
          css=""
          value={query.latestValue}
          onChange={({ currentTarget }) => onQueryChange({ latestValue: currentTarget.checked })}
        />
      </div>
      {query.latestValue && (
        <FormField
          label="Before"
          labelWidth={6}
          inputWidth={10}
          onChange={({ target }) => onQueryChange({ before: target.value })}
          value={query.before}
          placeholder="now"
          tooltip="Get data points before this time. The format is N[timeunit]-ago where timeunit is w,d,h,m,s. Example: '2d-ago' gets data that is up to 2 days old. You can also specify time in milliseconds since epoch. Use $__to to fetch the latest data point before the end of selected time range."
        />
      )}
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
          css=""
          value={includeSubtrees}
          onChange={({ currentTarget }) => onIncludeSubtreesChange(currentTarget.checked)}
        />
      </div>
    </div>
  );
};

function AssetTab(props: SelectedProps & { datasource: CogniteDatasource }) {
  const { query, datasource, onQueryChange } = props;

  const [current, setCurrent] = useState<SelectableValue<string>>({
    value: query.assetQuery.target,
  });

  const fetchAndSetDropdownLabel = async (idInput: string) => {
    const id = Number(idInput);
    if (Number.isNaN(id)) {
      setCurrent({ label: idInput, value: idInput });
    } else {
      const [res] = await datasource.fetchSingleAsset({ id });
      setCurrent(resource2DropdownOption(res));
    }
  };

  useEffect(() => {
    onQueryChange({
      assetQuery: {
        ...query.assetQuery,
        target: current.value,
      },
    });
  }, [current.value]);

  useEffect(() => {
    if (current.value && !current.label) {
      fetchAndSetDropdownLabel(current.value);
    }
  }, [current.value]);

  return (
    <div className="gf-form-inline">
      <div className="gf-form">
        <InlineFormLabel width={6}>Asset Tag</InlineFormLabel>
        <AsyncSelect
          loadOptions={(query) => datasource.getOptionsForDropdown(query, 'Asset')}
          value={current}
          defaultOptions
          placeholder="Search asset by name/description"
          className="width-20"
          allowCustomValue
          onChange={setCurrent}
        />
      </div>
      <IncludeSubAssetsCheckbox {...{ onQueryChange, query }} />
      <CommonEditors {...{ onQueryChange, query }} />
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
      {!query.latestValue && <CommonEditors {...{ query, onQueryChange }} />}
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
          onChange={({ target }) => setValue(target.value)}
          onBlur={() => onQueryChange({ expr: value })}
          value={value}
          tooltip="Click help button for help."
        />
        <Icon name="question-circle" onClick={() => setShowHelp(!showHelp)} />
      </div>
      <CommonEditors {...{ onQueryChange, query }} />
      {showHelp && customQueryHelp}
    </>
  );
}

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
  const handleWarning = ({ refId, warning }: QueryDatapointsWarning) => {
    if (thisRefId === refId) {
      setWarningMessage(warning);
    }
  };

  const eventsSubscribe = async () => {
    const appEvents = await appEventsLoader;
    appEvents.on(failedResponseEvent, handleError);
    appEvents.on(datapointsWarningEvent, handleWarning);
  };

  const eventsUnsubscribe = async () => {
    const appEvents = await appEventsLoader;
    appEvents.off(failedResponseEvent, handleError);
    appEvents.off(datapointsWarningEvent, handleWarning);
  };

  useEffect(() => {
    eventsSubscribe();
    return () => eventsUnsubscribe();
  }, [tab]);

  return (
    <div>
      <TabsBar>
        {Object.values(Tabs).map((t) => (
          <Tab css="" label={t} key={t} active={tab === t} onChangeTab={onSelectTab(t)} />
        ))}
      </TabsBar>
      <TabContent>
        {tab === Tabs.Asset && <AssetTab {...{ onQueryChange, query, datasource }} />}
        {tab === Tabs.Timeseries && <TimeseriesTab {...{ onQueryChange, query, datasource }} />}
        {tab === Tabs.Custom && <CustomTab {...{ onQueryChange, query, onRunQuery }} />}
      </TabContent>
      {errorMessage && <pre className="gf-formatted-error">{errorMessage}</pre>}
      {warningMessage && <pre className="gf-formatted-warning">{warningMessage}</pre>}
    </div>
  );
}
