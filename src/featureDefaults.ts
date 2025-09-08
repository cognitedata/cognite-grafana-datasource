/**
 * Default values for feature flags used across the application.
 * These defaults ensure backward compatibility and consistent behavior.
 */

export const FEATURE_DEFAULTS = {
  // Master toggles for feature sections
  enableCoreDataModelFeatures: false, // Default off - opt-in for new features
  enableLegacyDataModelFeatures: true, // Default on - backward compatibility
  
  // Core Data Model features - default to enabled when core master toggle is on
  enableCogniteTimeSeries: true,
  
  // Legacy data model features - default to enabled for backward compatibility
  enableTimeseriesSearch: true,
  enableTimeseriesFromAsset: true,
  enableTimeseriesCustomQuery: true,
  enableEvents: true,
  
  // Deprecated features - keep existing behavior for backward compatibility
  enableTemplates: false, // Disabled by default
  enableEventsAdvancedFiltering: false, // Disabled by default
  enableFlexibleDataModelling: true, // Enable Data Models by default
  enableExtractionPipelines: false, // Disabled by default
  enableRelationships: true, // Default enabled for backward compatibility
} as const;

/**
 * Type representing all available feature flag keys
 */
export type FeatureKey = keyof typeof FEATURE_DEFAULTS;
