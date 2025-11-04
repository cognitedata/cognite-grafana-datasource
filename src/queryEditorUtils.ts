import { Tab as Tabs } from './types';
import CogniteDatasource from './datasource';

/**
 * Determines if a tab feature is disabled by feature flags
 * @param tab The tab to check
 * @param datasource The datasource instance with connector
 * @returns true if the tab is disabled, false otherwise
 */
export function isTabDisabled(tab: Tabs, datasource: CogniteDatasource): boolean {
  // Core Data Model features
  if (tab === Tabs.CogniteTimeSeriesSearch) {
    return !datasource.connector.isCogniteTimeSeriesEnabled();
  }
  if (tab === Tabs.FlexibleDataModelling) {
    return !datasource.connector.isFlexibleDataModellingEnabled();
  }
  
  // Legacy data model features
  if (tab === Tabs.Timeseries) {
    return !datasource.connector.isTimeseriesSearchEnabled();
  }
  if (tab === Tabs.Asset) {
    return !datasource.connector.isTimeseriesFromAssetEnabled();
  }
  if (tab === Tabs.Custom) {
    return !datasource.connector.isTimeseriesCustomQueryEnabled();
  }
  if (tab === Tabs.Event) {
    return !datasource.connector.isEventsEnabled();
  }
  
  // Deprecated features
  if (tab === Tabs.Relationships) {
    return !datasource.connector.isRelationshipsEnabled();
  }
  if (tab === Tabs.Templates) {
    return !datasource.connector.isTemplatesEnabled();
  }
  if (tab === Tabs.ExtractionPipelines) {
    return !datasource.connector.isExtractionPipelinesEnabled();
  }
  
  // DataModellingV2 tab - always enabled (no feature flag)
  if (tab === Tabs.DataModellingV2) {
    return false;
  }
  
  return false;
}

/**
 * Determines if a tab should be hidden from the tab bar
 * Note: This function controls UI visibility of tabs in the query editor.
 * For backward compatibility, we show disabled tabs if they're already selected
 * in an existing visualization, but hide them for new selections.
 * @param tab The tab to check
 * @param currentTab The currently selected tab
 * @param datasource The datasource instance with connector
 * @returns true if the tab should be hidden, false otherwise
 */
export function isTabHidden(tab: Tabs, currentTab: Tabs, datasource: CogniteDatasource): boolean {
  const tabIsDisabled = isTabDisabled(tab, datasource);
  
  // If tab is not disabled, always show it
  if (!tabIsDisabled) {
    return false;
  }
  
  // If tab is disabled but currently selected (existing visualization), show it
  // This ensures backward compatibility - users can still see their existing dashboards
  if (tab === currentTab) {
    return false;
  }
  
  // Otherwise, hide disabled tabs to prevent new selections
  return true;
}

/**
 * Gets the first available (not disabled) tab based on natural tab order.
 * This function finds the first tab that is not disabled.
 * @param datasource The datasource instance with connector
 * @returns The first available tab
 */
export function getFirstAvailableTab(datasource: CogniteDatasource): Tabs {
  // Use the same order as the tabs appear in the UI (Object.values maintains enum order)
  const allTabs = Object.values(Tabs);
  for (const tab of allTabs) {
    if (!isTabDisabled(tab, datasource)) {
      return tab;
    }
  }
  // Fallback to DataModellingV2 which is always enabled (no feature flag)
  return Tabs.DataModellingV2;
}

/**
 * Determines the active tab, handling auto-switching logic.
 * If the current tab is disabled, it switches to the first available tab.
 * Note: The component using this needs to handle backward compatibility
 * (i.e., not calling this or ignoring its result for existing saved queries).
 * @param currentTab The currently selected tab
 * @param datasource The datasource instance with connector
 * @returns The tab that should be active
 */
export function getActiveTab(currentTab: Tabs, datasource: CogniteDatasource): Tabs {
  return isTabDisabled(currentTab, datasource)
    ? getFirstAvailableTab(datasource)
    : currentTab;
}
