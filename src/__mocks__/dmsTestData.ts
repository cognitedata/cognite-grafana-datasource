import { DMSSpace, DMSView, DMSInstance, CogniteActivity, InvolvedView } from '../types/dms';

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

// Mock data for CogniteActivity views
export const mockActivityViews: InvolvedView[] = [
  {
    space: 'cdf_cdm',
    externalId: 'CogniteActivity',
    version: 'v1',
  },
  {
    space: 'cdf_cdm',
    externalId: 'CogniteActivity',
    version: 'v2',
  },
];

export const mockSingleActivityView: InvolvedView[] = [
  {
    space: 'cdf_cdm',
    externalId: 'CogniteActivity',
    version: 'v1',
  },
];

// Mock CogniteActivity instances (as returned from DMS API with ISO string timestamps)
export const mockActivities: CogniteActivity[] = [
  {
    space: 'cdm_try',
    externalId: 'activity-temp-monitoring-1',
    version: 1,
    lastUpdatedTime: 1640995200000,
    createdTime: 1640995200000,
    name: 'Temperature Monitoring',
    description: 'Monitoring temperature levels in Building A',
    startTime: '2026-01-15T10:00:00Z',
    endTime: '2026-01-15T12:00:00Z',
    scheduledStartTime: '2026-01-15T09:00:00Z',
    scheduledEndTime: '2026-01-15T11:00:00Z',
    type: 'monitoring',
  },
  {
    space: 'cdm_try',
    externalId: 'activity-pressure-check-2',
    version: 1,
    lastUpdatedTime: 1640995200000,
    createdTime: 1640995200000,
    name: 'Pressure Check',
    description: 'Routine pressure sensor calibration',
    startTime: '2026-01-20T14:00:00Z',
    endTime: '2026-01-20T16:00:00Z',
    scheduledStartTime: '2026-01-20T13:30:00Z',
    scheduledEndTime: '2026-01-20T15:30:00Z',
    type: 'calibration',
  },
  {
    space: 'cdm_try',
    externalId: 'activity-maintenance-3',
    version: 1,
    lastUpdatedTime: 1640995200000,
    createdTime: 1640995200000,
    name: 'Equipment Maintenance',
    description: 'Scheduled maintenance for sensor equipment',
    startTime: '2026-01-25T08:00:00Z',
    endTime: '2026-01-25T17:00:00Z',
    type: 'maintenance',
  },
];

export const mockSingleActivity: CogniteActivity[] = [
  {
    space: 'cdm_try',
    externalId: 'activity-temp-monitoring-1',
    version: 1,
    lastUpdatedTime: 1640995200000,
    createdTime: 1640995200000,
    name: 'Temperature Monitoring',
    description: 'Monitoring temperature levels in Building A',
    startTime: '2026-01-15T10:00:00Z',
    endTime: '2026-01-15T12:00:00Z',
    scheduledStartTime: '2026-01-15T09:00:00Z',
    scheduledEndTime: '2026-01-15T11:00:00Z',
    type: 'monitoring',
  },
];

// Mock DMS instances representing activities (raw API response format)
export const mockActivityDMSInstances: DMSInstance[] = [
  {
    instanceType: 'node',
    space: 'cdm_try',
    externalId: 'activity-temp-monitoring-1',
    version: 1,
    lastUpdatedTime: 1640995200000,
    createdTime: 1640995200000,
    properties: {
      cdf_cdm: {
        'CogniteActivity/v1': {
          name: 'Temperature Monitoring',
          description: 'Monitoring temperature levels in Building A',
          startTime: '2026-01-15T10:00:00Z',
          endTime: '2026-01-15T12:00:00Z',
          scheduledStartTime: '2026-01-15T09:00:00Z',
          scheduledEndTime: '2026-01-15T11:00:00Z',
          type: 'monitoring',
          timeSeries: [
            {
              space: 'cdm_try',
              externalId: '59.9139-10.7522-current.temp',
            },
          ],
        },
      },
    },
  },
  {
    instanceType: 'node',
    space: 'cdm_try',
    externalId: 'activity-pressure-check-2',
    version: 1,
    lastUpdatedTime: 1640995200000,
    createdTime: 1640995200000,
    properties: {
      cdf_cdm: {
        'CogniteActivity/v1': {
          name: 'Pressure Check',
          description: 'Routine pressure sensor calibration',
          startTime: '2026-01-20T14:00:00Z',
          endTime: '2026-01-20T16:00:00Z',
          scheduledStartTime: '2026-01-20T13:30:00Z',
          scheduledEndTime: '2026-01-20T15:30:00Z',
          type: 'calibration',
          timeSeries: [
            {
              space: 'cdm_try',
              externalId: '59.9139-10.7522-current.pressure',
            },
          ],
        },
      },
    },
  },
];
