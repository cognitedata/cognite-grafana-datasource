import defaults from 'lodash/defaults';
import mapValues from 'lodash/mapValues';
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
  InlineSwitch,
  useTheme2,
} from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { CustomQueryHelp } from './queryHelp';
import CogniteDatasource, { resource2DropdownOption } from '../datasource';
import {
  defaultQuery,
  CogniteQuery,
  Tab as Tabs,
  TabTitles,
  EditorProps,
  SelectedProps,
  OnQueryChange,
  RecordsQuery,
} from '../types';
import { ResourceSelect } from './resourceSelect';
import { selectPlaceholderEllipsis } from './common/selectPlaceholder';
import '../css/query_editor.css';
import { DEPRECATED_CHIP_TEXT, DeprecatedChip, DeprecationNotice } from './common/DeprecationNotice';
import { TemplatesTab } from './templatesTab';
import { RelationshipsTab } from './relationships';
import { ExtractionPipelinesTab } from './extractionPipelinesTab';
import { FlexibleDataModellingTab } from './flexibleDataModellingTab';
import { CogniteTimeSeriesSearchTab } from './cogniteTimeSeriesSearchTab';
import { CogniteActivityTab } from './cogniteActivityTab';
import { RecordsTab } from './recordsTab';
import { SyntheticTimeSeriesTab } from './syntheticTimeSeriesTab';
import { CommonEditors, LabelRow } from './commonEditors';
import { EventsTab } from './eventsTab';
import { useQueryWarnings } from './useQueryMessages';
import { FormattedMessage } from './common/Styled';
import { isTabDisabled, isTabHidden, getActiveTab } from '../queryEditorUtils';

const LatestValueCheckbox = (props: SelectedProps) => {
  const { query, onQueryChange } = props;
  return (
    <InlineFieldRow>
      <InlineField
        label="Latest value"
        labelWidth={14}
        tooltip="Fetch the latest data point in the provided time range"
      >
        <InlineSwitch
          label='Latest value'
          id={`latest-value-${query.refId}`}
          value={query.latestValue}
          onChange={({ currentTarget }) => onQueryChange({ latestValue: currentTarget.checked })}
        />
      </InlineField>
    </InlineFieldRow>
  );
};
const IncludeTimeseriesCheckbox = (props: SelectedProps) => {
  const { query, onQueryChange } = props;
  const { includeSubTimeseries } = query.assetQuery;
  return (
    <InlineField
        label="Include sub-timeseries"
        labelWidth={22}
        tooltip="Fetch time series linked to the asset"
      >
        <InlineSwitch
          label='Include sub-timeseries'
          id={`include-sub-timeseries-${query.refId}`}
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
    </InlineField>
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
    <InlineFieldRow>
      <InlineFormLabel htmlFor={`include-sub-assets-${query.refId}`} width={9}>Include sub-assets</InlineFormLabel>
      <InlineSwitch
        label='Include sub-assets'
        value={includeSubtrees}
        id={`include-sub-assets-${query.refId}`}
        onChange={({ currentTarget }) => onIncludeSubtreesChange(currentTarget.checked)}
      />
    </InlineFieldRow>
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
    <InlineFieldRow>
      <InlineFormLabel
        htmlFor={`include-relationships-${query.refId}`}
        tooltip="Fetch time series related to the asset. Relationships are deprecated along with the other asset-centric APIs."
        width={18}
      >
        Include relationships (deprecated)
      </InlineFormLabel>
      <InlineSwitch
        label='Include relationships'
        id={`include-relationships-${query.refId}`}
        value={withRelationships}
        onChange={({ currentTarget }) => onIncludeRelationshipsChange(currentTarget.checked)}
      />
    </InlineFieldRow>
  );
};
function AssetTab(props: SelectedProps & { datasource: CogniteDatasource; intervalMs?: number }) {
  const { query, datasource, onQueryChange, intervalMs } = props;

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
    <>
      <InlineFieldRow>
        <InlineField
          label="Asset Tag"
          labelWidth={14}
          tooltip="Search asset by name/description"
        >
          <AsyncSelect
            loadOptions={(query) => datasource.getOptionsForDropdown(query, 'Asset')}
            value={current}
            defaultOptions
            inputId={`asset-select-dropdown-${query.refId}`}
            data-testid='asset-select-dropdown'
            placeholder="Search asset by name/description"
            width={40}
            allowCustomValue
            onChange={setCurrent}
          />
        </InlineField>
        <IncludeSubAssetsCheckbox {...{ onQueryChange, query }} />
        <IncludeTimeseriesCheckbox {...{ onQueryChange, query }} />
        <LatestValueCheckbox {...{ query, onQueryChange }} />
        {!query.latestValue && <CommonEditors {...{ query, onQueryChange, intervalMs }} hideLabel />}
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
      </InlineFieldRow>
      <LabelRow {...{ onQueryChange, query }} />
    </>
  );
}
function TimeseriesTab(props: SelectedProps & { datasource: CogniteDatasource; intervalMs?: number }) {
  const { query, datasource, onQueryChange, intervalMs } = props;
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
      {!query.latestValue && <CommonEditors {...{ query, onQueryChange, intervalMs }} hideLabel />}
      <LabelRow {...{ onQueryChange, query }} />
    </div>
  );
}
function CustomTab(props: SelectedProps & Pick<EditorProps, 'onRunQuery'> & { intervalMs?: number }) {
  const { query, onQueryChange, intervalMs } = props;
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
            id={`custom-query-${query.refId}`}
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
      <CommonEditors {...{ onQueryChange, query, intervalMs }} hideLabel />
      <LabelRow {...{ onQueryChange, query }} />
      {showHelp && <CustomQueryHelp onDismiss={() => setShowHelp(false)} />}
    </>
  );
}
/**
 * The chip after a tab's name. `Tab` takes a plain string label, so this slot is the
 * only place a tab can carry one.
 */
