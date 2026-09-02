import { FeatureKey } from "../featureDefaults";

/**
 * What each feature toggle does, in the datasource settings.
 *
 * Keyed by flag so the set stays exhaustive: adding a flag without its explanation
 * is a type error rather than a silently untooltipped switch.
 */
export const FEATURE_TOOLTIPS: Record<FeatureKey, string> = {
  enableCoreDataModelFeatures:
    `Master toggle for Core Data Model (CDM) features. When disabled, all CDM features will be hidden. Enabling this will disable asset-centric features.`,
  enableLegacyDataModelFeatures:
    `Master toggle for asset-centric (legacy) features. When disabled, all asset-centric features will be hidden. Enabling this will disable CDM features.`,

  enableCogniteTimeSeries:
    `Enable the Time Series tab to browse and select time series instances from the Core Data Model (CogniteTimeSeries type).`,
  enableCogniteActivities:
    `Enable the Activities tab to query CogniteActivity instances from the Core Data Model.`,
  enableFlexibleDataModelling:
    `Enable the GraphQL tab to query custom data models in CDF using GraphQL. Supports listing, searching, and aggregating data model instances.`,

  enableTimeseriesSearch:
    `Enable the Time series search tab to find and select time series by name, description, or metadata.`,
  enableTimeseriesFromAsset:
    `Enable the Time series from asset tab to browse the asset hierarchy and select time series linked to specific assets.`,
  enableTimeseriesCustomQuery:
    `Enable the Custom query tab to retrieve time series by external ID, with support for synthetic time series expressions and custom aggregations.`,
  enableEvents:
    `Enable the Events tab to query CDF events. Events represent time-bounded occurrences (e.g. alarms, maintenance activities) linked to assets.`,
  enableEventsAdvancedFiltering:
    `Add advanced event filtering with boolean logic (AND, OR, NOT) and metadata-based filters within the Events tab. Supports filtering by type, subtype, time ranges, and asset links.`,

  enableRelationships:
    `Enable the Relationships tab to query connections between CDF resources. This tab is deprecated in the plugin; use the GraphQL tab instead.`,
  enableTemplates:
    `Enable the Templates tab. Cognite Templates were retired in May 2025. Migrate to Data Models (DMS).`,
  enableExtractionPipelines:
    `Enable the Extraction Pipelines tab to monitor data flow from extractors into CDF. This tab is deprecated in the plugin.`,
};
