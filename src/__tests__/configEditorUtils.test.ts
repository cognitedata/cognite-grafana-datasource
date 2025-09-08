import { 
  stringValueHandler, 
  boolValueHandler, 
  secretValueHandler, 
  resetSecretHandler,
  masterToggleHandler
} from '../configEditorUtils';
import { FEATURE_DEFAULTS } from '../featureDefaults';

describe('ConfigEditor Utility Functions', () => {
  let mockOnJsonDataChange: jest.Mock;
  let mockOnOptionsChange: jest.Mock;

  beforeEach(() => {
    mockOnJsonDataChange = jest.fn();
    mockOnOptionsChange = jest.fn();
  });

  describe('stringValueHandler', () => {
    it('should create a handler that updates string values in jsonData', () => {
      const handler = stringValueHandler('cogniteProject', mockOnJsonDataChange);
      
      const mockEvent = {
        target: { value: 'new-project' }
      } as React.ChangeEvent<HTMLInputElement>;

      handler(mockEvent);

      expect(mockOnJsonDataChange).toHaveBeenCalledWith({
        cogniteProject: 'new-project',
      });
    });

    it('should handle empty string values', () => {
      const handler = stringValueHandler('cogniteApiUrl', mockOnJsonDataChange);
      
      const mockEvent = {
        target: { value: 'https://api.cognitedata.com' }
      } as React.ChangeEvent<HTMLInputElement>;

      handler(mockEvent);

      expect(mockOnJsonDataChange).toHaveBeenCalledWith({
        cogniteApiUrl: 'https://api.cognitedata.com',
      });
    });

    it('should handle special characters', () => {
      const handler = stringValueHandler('oauthClientId', mockOnJsonDataChange);
      
      const mockEvent = {
        target: { value: 'client-id_123!@#' }
      } as React.ChangeEvent<HTMLInputElement>;

      handler(mockEvent);

      expect(mockOnJsonDataChange).toHaveBeenCalledWith({
        oauthClientId: 'client-id_123!@#',
      });
    });
  });

  describe('boolValueHandler', () => {
    it('should create a handler that updates boolean values in jsonData', () => {
      const handler = boolValueHandler('oauthPassThru', mockOnJsonDataChange);
      
      const mockEvent = {
        currentTarget: { checked: true }
      } as React.ChangeEvent<HTMLInputElement>;

      handler(mockEvent);

      expect(mockOnJsonDataChange).toHaveBeenCalledWith({
        oauthPassThru: true,
      });
    });

    it('should handle false values', () => {
      const handler = boolValueHandler('enableEventsAdvancedFiltering', mockOnJsonDataChange);
      
      const mockEvent = {
        currentTarget: { checked: false }
      } as React.ChangeEvent<HTMLInputElement>;

      handler(mockEvent);

      expect(mockOnJsonDataChange).toHaveBeenCalledWith({
        enableEventsAdvancedFiltering: false,
      });
    });
  });

  describe('secretValueHandler', () => {
    let mockOptions: any;

    beforeEach(() => {
      mockOptions = {
        secureJsonData: {},
        secureJsonFields: {},
        jsonData: {}
      };
    });

    it('should create a handler that updates secret values', () => {
      const handler = secretValueHandler('oauthClientSecret', mockOptions, mockOnOptionsChange);
      
      const mockEvent = {
        target: { value: 'secret-value' }
      } as React.ChangeEvent<HTMLInputElement>;

      handler(mockEvent);

      expect(mockOnOptionsChange).toHaveBeenCalledWith({
        ...mockOptions,
        secureJsonData: {
          oauthClientSecret: 'secret-value',
        },
      });
    });

  });

  describe('resetSecretHandler', () => {
    let mockOptions: any;

    beforeEach(() => {
      mockOptions = {
        secureJsonData: { oauthClientSecret: 'existing-secret' },
        secureJsonFields: { oauthClientSecret: true },
        jsonData: {}
      };
    });

    it('should create a handler that resets secret values', () => {
      const handler = resetSecretHandler('oauthClientSecret', mockOptions, mockOnOptionsChange);
      
      handler();

      expect(mockOnOptionsChange).toHaveBeenCalledWith({
        ...mockOptions,
        secureJsonFields: {
          ...mockOptions.secureJsonFields,
          oauthClientSecret: false,
        },
        secureJsonData: {
          ...mockOptions.secureJsonData,
          oauthClientSecret: '',
        },
      });
    });

    it('should preserve other secret fields when resetting', () => {
      const optionsWithMultipleSecrets = {
        secureJsonData: { 
          oauthClientSecret: 'secret1', 
          anotherSecret: 'secret2' 
        },
        secureJsonFields: { 
          oauthClientSecret: true, 
          anotherSecret: true 
        },
        jsonData: {}
      };

      const handler = resetSecretHandler('oauthClientSecret', optionsWithMultipleSecrets, mockOnOptionsChange);
      
      handler();

      const call = mockOnOptionsChange.mock.calls[0][0];
      expect(call.secureJsonFields.oauthClientSecret).toBe(false);
      expect(call.secureJsonFields.anotherSecret).toBe(true);
      expect(call.secureJsonData.oauthClientSecret).toBe('');
      expect(call.secureJsonData.anotherSecret).toBe('secret2');
    });
  });

  describe('masterToggleHandler', () => {
    it('should create a handler that enables master toggle and sets dependent features to defaults', () => {
      const handler = masterToggleHandler(
        'enableCoreDataModelFeatures',
        ['enableCogniteTimeSeries', 'enableFlexibleDataModelling'],
        mockOnJsonDataChange
      );

      const mockEvent = {
        currentTarget: { checked: true }
      } as React.ChangeEvent<HTMLInputElement>;

      handler(mockEvent);

      const call = mockOnJsonDataChange.mock.calls[0][0];
      expect(call.enableCoreDataModelFeatures).toBe(true);
      expect(call.enableCogniteTimeSeries).toBe(true); // Core features are enabled when master is enabled
      expect(call.enableFlexibleDataModelling).toBe(true); // Core features are enabled when master is enabled
    });

    it('should create a handler that disables master toggle and sets dependent features to false', () => {
      const handler = masterToggleHandler(
        'enableCoreDataModelFeatures',
        ['enableCogniteTimeSeries', 'enableFlexibleDataModelling'],
        mockOnJsonDataChange
      );

      const mockEvent = {
        currentTarget: { checked: false }
      } as React.ChangeEvent<HTMLInputElement>;

      handler(mockEvent);

      const call = mockOnJsonDataChange.mock.calls[0][0];
      expect(call.enableCoreDataModelFeatures).toBe(false);
      expect(call.enableCogniteTimeSeries).toBe(false);
      expect(call.enableFlexibleDataModelling).toBe(false);
    });

    it('should handle legacy data model features with correct defaults', () => {
      const handler = masterToggleHandler(
        'enableLegacyDataModelFeatures',
        [
          'enableTimeseriesSearch',
          'enableTimeseriesFromAsset', 
          'enableTimeseriesCustomQuery',
          'enableEvents',
          'enableEventsAdvancedFiltering'
        ],
        mockOnJsonDataChange
      );

      const mockEvent = {
        currentTarget: { checked: true }
      } as React.ChangeEvent<HTMLInputElement>;

      handler(mockEvent);

      const call = mockOnJsonDataChange.mock.calls[0][0];
      expect(call.enableLegacyDataModelFeatures).toBe(true);
      expect(call.enableTimeseriesSearch).toBe(FEATURE_DEFAULTS.enableTimeseriesSearch);
      expect(call.enableTimeseriesFromAsset).toBe(FEATURE_DEFAULTS.enableTimeseriesFromAsset);
      expect(call.enableTimeseriesCustomQuery).toBe(FEATURE_DEFAULTS.enableTimeseriesCustomQuery);
      expect(call.enableEvents).toBe(FEATURE_DEFAULTS.enableEvents);
      expect(call.enableEventsAdvancedFiltering).toBe(FEATURE_DEFAULTS.enableEventsAdvancedFiltering);
      
      // Verify that enableEventsAdvancedFiltering matches the default
      expect(call.enableEventsAdvancedFiltering).toBe(false);
      expect(FEATURE_DEFAULTS.enableEventsAdvancedFiltering).toBe(false);
    });

    it('should create a handler for legacy features that uses defaults when enabling', () => {
      const handler = masterToggleHandler(
        'enableLegacyDataModelFeatures',
        ['enableTimeseriesSearch', 'enableEvents'],
        mockOnJsonDataChange
      );

      const mockEvent = {
        currentTarget: { checked: true }
      } as React.ChangeEvent<HTMLInputElement>;

      handler(mockEvent);

      const call = mockOnJsonDataChange.mock.calls[0][0];
      expect(call.enableLegacyDataModelFeatures).toBe(true);
      expect(call.enableTimeseriesSearch).toBe(FEATURE_DEFAULTS.enableTimeseriesSearch); // Legacy uses defaults
      expect(call.enableEvents).toBe(FEATURE_DEFAULTS.enableEvents); // Legacy uses defaults
    });
  });
});
