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
        true, true, true, true, // legacy features
        false, false, false, false, false // deprecated features
      );
      expect(connectorEnabled.isCogniteTimeSeriesEnabled()).toBe(true);

      // Master disabled, feature enabled
      const connectorMasterDisabled = new Connector(
        project, protocol, fetcher, false, false,
        false, // enableCoreDataModelFeatures - DISABLED
        true,  // enableLegacyDataModelFeatures
        true,  // enableCogniteTimeSeries
        true, true, true, true, // legacy features
        false, false, false, false, false // deprecated features
      );
      expect(connectorMasterDisabled.isCogniteTimeSeriesEnabled()).toBe(false);

      // Master enabled, feature disabled
      const connectorFeatureDisabled = new Connector(
        project, protocol, fetcher, false, false,
        true,  // enableCoreDataModelFeatures
        true,  // enableLegacyDataModelFeatures
        false, // enableCogniteTimeSeries - DISABLED
        true, true, true, true, // legacy features
        false, false, false, false, false // deprecated features
      );
      expect(connectorFeatureDisabled.isCogniteTimeSeriesEnabled()).toBe(false);

      // Both disabled
      const connectorBothDisabled = new Connector(
        project, protocol, fetcher, false, false,
        false, // enableCoreDataModelFeatures - DISABLED
        true,  // enableLegacyDataModelFeatures
        false, // enableCogniteTimeSeries - DISABLED
        true, true, true, true, // legacy features
        false, false, false, false, false // deprecated features
      );
      expect(connectorBothDisabled.isCogniteTimeSeriesEnabled()).toBe(false);
    });

    it('should enable FlexibleDataModelling only when both master and feature flags are enabled', () => {
      // Both enabled
      const connectorEnabled = new Connector(
        project, protocol, fetcher, false, false,
        true,  // enableCoreDataModelFeatures
        true,  // enableLegacyDataModelFeatures
        false, // enableCogniteTimeSeries
        true, true, true, true, // legacy features
        false, false, true, false, false // enableFlexibleDataModelling = true
      );
      expect(connectorEnabled.isFlexibleDataModellingEnabled()).toBe(true);

      // Master disabled
      const connectorMasterDisabled = new Connector(
        project, protocol, fetcher, false, false,
        false, // enableCoreDataModelFeatures - DISABLED
        true,  // enableLegacyDataModelFeatures
        false, // enableCogniteTimeSeries
        true, true, true, true, // legacy features
        false, false, true, false, false // enableFlexibleDataModelling = true
      );
      expect(connectorMasterDisabled.isFlexibleDataModellingEnabled()).toBe(false);
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
        true, true, true, true, // enableTimeseriesSearch = true
        false, false, false, false, false // deprecated features
      );
      expect(connectorEnabled.isTimeseriesSearchEnabled()).toBe(true);

      // Master disabled, feature enabled
      const connectorMasterDisabled = new Connector(
        project, protocol, fetcher, false, false,
        false, // enableCoreDataModelFeatures
        false, // enableLegacyDataModelFeatures - DISABLED
        false, // enableCogniteTimeSeries
        true, true, true, true, // enableTimeseriesSearch = true
        false, false, false, false, false // deprecated features
      );
      expect(connectorMasterDisabled.isTimeseriesSearchEnabled()).toBe(false);

      // Master enabled, feature disabled
      const connectorFeatureDisabled = new Connector(
        project, protocol, fetcher, false, false,
        false, // enableCoreDataModelFeatures
        true,  // enableLegacyDataModelFeatures
        false, // enableCogniteTimeSeries
        false, true, true, true, // enableTimeseriesSearch = false
        false, false, false, false, false // deprecated features
      );
      expect(connectorFeatureDisabled.isTimeseriesSearchEnabled()).toBe(false);
    });

    it('should enable all legacy features when both master and individual flags are enabled', () => {
      const connector = new Connector(
        project, protocol, fetcher, false, false,
        false, // enableCoreDataModelFeatures
        true,  // enableLegacyDataModelFeatures
        false, // enableCogniteTimeSeries
        true, true, true, true, // all legacy features enabled
        false, false, false, false, false // deprecated features
      );

      expect(connector.isTimeseriesSearchEnabled()).toBe(true);
      expect(connector.isTimeseriesFromAssetEnabled()).toBe(true);
      expect(connector.isTimeseriesCustomQueryEnabled()).toBe(true);
      expect(connector.isEventsEnabled()).toBe(true);
    });

    it('should disable all legacy features when master is disabled', () => {
      const connector = new Connector(
        project, protocol, fetcher, false, false,
        false, // enableCoreDataModelFeatures
        false, // enableLegacyDataModelFeatures - DISABLED
        false, // enableCogniteTimeSeries
        true, true, true, true, // all legacy features enabled but master disabled
        false, false, false, false, false // deprecated features
      );

      expect(connector.isTimeseriesSearchEnabled()).toBe(false);
      expect(connector.isTimeseriesFromAssetEnabled()).toBe(false);
      expect(connector.isTimeseriesCustomQueryEnabled()).toBe(false);
      expect(connector.isEventsEnabled()).toBe(false);
    });
  });

  describe('Deprecated features', () => {
    it('should ignore master toggles for deprecated features', () => {
      const connector = new Connector(
        project, protocol, fetcher, false, false,
        false, // enableCoreDataModelFeatures - disabled
        false, // enableLegacyDataModelFeatures - disabled
        false, // enableCogniteTimeSeries
        false, false, false, false, // all legacy features disabled
        true, true, true, true, true // all deprecated features enabled
      );

      // Deprecated features should work regardless of master toggles
      expect(connector.isRelationshipsEnabled()).toBe(true);
      expect(connector.isTemplatesEnabled()).toBe(true);
      expect(connector.isEventsAdvancedFilteringEnabled()).toBe(true);
      expect(connector.isExtractionPipelinesEnabled()).toBe(true);
    });

    it('should respect individual deprecated feature flags', () => {
      const connector = new Connector(
        project, protocol, fetcher, false, false,
        true,  // enableCoreDataModelFeatures
        true,  // enableLegacyDataModelFeatures
        false, // enableCogniteTimeSeries
        true, true, true, true, // legacy features
        false, false, false, false, false // all deprecated features disabled
      );

      expect(connector.isRelationshipsEnabled()).toBe(false);
      expect(connector.isTemplatesEnabled()).toBe(false);
      expect(connector.isEventsAdvancedFilteringEnabled()).toBe(false);
      expect(connector.isExtractionPipelinesEnabled()).toBe(false);
    });
  });

  describe('Mixed scenarios', () => {
    it('should handle mixed master toggle states correctly', () => {
      const connector = new Connector(
        project, protocol, fetcher, false, false,
        true,  // enableCoreDataModelFeatures - enabled
        false, // enableLegacyDataModelFeatures - disabled
        true,  // enableCogniteTimeSeries
        true, true, true, true, // legacy features (but master disabled)
        true, true, true, true, true // deprecated features
      );

      // Core features should work (master enabled)
      expect(connector.isCogniteTimeSeriesEnabled()).toBe(true);

      // Legacy features should not work (master disabled)
      expect(connector.isTimeseriesSearchEnabled()).toBe(false);
      expect(connector.isEventsEnabled()).toBe(false);

      // Deprecated features should work (ignore masters)
      expect(connector.isRelationshipsEnabled()).toBe(true);
      expect(connector.isTemplatesEnabled()).toBe(true);
    });
  });
});
