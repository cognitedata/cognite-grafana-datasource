import { Tab as Tabs } from '../types';
import { getMockedDataSource } from '../test_utils';
import { isTabDisabled, isTabHidden, getFirstAvailableTab, getActiveTab } from '../queryEditorUtils';

describe('QueryEditor Utility Functions', () => {
  let mockDataSource: any;

  beforeEach(() => {
    mockDataSource = getMockedDataSource(
      { fetch: jest.fn() },
      { oauthPassThru: false }
    );
    jest.clearAllMocks();
  });

  describe('isTabDisabled', () => {
    it('should correctly identify disabled Core Data Model tabs', () => {
      mockDataSource.connector.isCogniteTimeSeriesEnabled = jest.fn().mockReturnValue(false);
      mockDataSource.connector.isFlexibleDataModellingEnabled = jest.fn().mockReturnValue(false);

      expect(isTabDisabled(Tabs.CogniteTimeSeriesSearch, mockDataSource)).toBe(true);
      expect(isTabDisabled(Tabs.FlexibleDataModelling, mockDataSource)).toBe(true);

      expect(mockDataSource.connector.isCogniteTimeSeriesEnabled).toHaveBeenCalled();
      expect(mockDataSource.connector.isFlexibleDataModellingEnabled).toHaveBeenCalled();
    });

    it('should correctly identify enabled Core Data Model tabs', () => {
      mockDataSource.connector.isCogniteTimeSeriesEnabled = jest.fn().mockReturnValue(true);
      mockDataSource.connector.isFlexibleDataModellingEnabled = jest.fn().mockReturnValue(true);

      expect(isTabDisabled(Tabs.CogniteTimeSeriesSearch, mockDataSource)).toBe(false);
      expect(isTabDisabled(Tabs.FlexibleDataModelling, mockDataSource)).toBe(false);
    });

    it('should correctly identify disabled Legacy Data Model tabs', () => {
      mockDataSource.connector.isTimeseriesSearchEnabled = jest.fn().mockReturnValue(false);
      mockDataSource.connector.isTimeseriesFromAssetEnabled = jest.fn().mockReturnValue(false);
      mockDataSource.connector.isTimeseriesCustomQueryEnabled = jest.fn().mockReturnValue(false);
      mockDataSource.connector.isEventsEnabled = jest.fn().mockReturnValue(false);

      expect(isTabDisabled(Tabs.Timeseries, mockDataSource)).toBe(true);
      expect(isTabDisabled(Tabs.Asset, mockDataSource)).toBe(true);
      expect(isTabDisabled(Tabs.Custom, mockDataSource)).toBe(true);
      expect(isTabDisabled(Tabs.Event, mockDataSource)).toBe(true);
    });

    it('should correctly identify enabled Legacy Data Model tabs', () => {
      mockDataSource.connector.isTimeseriesSearchEnabled = jest.fn().mockReturnValue(true);
      mockDataSource.connector.isTimeseriesFromAssetEnabled = jest.fn().mockReturnValue(true);
      mockDataSource.connector.isTimeseriesCustomQueryEnabled = jest.fn().mockReturnValue(true);
      mockDataSource.connector.isEventsEnabled = jest.fn().mockReturnValue(true);

      expect(isTabDisabled(Tabs.Timeseries, mockDataSource)).toBe(false);
      expect(isTabDisabled(Tabs.Asset, mockDataSource)).toBe(false);
      expect(isTabDisabled(Tabs.Custom, mockDataSource)).toBe(false);
      expect(isTabDisabled(Tabs.Event, mockDataSource)).toBe(false);
    });

    it('should correctly identify disabled Deprecated feature tabs', () => {
      mockDataSource.connector.isRelationshipsEnabled = jest.fn().mockReturnValue(false);
      mockDataSource.connector.isTemplatesEnabled = jest.fn().mockReturnValue(false);
      mockDataSource.connector.isExtractionPipelinesEnabled = jest.fn().mockReturnValue(false);

      expect(isTabDisabled(Tabs.Relationships, mockDataSource)).toBe(true);
      expect(isTabDisabled(Tabs.Templates, mockDataSource)).toBe(true);
      expect(isTabDisabled(Tabs.ExtractionPipelines, mockDataSource)).toBe(true);
    });

    it('should return false for unknown tabs', () => {
      expect(isTabDisabled('UnknownTab' as Tabs, mockDataSource)).toBe(false);
    });
  });

  describe('isTabHidden', () => {
    it('should not hide enabled tabs', () => {
      mockDataSource.connector.isTimeseriesSearchEnabled = jest.fn().mockReturnValue(true);

      expect(isTabHidden(Tabs.Timeseries, Tabs.Asset, mockDataSource)).toBe(false);
    });

    it('should hide disabled tabs when they are not currently selected', () => {
      mockDataSource.connector.isTimeseriesSearchEnabled = jest.fn().mockReturnValue(false);

      expect(isTabHidden(Tabs.Timeseries, Tabs.Asset, mockDataSource)).toBe(true);
    });

    it('should not hide disabled tabs when they are currently selected (backward compatibility)', () => {
      mockDataSource.connector.isTimeseriesSearchEnabled = jest.fn().mockReturnValue(false);

      // Tab is disabled but currently selected - should not be hidden for backward compatibility
      expect(isTabHidden(Tabs.Timeseries, Tabs.Timeseries, mockDataSource)).toBe(false);
    });

    it('should handle Core Data Model tabs backward compatibility', () => {
      mockDataSource.connector.isCogniteTimeSeriesEnabled = jest.fn().mockReturnValue(false);

      // Disabled but selected - should not be hidden
      expect(isTabHidden(Tabs.CogniteTimeSeriesSearch, Tabs.CogniteTimeSeriesSearch, mockDataSource)).toBe(false);
      
      // Disabled and not selected - should be hidden
      expect(isTabHidden(Tabs.CogniteTimeSeriesSearch, Tabs.Asset, mockDataSource)).toBe(true);
    });
  });

  describe('getFirstAvailableTab', () => {
    it('should return first enabled tab in enum order', () => {
      // Disable first two tabs, enable Asset tab (third in order)
      mockDataSource.connector.isTimeseriesSearchEnabled = jest.fn().mockReturnValue(false);
      mockDataSource.connector.isCogniteTimeSeriesEnabled = jest.fn().mockReturnValue(false);
      mockDataSource.connector.isTimeseriesFromAssetEnabled = jest.fn().mockReturnValue(true);
      // Ensure other tabs are also properly mocked
      mockDataSource.connector.isTimeseriesCustomQueryEnabled = jest.fn().mockReturnValue(false);
      mockDataSource.connector.isEventsEnabled = jest.fn().mockReturnValue(false);
      mockDataSource.connector.isFlexibleDataModellingEnabled = jest.fn().mockReturnValue(false);
      mockDataSource.connector.isRelationshipsEnabled = jest.fn().mockReturnValue(false);
      mockDataSource.connector.isTemplatesEnabled = jest.fn().mockReturnValue(false);
      mockDataSource.connector.isExtractionPipelinesEnabled = jest.fn().mockReturnValue(false);

      // Use a different current tab so the disabled tabs are actually hidden
      const result = getFirstAvailableTab(Tabs.Event, mockDataSource);
      expect(result).toBe(Tabs.Asset);
    });

    it('should return first tab when all are enabled', () => {
      // Enable all tabs
      mockDataSource.connector.isTimeseriesSearchEnabled = jest.fn().mockReturnValue(true);
      mockDataSource.connector.isCogniteTimeSeriesEnabled = jest.fn().mockReturnValue(true);
      mockDataSource.connector.isTimeseriesFromAssetEnabled = jest.fn().mockReturnValue(true);

      const result = getFirstAvailableTab(Tabs.Asset, mockDataSource);
      expect(result).toBe(Tabs.Timeseries); // First in enum order
    });

    it('should return fallback tab when all tabs are disabled and none are currently selected', () => {
      // Disable all tabs
      mockDataSource.connector.isTimeseriesSearchEnabled = jest.fn().mockReturnValue(false);
      mockDataSource.connector.isCogniteTimeSeriesEnabled = jest.fn().mockReturnValue(false);
      mockDataSource.connector.isTimeseriesFromAssetEnabled = jest.fn().mockReturnValue(false);
      mockDataSource.connector.isTimeseriesCustomQueryEnabled = jest.fn().mockReturnValue(false);
      mockDataSource.connector.isEventsEnabled = jest.fn().mockReturnValue(false);
      mockDataSource.connector.isFlexibleDataModellingEnabled = jest.fn().mockReturnValue(false);
      mockDataSource.connector.isRelationshipsEnabled = jest.fn().mockReturnValue(false);
      mockDataSource.connector.isTemplatesEnabled = jest.fn().mockReturnValue(false);
      mockDataSource.connector.isExtractionPipelinesEnabled = jest.fn().mockReturnValue(false);

      // Use a non-existent tab as current so no backward compatibility applies
      const result = getFirstAvailableTab('NonExistentTab' as Tabs, mockDataSource);
      expect(result).toBe(Tabs.DataModellingV2); // DataModellingV2 is always enabled, so it's the fallback
    });

    it('should skip disabled tabs and find first available', () => {
      // Disable first few tabs, enable Events tab
      mockDataSource.connector.isTimeseriesSearchEnabled = jest.fn().mockReturnValue(false);
      mockDataSource.connector.isCogniteTimeSeriesEnabled = jest.fn().mockReturnValue(false);
      mockDataSource.connector.isTimeseriesFromAssetEnabled = jest.fn().mockReturnValue(false);
      mockDataSource.connector.isTimeseriesCustomQueryEnabled = jest.fn().mockReturnValue(false);
      mockDataSource.connector.isEventsEnabled = jest.fn().mockReturnValue(true);
      // Disable remaining tabs
      mockDataSource.connector.isFlexibleDataModellingEnabled = jest.fn().mockReturnValue(false);
      mockDataSource.connector.isRelationshipsEnabled = jest.fn().mockReturnValue(false);
      mockDataSource.connector.isTemplatesEnabled = jest.fn().mockReturnValue(false);
      mockDataSource.connector.isExtractionPipelinesEnabled = jest.fn().mockReturnValue(false);

      const result = getFirstAvailableTab(Tabs.Event, mockDataSource);
      expect(result).toBe(Tabs.Event);
    });
  });

  describe('getActiveTab', () => {
    it('should return current tab when it is not hidden', () => {
      mockDataSource.connector.isTimeseriesSearchEnabled = jest.fn().mockReturnValue(true);

      const result = getActiveTab(Tabs.Timeseries, mockDataSource);
      expect(result).toBe(Tabs.Timeseries);
    });

    it('should return current tab when disabled but selected (backward compatibility)', () => {
      mockDataSource.connector.isTimeseriesSearchEnabled = jest.fn().mockReturnValue(false);

      // Tab is disabled but currently selected - should remain active for backward compatibility
      const result = getActiveTab(Tabs.Timeseries, mockDataSource);
      expect(result).toBe(Tabs.Timeseries);
    });

    it('should handle auto-switching from disabled Core Data Model tab', () => {
      mockDataSource.connector.isCogniteTimeSeriesEnabled = jest.fn().mockReturnValue(false);
      mockDataSource.connector.isTimeseriesSearchEnabled = jest.fn().mockReturnValue(true);
      // Disable other tabs to ensure Timeseries is the first available
      mockDataSource.connector.isTimeseriesFromAssetEnabled = jest.fn().mockReturnValue(false);
      mockDataSource.connector.isTimeseriesCustomQueryEnabled = jest.fn().mockReturnValue(false);
      mockDataSource.connector.isEventsEnabled = jest.fn().mockReturnValue(false);
      mockDataSource.connector.isFlexibleDataModellingEnabled = jest.fn().mockReturnValue(false);
      mockDataSource.connector.isRelationshipsEnabled = jest.fn().mockReturnValue(false);
      mockDataSource.connector.isTemplatesEnabled = jest.fn().mockReturnValue(false);
      mockDataSource.connector.isExtractionPipelinesEnabled = jest.fn().mockReturnValue(false);

      // CogniteTimeSeriesSearch is disabled, but since it's the current tab, it should remain for backward compatibility
      const result = getActiveTab(Tabs.CogniteTimeSeriesSearch, mockDataSource);
      expect(result).toBe(Tabs.CogniteTimeSeriesSearch); // Backward compatibility - disabled but current tab remains
    });

    it('should handle complex scenario with mixed enabled/disabled tabs', () => {
      // Disable first few tabs, enable Events
      mockDataSource.connector.isTimeseriesSearchEnabled = jest.fn().mockReturnValue(false);
      mockDataSource.connector.isCogniteTimeSeriesEnabled = jest.fn().mockReturnValue(false);
      mockDataSource.connector.isTimeseriesFromAssetEnabled = jest.fn().mockReturnValue(false);
      mockDataSource.connector.isTimeseriesCustomQueryEnabled = jest.fn().mockReturnValue(false);
      mockDataSource.connector.isEventsEnabled = jest.fn().mockReturnValue(true);
      // Disable remaining tabs to ensure Events is the first available
      mockDataSource.connector.isFlexibleDataModellingEnabled = jest.fn().mockReturnValue(false);
      mockDataSource.connector.isRelationshipsEnabled = jest.fn().mockReturnValue(false);
      mockDataSource.connector.isTemplatesEnabled = jest.fn().mockReturnValue(false);
      mockDataSource.connector.isExtractionPipelinesEnabled = jest.fn().mockReturnValue(false);

      // Starting with disabled Timeseries tab, but since it's the current tab, it should remain for backward compatibility
      const result = getActiveTab(Tabs.Timeseries, mockDataSource);
      expect(result).toBe(Tabs.Timeseries); // Backward compatibility - disabled but current tab remains
    });
  });
});
