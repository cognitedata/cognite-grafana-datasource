import defaults from 'lodash/defaults';
import React, { useState, useEffect } from 'react';
import {
  Tab,
  TabsBar,
  TabContent,
  InlineFormLabel,
  AsyncSelect,
  Button,
  InlineField,
  InlineFieldRow,
  Input,
  InlineSwitch
} from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { CustomQueryHelp } from './queryHelp';
import CogniteDatasource, { resource2DropdownOption } from '../datasource';
import {
  defaultQuery,
  CogniteQuery,
  Tab as Tabs,
  QueryRequestError,
  QueryWarning,
  TabTitles,
  EditorProps,
  SelectedProps,
  OnQueryChange,
} from '../types';
import { failedResponseEvent, responseWarningEvent } from '../constants';
import { ResourceSelect } from './resourceSelect';
import '../css/query_editor.css';
import '../css/common.css';
import { TemplatesTab } from './templatesTab';
import { RelationshipsTab } from './relationships';
import { ExtractionPipelinesTab } from './extractionPipelinesTab';
import { FlexibleDataModellingTab } from './flexibleDataModellingTab';
import { CommonEditors, LabelEditor } from './commonEditors';
import { EventsTab } from './eventsTab';
import { eventBusService } from '../appEventHandler';

const LatestValueCheckbox = (props: SelectedProps) => {
  const { query, onQueryChange } = props;
  return (
    <div className="gf-form gf-form-inline">
      <InlineFormLabel htmlFor='latest-value' tooltip="Fetch the latest data point in the provided time range" width={7}>
        Latest value
      </InlineFormLabel>
      <InlineSwitch
        label='Latest value'
        id='latest-value'
        value={query.latestValue}
        onChange={({ currentTarget }) => onQueryChange({ latestValue: currentTarget.checked })}
      />
    </div>
  );
};
const IncludeTimeseriesCheckbox = (props: SelectedProps) => {
  const { query, onQueryChange } = props;
  const { includeSubTimeseries } = query.assetQuery;
  return (
    <div className="gf-form">
      <InlineFormLabel htmlFor='include-sub-timeseries' width={11} tooltip="Fetch time series linked to the asset">
        Include sub-timeseries
      </InlineFormLabel>
      <InlineSwitch
        label='Include sub-timeseries'
        id='include-sub-timeseries'
        value={includeSubTimeseries !== false}
        onChange={({ currentTarget }) => {
          const { checked } = currentTarget;
          onQueryChange({
            assetQuery: {
              ...query.assetQuery,
              includeSubTimeseries: checked,
            },
          });
        }}
      />
    </div>
  );
};
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
      <InlineFormLabel htmlFor='include-sub-assets' width={9}>Include sub-assets</InlineFormLabel>
      <InlineSwitch
        label='Include sub-assets'
        value={includeSubtrees}
        id='include-sub-assets'
        onChange={({ currentTarget }) => onIncludeSubtreesChange(currentTarget.checked)}
      />
    </div>
  );
};
const IncludeRelationshipsCheckbox = (props: SelectedProps) => {
  const { query, onQueryChange } = props;
  const { withRelationships } = query.assetQuery;

  const onIncludeRelationshipsChange = (checked: boolean) => {
    onQueryChange({
      assetQuery: {
        ...query.assetQuery,
        withRelationships: checked,
      },
    });
  };

  return (
    <div className="gf-form">
      <InlineFormLabel htmlFor='include-relationships' tooltip="Fetch time series related to the asset" width={12}>
        Include relationships
      </InlineFormLabel>
      <InlineSwitch
        label='Include relationships'
        id='include-relationships'
        value={withRelationships}
        onChange={({ currentTarget }) => onIncludeRelationshipsChange(currentTarget.checked)}
      />
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
    if (current.value && !current.label) {
      fetchAndSetDropdownLabel(current.value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.value]);

  useEffect(() => {
    onQueryChange({
      assetQuery: {
        ...query.assetQuery,
        target: current.value,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.value, current.externalId]);
  useEffect(() => {
    if (query.assetQuery.withRelationships && current?.externalId) {
      onQueryChange({
        assetQuery: {
          ...query.assetQuery,
          relationshipsQuery: {
            ...query.assetQuery.relationshipsQuery,
            sourceExternalIds: [current.externalId],
          },
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.externalId, query.assetQuery.withRelationships]);
  return (
    <div className="gf-form-inline">
      <div className="gf-form">
        <InlineFormLabel htmlFor={'asset-select-dropdown'} width={6}>Asset Tag</InlineFormLabel>
        <AsyncSelect
          loadOptions={(query) => datasource.getOptionsForDropdown(query, 'Asset')}
          value={current}
          defaultOptions
          inputId='asset-select-dropdown'
          data-testid='asset-select-dropdown'
          placeholder="Search asset by name/description"
          className="cognite-dropdown width-20"
          allowCustomValue
          onChange={setCurrent}
        />
      </div>
      <IncludeSubAssetsCheckbox {...{ onQueryChange, query }} />
      <IncludeTimeseriesCheckbox {...{ onQueryChange, query }} />
      <LatestValueCheckbox {...{ query, onQueryChange }} />
      {query.latestValue ? (
        <LabelEditor {...{ onQueryChange, query }} />
      ) : (
        <CommonEditors {...{ query, onQueryChange }} />
      )}
      <IncludeRelationshipsCheckbox {...{ onQueryChange, query }} />
      {query.assetQuery.withRelationships && (
        <RelationshipsTab
          {...{
            query,
            datasource,
            onQueryChange,
            queryBinder: 'assetQuery',
          }}
        />
      )}
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
      <InlineFieldRow>
        <InlineField
          label="Query"
          tooltip="Click [?] button for help."
          grow
        >
          <Input
            type="text"
            value={value}
            placeholder="ts{externalIdPrefix='PT_123'}"
            onChange={(d) => setValue(d.currentTarget.value)}
            onBlur={() => onQueryChange({ expr: value })}
          />
        </InlineField>
        <InlineField>
          <Button variant="secondary" icon="question-circle" onClick={() => setShowHelp(!showHelp)} />
        </InlineField>
      </InlineFieldRow>
      <CommonEditors {...{ onQueryChange, query }} />
      {showHelp && <CustomQueryHelp onDismiss={() => setShowHelp(false)} />}
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
  const handleWarning = ({ refId, warning }: QueryWarning) => {
    if (thisRefId === refId) {
      setWarningMessage(warning);
    }
  };

  const eventsSubscribe = async () => {
    const appEvents = eventBusService;
    appEvents.on(failedResponseEvent, handleError);
    appEvents.on(responseWarningEvent, handleWarning);
  };

  const eventsUnsubscribe = async () => {
    const appEvents = eventBusService;
    appEvents.off(failedResponseEvent, handleError);
    appEvents.on(responseWarningEvent, handleWarning);
  };

  useEffect(() => {
    eventsSubscribe();
    return () => {
      eventsUnsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const hiddenTab = (t) => {
    if (t === Tabs.Templates) {
      return !datasource.connector.isTemplatesEnabled();
    }
    if (t === Tabs.FlexibleDataModelling) {
      return !datasource.connector.isFlexibleDataModellingEnabled();
    }
    if (t === Tabs.ExtractionPipelines) {
      return !datasource.connector.isExtractionPipelinesEnabled();
    }
    return false;
  };
  return (
    <div>
      <TabsBar>
        {Object.values(Tabs).map((t) => (
          <Tab
            hidden={hiddenTab(t)}
            label={TabTitles[t]}
            key={t}
            active={tab === t}
            onChangeTab={onSelectTab(t)}
            style={{ display: 'flex' }}
            suffix={
              t === Tabs.Templates || t === Tabs.ExtractionPipelines
                ? () => <p className="preview-label">Preview</p>
                : undefined
            }
          />
        ))}
      </TabsBar>
      <TabContent>
        {tab === Tabs.Asset && <AssetTab {...{ onQueryChange, query, datasource }} />}
        {tab === Tabs.Timeseries && <TimeseriesTab {...{ onQueryChange, query, datasource }} />}
        {tab === Tabs.Custom && <CustomTab {...{ onQueryChange, query, onRunQuery }} />}
        {tab === Tabs.Event && <EventsTab {...{ onQueryChange, query, onRunQuery, datasource }} />}
        {tab === Tabs.Relationships && (
          <RelationshipsTab {...{ query, datasource, onQueryChange, queryBinder: null }} />
        )}
        {tab === Tabs.ExtractionPipelines && (
          <ExtractionPipelinesTab {...{ onQueryChange, query, onRunQuery, datasource }} />
        )}
        {tab === Tabs.Templates && (
          <TemplatesTab {...{ onQueryChange, query, onRunQuery, datasource }} />
        )}
        {tab === Tabs.FlexibleDataModelling && (
          <FlexibleDataModellingTab {...{ onQueryChange, query, onRunQuery, datasource }} />
        )}
      </TabContent>
      {errorMessage && <pre className="gf-formatted-error">{errorMessage}</pre>}
      {warningMessage && <pre className="gf-formatted-warning">{warningMessage}</pre>}
    </div>
  );
}
