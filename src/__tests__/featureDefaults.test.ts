import { FEATURE_DEFAULTS, resolveFeatureFlags } from '../featureDefaults';

describe('resolveFeatureFlags', () => {
  it('fills in every flag a datasource leaves unset', () => {
    expect(resolveFeatureFlags({})).toEqual(FEATURE_DEFAULTS);
    expect(resolveFeatureFlags()).toEqual(FEATURE_DEFAULTS);
  });

  it('treats an explicit undefined like an unset flag', () => {
    const flags = resolveFeatureFlags({ enableCogniteTimeSeries: undefined });
    expect(flags.enableCogniteTimeSeries).toBe(FEATURE_DEFAULTS.enableCogniteTimeSeries);
  });

  it('keeps a flag that is set, including one set off', () => {
    const flags = resolveFeatureFlags({
      enableCoreDataModelFeatures: false,
      enableEventsAdvancedFiltering: true,
    });
    expect(flags.enableCoreDataModelFeatures).toBe(false);
    expect(flags.enableEventsAdvancedFiltering).toBe(true);
    expect(flags.enableLegacyDataModelFeatures).toBe(FEATURE_DEFAULTS.enableLegacyDataModelFeatures);
  });

  it('turns Records, a beta, on unless a datasource turns it off', () => {
    expect(resolveFeatureFlags({}).enableRecords).toBe(true);
    expect(resolveFeatureFlags({ enableRecords: false }).enableRecords).toBe(false);
  });

  it('turns Synthetic time series, a beta, on unless a datasource turns it off', () => {
    expect(resolveFeatureFlags({}).enableSyntheticTimeSeries).toBe(true);
    expect(
      resolveFeatureFlags({ enableSyntheticTimeSeries: false }).enableSyntheticTimeSeries
    ).toBe(false);
  });
});
