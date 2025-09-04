import { DMSSpace, DMSView, DMSInstance } from '../types/dms';

export const mockSpaces: DMSSpace[] = [
  {
    space: 'cdf_cdm',
    name: 'CDF CDM',
    description: 'Common Data Model',
    createdTime: 1640995200000,
    lastUpdatedTime: 1640995200000,
  },
  {
    space: 'my_space',
    name: 'My Space',
    description: 'Custom space',
    createdTime: 1640995200000,
    lastUpdatedTime: 1640995200000,
  },
];

export const mockViews: DMSView[] = [
  {
    space: 'cdf_cdm',
    externalId: 'CogniteTimeSeries',
    version: 'v1',
    name: 'Cognite Time Series',
    description: 'Time series view',
    createdTime: 1640995200000,
    lastUpdatedTime: 1640995200000,
  },
  {
    space: 'cdf_cdm',
    externalId: 'CogniteAsset',
    version: 'v1',
    name: 'Cognite Asset',
    description: 'Asset view',
    createdTime: 1640995200000,
    lastUpdatedTime: 1640995200000,
  },
];

export const mockInstances: DMSInstance[] = [
  {
    instanceType: 'node',
    space: 'cdf_cdm',
    externalId: 'temperature_sensor_1',
    version: 1,
    lastUpdatedTime: 1640995200000,
    createdTime: 1640995200000,
    properties: {
      cdf_cdm: {
        'CogniteTimeSeries/v1': {
          name: 'Temperature Sensor 1',
          description: 'Building A temperature sensor',
          type: 'numeric',
        },
      },
    },
  },
  {
    instanceType: 'node',
    space: 'cdf_cdm',
    externalId: 'pressure_sensor_1',
    version: 1,
    lastUpdatedTime: 1640995200000,
    createdTime: 1640995200000,
    properties: {
      cdf_cdm: {
        'CogniteTimeSeries/v1': {
          name: 'Pressure Sensor 1',
          description: 'Building A pressure sensor',
          type: 'numeric',
        },
      },
    },
  },
];

export const mockInstancesWithStringType: DMSInstance[] = [
  {
    instanceType: 'node',
    space: 'cdf_cdm',
    externalId: 'numeric_sensor',
    version: 1,
    lastUpdatedTime: 1640995200000,
    createdTime: 1640995200000,
    properties: {
      cdf_cdm: {
        'CogniteTimeSeries/v1': {
          name: 'Numeric Sensor',
          type: 'numeric',
        },
      },
    },
  },
  {
    instanceType: 'node',
    space: 'cdf_cdm',
    externalId: 'string_sensor',
    version: 1,
    lastUpdatedTime: 1640995200000,
    createdTime: 1640995200000,
    properties: {
      cdf_cdm: {
        'CogniteTimeSeries/v1': {
          name: 'String Sensor',
          type: 'string',
        },
      },
    },
  },
];

export const mockSingleSpace: DMSSpace[] = [
  {
    space: 'cdf_cdm',
    name: 'CDF CDM',
    description: 'Common Data Model',
    createdTime: 1640995200000,
    lastUpdatedTime: 1640995200000,
  },
];

export const mockSingleView: DMSView[] = [
  {
    space: 'cdf_cdm',
    externalId: 'CogniteTimeSeries',
    version: 'v1',
    name: 'Cognite Time Series',
    description: 'Time series view',
    createdTime: 1640995200000,
    lastUpdatedTime: 1640995200000,
  },
];

export const mockSingleInstance: DMSInstance[] = [
  {
    instanceType: 'node',
    space: 'cdf_cdm',
    externalId: 'temperature_sensor_1',
    version: 1,
    lastUpdatedTime: 1640995200000,
    createdTime: 1640995200000,
    properties: {
      cdf_cdm: {
        'CogniteTimeSeries/v1': {
          name: 'Temperature Sensor 1',
          type: 'numeric',
        },
      },
    },
  },
];
