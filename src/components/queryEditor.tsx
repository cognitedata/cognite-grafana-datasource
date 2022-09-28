import defaults from 'lodash/defaults';
import React, { useState, useEffect } from 'react';
import { Tab, TabsBar, TabContent } from '@grafana/ui';
import {
  defaultQuery,
  CogniteQuery,
  Tab as Tabs,
  QueryRequestError,
  QueryWarning,
  TabTitles,
  EditorProps,
  OnQueryChange,
} from '../types';
import { failedResponseEvent, responseWarningEvent } from '../constants';
import '../css/query_editor.css';
import '../css/common.css';
import { TemplatesTab } from './templatesTab';
import { RelationshipsTab } from './relationships';
import { ExtractionPipelinesTab } from './extractionPipelinesTab';
import { FlexibleDataModellingTab } from './flexibleDataModellingTab';
import { EventsTab } from './eventsTab';
import { AssetTab } from './assetTab';
import { CustomTab } from './customTab';
import { TimeseriesTab } from './timeseriesTab';
import { appEventsLoader } from '../appEventHandler';

export function QueryEditor(props: EditorProps) {
  const { query: queryWithoutDefaults, onChange, onRunQuery, datasource, data } = props;
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

  const tabId = (t) => {
    if (
      t === Tabs.Templates ||
      t === Tabs.FlexibleDataModelling ||
      t === Tabs.ExtractionPipelines
    ) {
      return 'preview-tab-label';
    }
    return '';
  };
  const hiddenTab = (t) => {
    if (t === Tabs.Templates) {
      return !datasource.connector.isTemplatesEnabled();
    }
    if (t === Tabs.FlexibleDataModelling) {
      return !datasource.connector.isFlexibleDataModellingEnabled();
    }
    if (t === Tabs.ExtractionPipelines) {
      return !datasource.connector.isExtractionPipalinesEnabled();
    }
    return false;
  };
  const tabClass = (t) => {
    if (t === Tabs.FlexibleDataModelling || t === Tabs.ExtractionPipelines)
      return { minWidth: '14em' };
    if (t === Tabs.Templates) return { minWidth: '10em' };
    return {};
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
            id={tabId(t)}
            style={tabClass(t)}
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
