import { Connector, ConnectorOptions } from "../connector";
import { FeatureKey } from "../featureDefaults";

const project = "test";
const protocol = "protocol:/";
const fetcher = { fetch: jest.fn() };

const connectorWith = (options: ConnectorOptions) =>
  new Connector(project, protocol, fetcher, options);

type Accessor = keyof {
  [K in keyof Connector as Connector[K] extends () => boolean ? K : never]: true;
};

/** Each gated feature, its master, and the accessor that answers for it. */
const CDM_FEATURES: Array<[FeatureKey, Accessor]> = [
  ["enableCogniteTimeSeries", "isCogniteTimeSeriesEnabled"],
  ["enableCogniteActivities", "isCogniteActivitiesEnabled"],
  ["enableFlexibleDataModelling", "isFlexibleDataModellingEnabled"],
];

const LEGACY_FEATURES: Array<[FeatureKey, Accessor]> = [
  ["enableTimeseriesSearch", "isTimeseriesSearchEnabled"],
  ["enableTimeseriesFromAsset", "isTimeseriesFromAssetEnabled"],
  ["enableTimeseriesCustomQuery", "isTimeseriesCustomQueryEnabled"],
  ["enableEvents", "isEventsEnabled"],
  ["enableEventsAdvancedFiltering", "isEventsAdvancedFilteringEnabled"],
];

const DEPRECATED_FEATURES: Array<[FeatureKey, Accessor]> = [
  ["enableTemplates", "isTemplatesEnabled"],
  ["enableExtractionPipelines", "isExtractionPipelinesEnabled"],
  ["enableRelationships", "isRelationshipsEnabled"],
];

describe("Connector feature flags", () => {
  // A gated feature needs its master *and* itself; the four combinations are
  // enumerated rather than spot-checked, which is what the positional argument
  // lists used to make impractical.
  describe.each([
    ["Core data model (CDM)", "enableCoreDataModelFeatures", CDM_FEATURES],
    ["Legacy data model", "enableLegacyDataModelFeatures", LEGACY_FEATURES],
  ] as const)("%s features", (_section, master, features) => {
    it.each(features)("%s is on only with its master", (flag, accessor) => {
      expect(connectorWith({ [master]: true, [flag]: true })[accessor]()).toBe(true);
      expect(connectorWith({ [master]: false, [flag]: true })[accessor]()).toBe(false);
      expect(connectorWith({ [master]: true, [flag]: false })[accessor]()).toBe(false);
      expect(connectorWith({ [master]: false, [flag]: false })[accessor]()).toBe(false);
    });

    it("reports every feature off when the master is off", () => {
      const allOn = features.reduce(
        (options, [flag]) => ({ ...options, [flag]: true }),
        { [master]: false } as ConnectorOptions
      );
      const connector = connectorWith(allOn);
      features.forEach(([, accessor]) => expect(connector[accessor]()).toBe(false));
    });
  });

  describe("Deprecated features", () => {
    it.each(DEPRECATED_FEATURES)("%s ignores both masters", (flag, accessor) => {
      const bothMastersOff = {
        enableCoreDataModelFeatures: false,
        enableLegacyDataModelFeatures: false,
      };
      expect(connectorWith({ ...bothMastersOff, [flag]: true })[accessor]()).toBe(true);
      expect(connectorWith({ ...bothMastersOff, [flag]: false })[accessor]()).toBe(false);
    });
  });

  describe("Legacy master on its own", () => {
    // Asset-centric variable queries hit /assets/list, which no sub-flag covers,
    // so the master alone decides whether they are offered.
    it("is independent of the legacy sub-flags", () => {
      const noSubFlags = LEGACY_FEATURES.reduce(
        (options, [flag]) => ({ ...options, [flag]: false }),
        {} as ConnectorOptions
      );
      expect(
        connectorWith({ ...noSubFlags, enableLegacyDataModelFeatures: true })
          .isLegacyDataModelFeaturesEnabled()
      ).toBe(true);
      expect(
        connectorWith({ ...noSubFlags, enableLegacyDataModelFeatures: false })
          .isLegacyDataModelFeaturesEnabled()
      ).toBe(false);
    });
  });

  describe("Unset flags", () => {
    it("reads an omitted flag as off rather than undefined", () => {
      const connector = connectorWith({});
      expect(connector.isFlexibleDataModellingEnabled()).toBe(false);
      expect(connector.isRelationshipsEnabled()).toBe(false);
      expect(connector.isLegacyDataModelFeaturesEnabled()).toBe(false);
    });
  });

  describe("Mixed sections", () => {
    it("gates each section by its own master", () => {
      const connector = connectorWith({
        enableCoreDataModelFeatures: true,
        enableLegacyDataModelFeatures: false,
        enableCogniteTimeSeries: true,
        enableFlexibleDataModelling: true,
        enableTimeseriesSearch: true,
        enableEvents: true,
        enableRelationships: true,
      });

      expect(connector.isCogniteTimeSeriesEnabled()).toBe(true);
      expect(connector.isFlexibleDataModellingEnabled()).toBe(true);
      expect(connector.isTimeseriesSearchEnabled()).toBe(false);
      expect(connector.isEventsEnabled()).toBe(false);
      expect(connector.isRelationshipsEnabled()).toBe(true);
    });
  });
});
