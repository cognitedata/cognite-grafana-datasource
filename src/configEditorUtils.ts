import { ChangeEvent } from 'react';
import { FEATURE_DEFAULTS, FeatureKey } from './featureDefaults';
import { CogniteDataSourceOptions, CogniteSecureJsonData } from './types';

/**
 * Handler for string value changes in jsonData
 */
export const stringValueHandler = (
  key: keyof CogniteDataSourceOptions,
  onJsonDataChange: (patch: Partial<CogniteDataSourceOptions>) => void
) => (event: ChangeEvent<HTMLInputElement>) =>
  onJsonDataChange({ [key]: event.target.value });

/**
 * Handler for boolean value changes in jsonData
 */
export const boolValueHandler = (
  key: keyof CogniteDataSourceOptions,
  onJsonDataChange: (patch: Partial<CogniteDataSourceOptions>) => void
) => (event: ChangeEvent<HTMLInputElement>) =>
  onJsonDataChange({ [key]: event.currentTarget.checked });

/**
 * Handler for secret value changes
 */
export const secretValueHandler = (
  secretKey: keyof CogniteSecureJsonData,
  options: any,
  onOptionsChange: (options: any) => void
) => (event: ChangeEvent<HTMLInputElement>) =>
  onOptionsChange({
    ...options,
    secureJsonData: {
      [secretKey]: event.target.value,
    },
  });

/**
 * Handler for resetting secret values
 */
export const resetSecretHandler = (
  secretKey: keyof CogniteSecureJsonData,
  options: any,
  onOptionsChange: (options: any) => void
) => () =>
  onOptionsChange({
    ...options,
    secureJsonFields: {
      ...options.secureJsonFields,
      [secretKey]: false,
    },
    secureJsonData: {
      ...options.secureJsonData,
      [secretKey]: '',
    },
  });

/**
 * Handler for master toggle changes - manages underlying feature toggles based on master state
 */
export const masterToggleHandler = (
  masterKey: FeatureKey,
  dependentKeys: FeatureKey[],
  onJsonDataChange: (patch: Partial<CogniteDataSourceOptions>) => void
) => (event: ChangeEvent<HTMLInputElement>) => {
  const isEnabled = event.currentTarget.checked;
  
  // Create patch object with master toggle and dependent features
  const patch: Partial<Pick<CogniteDataSourceOptions, FeatureKey>> = {
    [masterKey]: isEnabled,
  };
  
  // When enabling master toggle, enable all dependent features
  // When disabling master toggle, set dependent features to false
  dependentKeys.forEach((key) => {
    if (isEnabled) {
      // For core data model features, enable them when master is enabled
      if (masterKey === 'enableCoreDataModelFeatures') {
        patch[key] = true;
      } else {
        // For other master toggles, use their defaults
        patch[key] = FEATURE_DEFAULTS[key];
      }
    } else {
      // When disabling master toggle, disable all dependent features
      patch[key] = false;
    }
  });
  
  onJsonDataChange(patch);
};
