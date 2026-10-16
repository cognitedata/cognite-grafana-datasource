import { FeatureKey } from "../featureDefaults";
import { ASSET_CENTRIC_RETIREMENT_DATE } from "./common/DeprecationNotice";

const DEPRECATED = `Deprecated: CDF retires the asset-centric APIs on ${ASSET_CENTRIC_RETIREMENT_DATE}.`;

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
    `Master toggle for asset-centric features. When disabled, all asset-centric features will be hidden. Enabling this will disable CDM features. ${DEPRECATED}`,

  enableCogniteTimeSeries:
    `Enable the Time Series tab to browse and select time series instances from the Core Data Model (CogniteTimeSeries type).`,
  enableCogniteActivities:
    `Enable the Activities tab to query CogniteActivity instances from the Core Data Model.`,
  enableRecords:
    `Enable the Records tab to query high-volume records from streams through record views. Alpha: off by default, and its options may change before Beta.`,
  enableFlexibleDataModelling:
    `Enable the GraphQL tab to query custom data models in CDF using GraphQL. Supports listing, searching, and aggregating data model instances.`,

  enableTimeseriesSearch:
    `Enable the Time series search tab to find and select time series by name, description, or metadata. ${DEPRECATED} Use the CDM Time Series tab instead.`,
  enableTimeseriesFromAsset:
    `Enable the Time series from asset tab to browse the asset hierarchy and select time series linked to specific assets. ${DEPRECATED} Use the GraphQL tab to plot the time series of an asset instead.`,
  enableTimeseriesCustomQuery:
    `Enable the Custom query tab to retrieve time series by external ID, with support for synthetic time series expressions and custom aggregations. ${DEPRECATED} Use the CDM Time Series or GraphQL tab instead.`,
  enableEvents:
    `Enable the Events tab to query CDF events. Events represent time-bounded occurrences (e.g. alarms, maintenance activities) linked to assets. ${DEPRECATED} Use the Records or Activities tab instead.`,
  enableEventsAdvancedFiltering:
    `Add advanced event filtering with boolean logic (AND, OR, NOT) and metadata-based filters within the Events tab. Supports filtering by type, subtype, time ranges, and asset links. ${DEPRECATED}`,

  enableRelationships:
    `Enable the Relationships tab to query connections between CDF resources. ${DEPRECATED} Use the GraphQL tab instead.`,
  enableTemplates:
    `Enable the Templates tab. Cognite Templates were retired in May 2025. Migrate to Data Models (DMS).`,
  enableExtractionPipelines:
    `Enable the Extraction Pipelines tab to monitor data flow from extractors into CDF. This tab is deprecated in the plugin.`,
};
