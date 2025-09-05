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
  
  // When enabling master toggle, set dependent features to their defaults
  // When disabling master toggle, set dependent features to false
  dependentKeys.forEach((key) => {
    patch[key] = isEnabled ? FEATURE_DEFAULTS[key] : false;
  });
  
  onJsonDataChange(patch as Partial<CogniteDataSourceOptions>);
};
