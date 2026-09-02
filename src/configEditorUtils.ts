import { ChangeEvent } from "react";
import { CogniteDataSourceOptions, CogniteSecureJsonData } from "./types";

/**
 * Handler for string value changes in jsonData
 */
export const stringValueHandler = (
  key: keyof CogniteDataSourceOptions,
  onJsonDataChange: (patch: Partial<CogniteDataSourceOptions>) => void,
) =>
(event: ChangeEvent<HTMLInputElement>) =>
  onJsonDataChange({ [key]: event.target.value });

/**
 * Strip an optional http(s):// scheme and trailing slashes from a hostname-like
 * value. The plugin route in plugin.json hardcodes the https:// scheme, so the
 * stored value must be a bare hostname.
 */
export const sanitizeHostname = (value: string): string =>
  value.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");

/**
 * Handler for hostname value changes - strips any scheme/trailing slashes so
 * pasted full URLs (e.g. https://bluefield.cognitedata.com) still work.
 */
export const hostnameValueHandler = (
  key: keyof CogniteDataSourceOptions,
  onJsonDataChange: (patch: Partial<CogniteDataSourceOptions>) => void,
) =>
(event: ChangeEvent<HTMLInputElement>) =>
  onJsonDataChange({ [key]: sanitizeHostname(event.target.value) });

/**
 * Handler for boolean value changes in jsonData
 */
export const boolValueHandler = (
  key: keyof CogniteDataSourceOptions,
  onJsonDataChange: (patch: Partial<CogniteDataSourceOptions>) => void,
) =>
(event: ChangeEvent<HTMLInputElement>) =>
  onJsonDataChange({ [key]: event.currentTarget.checked });

/**
 * Handler for secret value changes
 */
export const secretValueHandler = (
  secretKey: keyof CogniteSecureJsonData,
  options: any,
  onOptionsChange: (options: any) => void,
) =>
(event: ChangeEvent<HTMLInputElement>) =>
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
  onOptionsChange: (options: any) => void,
) =>
() =>
  onOptionsChange({
    ...options,
    secureJsonFields: {
      ...options.secureJsonFields,
      [secretKey]: false,
    },
    secureJsonData: {
      ...options.secureJsonData,
      [secretKey]: "",
    },
  });

