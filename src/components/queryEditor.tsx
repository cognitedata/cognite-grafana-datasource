import defaults from 'lodash/defaults';

import React, { useState, useEffect, FormEvent } from 'react';
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
} from '../types';
import { failedResponseEvent, datapointsWarningEvent } from '../constants';
import '../css/query_editor.css';

const { FormField } = LegacyForms;
type Props = QueryEditorProps<CogniteDatasource, CogniteQuery, CogniteDataSourceOptions>;
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

const onQueryChange = (props: Props, patch: Partial<CogniteQuery>) => {
  const { query, onRunQuery, onChange } = props;
  onChange({ ...query, ...patch });
  onRunQuery();
};

const onAggregationChange = (props: Props, aggregation: string) => {
  onQueryChange(props, { aggregation });
};

const onGranularityChange = (props: Props, granularity: string) => {
  onQueryChange(props, { granularity });
};

const onLabelChange = (props: Props, label: string) => {
  onQueryChange(props, { label });
};

const onTagChange = (props: Props, target: number) => {
  onQueryChange(props, { target });
};

const onAssetQueryChange = (props: Props, assetQuery: CogniteQuery['assetQuery']) => {
  onQueryChange(props, { assetQuery });
};

const onCustomQueryChange = (props: Props, expr: string) => {
  onQueryChange(props, { expr });
};

const GranularityEditor = (props: Props) => {
  const { query } = props;
  return (
    query.aggregation &&
    query.aggregation !== 'none' && (
      <div className="gf-form">
        <FormField
          label="Granularity"
          labelWidth={6}
          inputWidth={10}
          onChange={(ev) => onGranularityChange(props, ev.target.value)}
          value={query.granularity}
          placeholder="default"
          tooltip="The granularity of the aggregate values. Valid entries are: 'day' (or 'd'), 'hour' (or 'h'), 'minute' (or 'm'), 'second' (or 's'). Example: 12h."
        />
      </div>
    )
  );
};

const AggregationEditor = (props: Props) => {
  const { query } = props;
  return (
    <div className="gf-form">
      <InlineFormLabel width={6}>Aggregation</InlineFormLabel>
      <Select
        onChange={({ value }) => onAggregationChange(props, value)}
        options={aggregateOptions}
        menuPosition="fixed"
        value={query.aggregation}
        className="width-10"
      />
    </div>
  );
};

const LabelEditor = (props: Props) => {
  const { query } = props;
  return (
    <div className="gf-form gf-form--grow">
      <FormField
        label="Label"
        labelWidth={6}
        inputWidth={10}
        onChange={({ target }) => onLabelChange(props, target.value)}
        value={query.label}
        placeholder="default"
        tooltip="Set the label for each time series. Can also access time series properties via {{property}}. Eg: {{description}}-{{metadata.key}}"
      />
    </div>
  );
};

const CommonEditors = (props: Props) => (
  <>
    {/* eslint-disable-next-line react/jsx-props-no-spreading  */}
    <AggregationEditor {...props} />
    {/* eslint-disable-next-line react/jsx-props-no-spreading  */}
    <GranularityEditor {...props} />
    {/* eslint-disable-next-line react/jsx-props-no-spreading  */}
    <LabelEditor {...props} />
  </>
);

