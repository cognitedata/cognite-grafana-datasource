/**
 * Default values for feature flags used across the application.
 * These defaults ensure backward compatibility and consistent behavior.
 */

export const FEATURE_DEFAULTS = {
  // Master toggles for feature sections
  enableCoreDataModelFeatures: true, // Default on for new datasource instances
  enableLegacyDataModelFeatures: false, // Default off - enable manually if needed

  // Core data model (CDM) features - default to enabled when core master toggle is on
  enableCogniteTimeSeries: true,
  enableCogniteActivities: true,
  enableFlexibleDataModelling: true, // GraphQL / Data Models tab

  // Legacy data model features - default to enabled for backward compatibility
  enableTimeseriesSearch: true,
  enableTimeseriesFromAsset: true,
  enableTimeseriesCustomQuery: true,
  enableEvents: true,
  enableEventsAdvancedFiltering: false, // Off by default

  // Deprecated features
  enableTemplates: false, // Disabled by default
  enableExtractionPipelines: false, // Disabled by default
  enableRelationships: false, // Disabled by default
} as const;

/**
 * Type representing all available feature flag keys
 */
export type FeatureKey = keyof typeof FEATURE_DEFAULTS;
