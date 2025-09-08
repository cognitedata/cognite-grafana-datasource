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
 * Gets the first available (not hidden) tab based on natural tab order
 * Note: Relies on the insertion order of the string enum `Tabs`.
 * Maintaining the declaration order in `src/types.ts` preserves the UI order.
 * @param currentTab The currently selected tab
 * @param datasource The datasource instance with connector
 * @returns The first available tab
 */
export function getFirstAvailableTab(currentTab: Tabs, datasource: CogniteDatasource): Tabs {
  // Use the same order as the tabs appear in the UI (Object.values maintains enum order)
  const allTabs = Object.values(Tabs);
  for (const tab of allTabs) {
    if (!isTabHidden(tab, currentTab, datasource)) {
      return tab;
    }
  }
  // Fallback to Timeseries if somehow all tabs are hidden (shouldn't happen)
  return Tabs.Timeseries;
}

/**
 * Determines the active tab, handling auto-switching logic
 * For backward compatibility: if current tab is disabled but selected, keep it
 * Otherwise, if current tab is hidden, get first available tab
 * @param currentTab The currently selected tab
 * @param datasource The datasource instance with connector
 * @returns The tab that should be active
 */
export function getActiveTab(currentTab: Tabs, datasource: CogniteDatasource): Tabs {
  return isTabHidden(currentTab, currentTab, datasource) 
    ? getFirstAvailableTab(currentTab, datasource) 
    : currentTab;
}