const IncludeSubAssetsCheckbox = (props: Props) => {
  const { query } = props;
  const { includeSubtrees } = query.assetQuery;

  const onIncludeSubtreesChange = (checked: boolean) => {
    onAssetQueryChange(props, {
      ...query.assetQuery,
      includeSubtrees: checked,
    });
  };

  // FIXME: Styling of checkbox component
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

function AssetTab(props: Props) {
  const { query, datasource } = props;

  const [current, setCurrent] = useState<SelectableValue<string>>({
    value: query.assetQuery.target,
  });

  const fetchAndSetDropdownLabel = async (assetId: number) => {
    const [res] = await datasource.fetchSingleAsset(assetId);
    setCurrent(resource2DropdownOption(res));
  };

  useEffect(() => {
    onAssetQueryChange(props, {
      ...query.assetQuery,
      target: current.value,
    });
  }, [current.value]);

  useEffect(() => {
    if (current.value && !current.label) {
      fetchAndSetDropdownLabel(+current.value);
    }
  }, [current.value]);

  return (
    <div className="gf-form-inline">
      <div className="gf-form">
        <InlineFormLabel width={6}>Asset Tag</InlineFormLabel>
        <AsyncSelect
          loadOptions={(query) => datasource.getOptionsForDropdown(query, 'Asset')}
          value={current}
          placeholder="Search asset by name/description"
          className="width-20"
          onChange={setCurrent}
        />
      </div>
      {/* eslint-disable-next-line react/jsx-props-no-spreading  */}
      <IncludeSubAssetsCheckbox {...props} />
      {/* eslint-disable-next-line react/jsx-props-no-spreading  */}
      <CommonEditors {...props} />
    </div>
  );
}

function TimeseriesTab(props: Props) {
  const { query, datasource } = props;

  const [current, setCurrent] = useState<SelectableValue<string>>({
    value: query.target as string,
  });

  const fetchAndSetDropdownLabel = async (tsId: number) => {
    const [res] = await datasource.fetchSingleTimeseries(tsId);
    setCurrent(resource2DropdownOption(res));
  };

  useEffect(() => {
    onTagChange(props, +current.value);
  }, [current.value]);

  useEffect(() => {
    if (current.value && !current.label) {
      fetchAndSetDropdownLabel(+current.value);
    }
  }, [current.value]);

  return (
    <div className="gf-form-inline">
      <div className="gf-form">
        <InlineFormLabel width={6}>Tag</InlineFormLabel>
        <AsyncSelect
          loadOptions={(query) => datasource.getOptionsForDropdown(query, 'Timeseries')}
          value={current}
          placeholder="Search time series by name/description"
          className="width-20"
          onChange={setCurrent}
        />
      </div>
      {/* eslint-disable-next-line react/jsx-props-no-spreading  */}
      <CommonEditors {...props} />
    </div>
  );
}

function CustomTab(props: Props) {
  const { query, datasource, onRunQuery } = props;
  const [showHelp, setShowHelp] = useState(false);

  useEffect(onRunQuery, [query.expr]);

  return (
    <>
      <div className="gf-form">
        <FormField
          label="Query"
          labelWidth={6}
          inputWidth={30}
          onChange={(ev) => onCustomQueryChange(props, ev.target.value)}
          value={query.expr}
          tooltip="Click help button for help."
        />
        <Icon name="question-circle" onClick={() => setShowHelp(!showHelp)} />
      </div>
      <div className="gf-form-inline">
        {/* eslint-disable-next-line react/jsx-props-no-spreading  */}
        <CommonEditors {...props} />
      </div>
      {showHelp && customQueryHelp}
    </>
  );
}

export function QueryEditor(props: Props) {
  const { query } = props;
  const { tab } = defaults(query, defaultQuery);
  const { refId: thisRefId } = query;
  const [errorMessage, setErrorMessage] = useState('');
  const [warningMessage, setWarningMessage] = useState('');

  const onSelectTab = (tab: Tabs) => () => {
    props.onChange({ ...query, tab });
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
    setErrorMessage('');
    setWarningMessage('');
  }, [query]);

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
        {/* eslint-disable-next-line react/jsx-props-no-spreading  */}
        {tab === Tabs.Asset && <AssetTab {...props} />}
        {/* eslint-disable-next-line react/jsx-props-no-spreading  */}
        {tab === Tabs.Timeseries && <TimeseriesTab {...props} />}
        {/* eslint-disable-next-line react/jsx-props-no-spreading  */}
        {tab === Tabs.Custom && <CustomTab {...props} />}
      </TabContent>
      {errorMessage && <pre className="gf-formatted-error">{errorMessage}</pre>}
      {warningMessage && <pre className="gf-formatted-warning">{warningMessage}</pre>}
    </div>
  );
}
