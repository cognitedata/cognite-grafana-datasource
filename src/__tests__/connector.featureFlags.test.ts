import { Connector } from '../connector';

describe('Connector Feature Flags', () => {
  const project = 'test';
  const protocol = 'protocol:/';
  const fetcher = { fetch: jest.fn() };

  describe('Core Data Model features', () => {
    it('should enable CogniteTimeSeries only when both master and feature flags are enabled', () => {
      // Both master and feature enabled
      const connectorEnabled = new Connector(
        project, protocol, fetcher, false, false,
        true,  // enableCoreDataModelFeatures
        true,  // enableLegacyDataModelFeatures
        true,  // enableCogniteTimeSeries
        true,  // enableFlexibleDataModelling
        true, true, true, true, true, // legacy features (5 total)
        false, false, false // deprecated features (3 total)
      );
      expect(connectorEnabled.isCogniteTimeSeriesEnabled()).toBe(true);

      // Master disabled, feature enabled
      const connectorMasterDisabled = new Connector(
        project, protocol, fetcher, false, false,
        false, // enableCoreDataModelFeatures - DISABLED
        true,  // enableLegacyDataModelFeatures
        true,  // enableCogniteTimeSeries
        true,  // enableFlexibleDataModelling
        true, true, true, true, true, // legacy features (5 total)
        false, false, false // deprecated features (3 total)
      );
      expect(connectorMasterDisabled.isCogniteTimeSeriesEnabled()).toBe(false);

      // Master enabled, feature disabled
      const connectorFeatureDisabled = new Connector(
        project, protocol, fetcher, false, false,
        true,  // enableCoreDataModelFeatures
        true,  // enableLegacyDataModelFeatures
        false, // enableCogniteTimeSeries - DISABLED
        true,  // enableFlexibleDataModelling
        true, true, true, true, true, // legacy features (5 total)
        false, false, false // deprecated features (3 total)
      );
      expect(connectorFeatureDisabled.isCogniteTimeSeriesEnabled()).toBe(false);

      // Both disabled
      const connectorBothDisabled = new Connector(
        project, protocol, fetcher, false, false,
        false, // enableCoreDataModelFeatures - DISABLED
        true,  // enableLegacyDataModelFeatures
        false, // enableCogniteTimeSeries - DISABLED
        true,  // enableFlexibleDataModelling
        true, true, true, true, true, // legacy features (5 total)
        false, false, false // deprecated features (3 total)
      );
      expect(connectorBothDisabled.isCogniteTimeSeriesEnabled()).toBe(false);
    });

    it('should enable FlexibleDataModelling only when both core master and feature flags are enabled', () => {
      // Both enabled
      const connectorEnabled = new Connector(
        project, protocol, fetcher, false, false,
        true,  // enableCoreDataModelFeatures
        true,  // enableLegacyDataModelFeatures
        false, // enableCogniteTimeSeries
        true,  // enableFlexibleDataModelling
        true, true, true, true, true, // legacy features (5 total)
        false, false, false // deprecated features (3 total)
      );
      expect(connectorEnabled.isFlexibleDataModellingEnabled()).toBe(true);

      // Core master disabled
      const connectorMasterDisabled = new Connector(
        project, protocol, fetcher, false, false,
        false, // enableCoreDataModelFeatures - DISABLED
        true,  // enableLegacyDataModelFeatures
        false, // enableCogniteTimeSeries
        true,  // enableFlexibleDataModelling
        true, true, true, true, true, // legacy features (5 total)
        false, false, false // deprecated features (3 total)
      );
      expect(connectorMasterDisabled.isFlexibleDataModellingEnabled()).toBe(false);

      // Feature disabled
      const connectorFeatureDisabled = new Connector(
        project, protocol, fetcher, false, false,
        true,  // enableCoreDataModelFeatures
        true,  // enableLegacyDataModelFeatures
        false, // enableCogniteTimeSeries
        false, // enableFlexibleDataModelling - DISABLED
        true, true, true, true, true, // legacy features (5 total)
        false, false, false // deprecated features (3 total)
      );
      expect(connectorFeatureDisabled.isFlexibleDataModellingEnabled()).toBe(false);
    });
  });

  describe('Legacy data model features', () => {
    it('should enable TimeseriesSearch only when both master and feature flags are enabled', () => {
      // Both enabled
      const connectorEnabled = new Connector(
        project, protocol, fetcher, false, false,
        false, // enableCoreDataModelFeatures
        true,  // enableLegacyDataModelFeatures
        false, // enableCogniteTimeSeries
        false, // enableFlexibleDataModelling
        true, true, true, true, true, // legacy features (enableTimeseriesSearch = true)
        false, false, false // deprecated features (3 total)
      );
      expect(connectorEnabled.isTimeseriesSearchEnabled()).toBe(true);

      // Master disabled, feature enabled
      const connectorMasterDisabled = new Connector(
        project, protocol, fetcher, false, false,
        false, // enableCoreDataModelFeatures
        false, // enableLegacyDataModelFeatures - DISABLED
        false, // enableCogniteTimeSeries
        false, // enableFlexibleDataModelling
        true, true, true, true, true, // legacy features (enableTimeseriesSearch = true)
        false, false, false // deprecated features (3 total)
      );
      expect(connectorMasterDisabled.isTimeseriesSearchEnabled()).toBe(false);

      // Master enabled, feature disabled
      const connectorFeatureDisabled = new Connector(
        project, protocol, fetcher, false, false,
        false, // enableCoreDataModelFeatures
        true,  // enableLegacyDataModelFeatures
        false, // enableCogniteTimeSeries
        false, // enableFlexibleDataModelling
        false, true, true, true, true, // legacy features (enableTimeseriesSearch = false)
        false, false, false // deprecated features (3 total)
      );
      expect(connectorFeatureDisabled.isTimeseriesSearchEnabled()).toBe(false);
    });

    it('should enable EventsAdvancedFiltering only when both legacy master and feature flags are enabled', () => {
      // Both enabled
      const connectorEnabled = new Connector(
        project, protocol, fetcher, false, false,
        false, // enableCoreDataModelFeatures
        true,  // enableLegacyDataModelFeatures
        false, // enableCogniteTimeSeries
        false, // enableFlexibleDataModelling
        true, true, true, true, true, // legacy features (enableEventsAdvancedFiltering = true)
        false, false, false // deprecated features (3 total)
      );
      expect(connectorEnabled.isEventsAdvancedFilteringEnabled()).toBe(true);

      // Legacy master disabled
      const connectorMasterDisabled = new Connector(
        project, protocol, fetcher, false, false,
        false, // enableCoreDataModelFeatures
        false, // enableLegacyDataModelFeatures - DISABLED
        false, // enableCogniteTimeSeries
        false, // enableFlexibleDataModelling
        true, true, true, true, true, // legacy features (enableEventsAdvancedFiltering = true)
        false, false, false // deprecated features (3 total)
      );
      expect(connectorMasterDisabled.isEventsAdvancedFilteringEnabled()).toBe(false);

      // Feature disabled
      const connectorFeatureDisabled = new Connector(
        project, protocol, fetcher, false, false,
        false, // enableCoreDataModelFeatures
        true,  // enableLegacyDataModelFeatures
        false, // enableCogniteTimeSeries
        false, // enableFlexibleDataModelling
        true, true, true, true, false, // legacy features (enableEventsAdvancedFiltering = false)
        false, false, false // deprecated features (3 total)
      );
      expect(connectorFeatureDisabled.isEventsAdvancedFilteringEnabled()).toBe(false);
    });

    it('should enable all legacy features when both master and individual flags are enabled', () => {
      const connector = new Connector(
        project, protocol, fetcher, false, false,
        false, // enableCoreDataModelFeatures
        true,  // enableLegacyDataModelFeatures
        false, // enableCogniteTimeSeries
        false, // enableFlexibleDataModelling
        true, true, true, true, true, // all legacy features enabled
        false, false, false // deprecated features (3 total)
      );

      expect(connector.isTimeseriesSearchEnabled()).toBe(true);
      expect(connector.isTimeseriesFromAssetEnabled()).toBe(true);
      expect(connector.isTimeseriesCustomQueryEnabled()).toBe(true);
      expect(connector.isEventsEnabled()).toBe(true);
      expect(connector.isEventsAdvancedFilteringEnabled()).toBe(true);
    });

    it('should disable all legacy features when master is disabled', () => {
      const connector = new Connector(
        project, protocol, fetcher, false, false,
        false, // enableCoreDataModelFeatures
        false, // enableLegacyDataModelFeatures - DISABLED
        false, // enableCogniteTimeSeries
        false, // enableFlexibleDataModelling
        true, true, true, true, true, // all legacy features enabled but master disabled
        false, false, false // deprecated features (3 total)
      );

      expect(connector.isTimeseriesSearchEnabled()).toBe(false);
      expect(connector.isTimeseriesFromAssetEnabled()).toBe(false);
      expect(connector.isTimeseriesCustomQueryEnabled()).toBe(false);
      expect(connector.isEventsEnabled()).toBe(false);
      expect(connector.isEventsAdvancedFilteringEnabled()).toBe(false);
    });
  });

  describe('Deprecated features', () => {
    it('should ignore master toggles for deprecated features', () => {
      const connector = new Connector(
        project, protocol, fetcher, false, false,
        false, // enableCoreDataModelFeatures - disabled
        false, // enableLegacyDataModelFeatures - disabled
        false, // enableCogniteTimeSeries
        false, // enableFlexibleDataModelling
        false, false, false, false, false, // all legacy features disabled
        true, true, true // all deprecated features enabled
      );

      // Deprecated features should work regardless of master toggles
      expect(connector.isTemplatesEnabled()).toBe(true);
      expect(connector.isExtractionPipelinesEnabled()).toBe(true);
      expect(connector.isRelationshipsEnabled()).toBe(true);
    });

    it('should respect individual deprecated feature flags', () => {
      const connector = new Connector(
        project, protocol, fetcher, false, false,
        true,  // enableCoreDataModelFeatures
        true,  // enableLegacyDataModelFeatures
        false, // enableCogniteTimeSeries
        false, // enableFlexibleDataModelling
        true, true, true, true, true, // legacy features
        false, false, false // all deprecated features disabled
      );

      expect(connector.isTemplatesEnabled()).toBe(false);
      expect(connector.isExtractionPipelinesEnabled()).toBe(false);
      expect(connector.isRelationshipsEnabled()).toBe(false);
    });
  });

  describe('Mixed scenarios', () => {
    it('should handle mixed master toggle states correctly', () => {
      const connector = new Connector(
        project, protocol, fetcher, false, false,
        true,  // enableCoreDataModelFeatures - enabled
        false, // enableLegacyDataModelFeatures - disabled
        true,  // enableCogniteTimeSeries
        true,  // enableFlexibleDataModelling
        true, true, true, true, true, // legacy features (but master disabled)
        true, true, true // deprecated features
      );

      // Core features should work (master enabled)
      expect(connector.isCogniteTimeSeriesEnabled()).toBe(true);
      expect(connector.isFlexibleDataModellingEnabled()).toBe(true);

      // Legacy features should not work (master disabled)
      expect(connector.isTimeseriesSearchEnabled()).toBe(false);
      expect(connector.isEventsEnabled()).toBe(false);
      expect(connector.isEventsAdvancedFilteringEnabled()).toBe(false);

      // Deprecated features should work (ignore masters)
      expect(connector.isRelationshipsEnabled()).toBe(true);
      expect(connector.isTemplatesEnabled()).toBe(true);
      expect(connector.isExtractionPipelinesEnabled()).toBe(true);
    });
  });
});