/** The Core Data Model tabs, which share the editor styling the deprecated tabs don't. */
const CDM_TABS: Tabs[] = [
  Tabs.CogniteTimeSeriesSearch,
  Tabs.SyntheticTimeSeries,
  Tabs.CogniteActivity,
  Tabs.Records,
  Tabs.FlexibleDataModelling,
];

export const TAB_SUFFIX_TEXT: Partial<Record<Tabs, string>> = {
  [Tabs.Timeseries]: DEPRECATED_CHIP_TEXT,
  [Tabs.Asset]: DEPRECATED_CHIP_TEXT,
  [Tabs.Custom]: DEPRECATED_CHIP_TEXT,
  [Tabs.Event]: DEPRECATED_CHIP_TEXT,
  [Tabs.Relationships]: DEPRECATED_CHIP_TEXT,
  [Tabs.Templates]: DEPRECATED_CHIP_TEXT,
  [Tabs.ExtractionPipelines]: DEPRECATED_CHIP_TEXT,
  [Tabs.Records]: 'Alpha',
  [Tabs.SyntheticTimeSeries]: 'Alpha',
};

/**
 * What to use instead, for each tab running on the deprecated asset-centric APIs.
 * Templates and Extraction Pipelines are deprecated on their own terms, so they carry
 * the chip without the banner.
 */
export const ASSET_CENTRIC_REPLACEMENTS: Partial<Record<Tabs, string>> = {
  [Tabs.Timeseries]: 'Use the Time series tab instead.',
  [Tabs.Asset]: 'Use the GraphQL tab to plot the time series of an asset instead.',
  [Tabs.Custom]: 'Use the Synthetic time series tab instead.',
  [Tabs.Event]: 'Use the Records or Activities tab instead.',
  [Tabs.Relationships]: 'Use the GraphQL tab instead.',
};

type TabSuffixComponent = React.ComponentType<{ className?: string }>;

function DisabledTabSuffix() {
  const theme = useTheme2();
  return (
    <p className="preview-label" style={{ color: theme.colors.error.text }}>
      Disabled
    </p>
  );
}

const SUFFIX_COMPONENTS: Partial<Record<Tabs, TabSuffixComponent>> = mapValues(
  TAB_SUFFIX_TEXT,
  (text) =>
    text === DEPRECATED_CHIP_TEXT
      ? DeprecatedChip
      : () => <p className="preview-label">{text}</p>
);

const tabSuffix = (tab: Tabs, showingDisabledTab: boolean): TabSuffixComponent | undefined => {
  if (showingDisabledTab) {
    return DisabledTabSuffix;
  }
  return SUFFIX_COMPONENTS[tab];
};

