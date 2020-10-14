import defaults from 'lodash/defaults';

import React, { ChangeEvent, PureComponent, useState } from 'react';
import { LegacyForms, Tab, TabsBar, TabContent } from '@grafana/ui';
import { QueryEditorProps, SelectableValue, GrafanaTheme } from '@grafana/data';
import CogniteDatasource from '../datasource';
import { defaultQuery, CogniteDataSourceOptions, MyQuery, Tab as Tabs } from '../types';

const { FormField } = LegacyForms;
type Props = QueryEditorProps<CogniteDatasource, MyQuery, CogniteDataSourceOptions>;

export function QueryEditor(props: Props) {
  const { query } = props;
  const queryOrDefault = defaults(query, defaultQuery);
  const { queryText, tab } = queryOrDefault;

  const [activeTab, setActiveTab] = useState(Tabs.Asset);

  /*
  const onQueryTextChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onChange, query } = this.props;
    onChange({ ...query, queryText: event.target.value });
  };

  const onConstantChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onChange, query, onRunQuery } = this.props;
    onChange({ ...query, constant: parseFloat(event.target.value) });
    // executes the query
    onRunQuery();
  };
  */

  return (
    <div>
      <TabsBar>
        {Object.values(Tabs).map((t) => (
          <Tab
            css=""
            label={t}
            key="first"
            active={activeTab === t}
            onChangeTab={() => setActiveTab(t)}
          />
        ))}
      </TabsBar>
      <TabContent>
        {activeTab === Tabs.Asset && <div>Asset tab content</div>}
        {activeTab === Tabs.Timeseries && <div>Timeseries tab content</div>}
        {activeTab === Tabs.Custom && <div>Custom tab content</div>}
      </TabContent>
    </div>
  );
}
