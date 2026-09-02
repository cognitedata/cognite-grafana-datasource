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

/** Every flag resolved to a definite boolean. */
export type FeatureFlags = Record<FeatureKey, boolean>;

/**
 * Fills in the flags a datasource's `jsonData` leaves unset.
 *
 * Reading the flags by name keeps the set extensible: adding a flag here reaches
 * every consumer without anyone having to keep an argument list in the same order.
 */
export function resolveFeatureFlags(
  jsonData: Partial<Record<FeatureKey, boolean>> = {},
): FeatureFlags {
  const keys = Object.keys(FEATURE_DEFAULTS) as FeatureKey[];
  return keys.reduce((flags, key) => {
    flags[key] = jsonData?.[key] ?? FEATURE_DEFAULTS[key];
    return flags;
  }, {} as FeatureFlags);
}