export function QueryEditor(props: EditorProps) {
  const { query: queryWithoutDefaults, onChange, onRunQuery, datasource } = props;
  const query = defaults(queryWithoutDefaults, defaultQuery);
  const { refId: thisRefId, tab } = query;
  const warningMessage = useQueryWarnings(props.data, thisRefId);

  // At the top of the component, after defining `query`
  const queryRef = React.useRef(query);
  queryRef.current = query;

  // Then, update onQueryChange to use the ref
  const onQueryChange: OnQueryChange = React.useCallback((patch, shouldRunQuery = true) => {
    onChange({ ...queryRef.current, ...patch } as CogniteQuery);
    if (shouldRunQuery) {
      onRunQuery();
    }
  }, [onChange, onRunQuery]);

  const onSelectTab = (tab: Tabs) => () => {
    onQueryChange({ tab });
  };

  // Use utility functions for tab logic
  const hiddenTab = (t: Tabs) => isTabHidden(t, tab, datasource);

  const activeTab = getActiveTab(tab, datasource);

  useEffect(() => {
    if (activeTab !== tab) {
      onQueryChange({ tab: activeTab }, false);
    }
  }, [activeTab, tab, onQueryChange]);

  // The ellipsis on long placeholders is for the Core Data Model tabs; the deprecated ones stay as they were.
  const isCdmTab = CDM_TABS.includes(activeTab);

  return (
    <div className={isCdmTab ? selectPlaceholderEllipsis : undefined}>
      <TabsBar>
        {Object.values(Tabs).map((t) => {
          // A tab without a title would render as a nameless, clickable tab.
          if (hiddenTab(t) || !TabTitles[t]) {
            return null;
          }
          const tabIsDisabled = isTabDisabled(t, datasource);
          const isCurrentlySelected = t === tab;
          const showingDisabledTab = tabIsDisabled && isCurrentlySelected;

          return (
            <Tab
              label={TabTitles[t]}
              key={t}
              active={activeTab === t}
              onChangeTab={onSelectTab(t)}
              style={{ display: 'flex' }}
              suffix={tabSuffix(t, showingDisabledTab)}
            />
          );
        })}
      </TabsBar>
      <TabContent>
        {ASSET_CENTRIC_REPLACEMENTS[activeTab] && (
          <DeprecationNotice replacement={ASSET_CENTRIC_REPLACEMENTS[activeTab]} />
        )}
        {activeTab === Tabs.Asset && (
          <AssetTab {...{ onQueryChange, query, datasource }} intervalMs={props.data?.request?.intervalMs} />
        )}
        {activeTab === Tabs.Timeseries && (
          <TimeseriesTab {...{ onQueryChange, query, datasource }} intervalMs={props.data?.request?.intervalMs} />
        )}
        {activeTab === Tabs.Custom && (
          <CustomTab {...{ onQueryChange, query, onRunQuery }} intervalMs={props.data?.request?.intervalMs} />
        )}
        {activeTab === Tabs.Event && <EventsTab {...{ onQueryChange, query, onRunQuery, datasource }} />}
        {activeTab === Tabs.Relationships && (
          <RelationshipsTab {...{ query, datasource, onQueryChange, queryBinder: null }} />
        )}
        {activeTab === Tabs.ExtractionPipelines && (
          <ExtractionPipelinesTab {...{ onQueryChange, query, onRunQuery, datasource }} />
        )}
        {activeTab === Tabs.Templates && (
          <TemplatesTab {...{ onQueryChange, query, onRunQuery, datasource }} />
        )}
        {activeTab === Tabs.FlexibleDataModelling && (
          <FlexibleDataModellingTab
            {...{ onQueryChange, query, datasource }}
            intervalMs={props.data?.request?.intervalMs}
          />
        )}
        {activeTab === Tabs.CogniteTimeSeriesSearch && (
          <CogniteTimeSeriesSearchTab
            {...{ onQueryChange, query, connector: datasource.connector }}
            intervalMs={props.data?.request?.intervalMs}
          />
        )}
        {activeTab === Tabs.CogniteActivity && (
          <CogniteActivityTab {...{ onQueryChange, query, connector: datasource.connector }} />
        )}
        {activeTab === Tabs.Records && (
          <RecordsTab
            {...{
              onQueryChange,
              query,
              connector: datasource.connector,
              range: props.range,
              interpolate: (recordsQuery: RecordsQuery) =>
                datasource.interpolateRecordsQuery(recordsQuery, props.data?.request?.scopedVars),
              maxDataPoints: props.data?.request?.maxDataPoints,
            }}
          />
        )}
        {activeTab === Tabs.SyntheticTimeSeries && (
          <SyntheticTimeSeriesTab
            {...{ onQueryChange, query, connector: datasource.connector }}
            intervalMs={props.data?.request?.intervalMs}
            range={props.range}
            timezone={props.data?.request?.timezone}
            scopedVars={props.data?.request?.scopedVars}
          />
        )}
      </TabContent>
      {warningMessage && <FormattedMessage severity="warning">{warningMessage}</FormattedMessage>}
    </div>
  );
}
