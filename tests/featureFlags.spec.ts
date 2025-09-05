import { test as base, expect, PluginFixture, PluginOptions } from '@grafana/plugin-e2e';
import { readProvisionedDataSource } from '../playwright/fixtures/readProvisionedDataSource';

const test = base.extend<PluginFixture, PluginOptions>({ readProvisionedDataSource });

test.describe('Feature Flags - Tab Visibility', () => {
  test('Legacy-only dashboard should show only legacy tabs', async ({
    readProvisionedDataSource,
    readProvisionedDashboard,
    gotoDashboardPage,
    page,
  }) => {
    const ds = await readProvisionedDataSource({ fileName: 'datasources.yml', uid: 'legacy-only' });
    const dashboard = await readProvisionedDashboard({ fileName: 'weather-station-legacy.json' });
    const dashboardPage = await gotoDashboardPage(dashboard);

    // Add a new panel to test tab visibility
    const panelEditPage = await dashboardPage.addPanel();
    
    // Manually select the legacy-only data source by typing in the selector
    const dataSourceSelector = page.getByTestId('data-testid Select a data source');
    await dataSourceSelector.click();
    await dataSourceSelector.fill('Cognite Data Fusion - Legacy Only');
    await page.keyboard.press('Enter');
    
    // Wait for the data source to be properly selected and query editor to update
    await page.waitForTimeout(1000);

    const editorRow = panelEditPage.getQueryEditorRow("A");

    // Legacy tabs should be visible and clickable
    await expect(editorRow.getByText('Time series search')).toBeVisible();
    await expect(editorRow.getByText('Events')).toBeVisible();
    // Note: Relationships is a deprecated feature, so it's hidden for new panels

    // Test that we can click on legacy tabs
    await editorRow.getByText('Time series search').click();
    await expect(editorRow.getByText('Time series search')).toHaveAttribute('aria-selected', 'true');

    // Core data model tabs should be hidden (not visible in tab bar)
    await expect(editorRow.getByText('CogniteTimeSeries')).not.toBeVisible();
    await expect(editorRow.getByText('Data Models')).not.toBeVisible();
  });

  test('Core-only dashboard should show only core data model tabs', async ({
    readProvisionedDataSource,
    readProvisionedDashboard,
    gotoDashboardPage,
    page,
  }) => {
    const ds = await readProvisionedDataSource({ fileName: 'datasources.yml', uid: 'core-only' });
    const dashboard = await readProvisionedDashboard({ fileName: 'weather-station-core.json' });
    const dashboardPage = await gotoDashboardPage(dashboard);

    // Add a new panel to test tab visibility
    const panelEditPage = await dashboardPage.addPanel();
    
    // Manually select the core-only data source by typing in the selector
    const dataSourceSelector = page.getByTestId('data-testid Select a data source');
    await dataSourceSelector.click();
    await dataSourceSelector.fill('Cognite Data Fusion - Core Only');
    await page.keyboard.press('Enter');
    
    // Wait for the data source to be properly selected and query editor to update
    await page.waitForTimeout(1000);

    const editorRow = panelEditPage.getQueryEditorRow("A");

    // Core data model tabs should be visible and clickable
    await expect(editorRow.getByText('CogniteTimeSeries')).toBeVisible();
    await expect(editorRow.getByText('Data Models')).toBeVisible();

    // Test that we can click on core tabs
    await editorRow.getByText('CogniteTimeSeries').click();
    await expect(editorRow.getByText('CogniteTimeSeries')).toHaveAttribute('aria-selected', 'true');

    // Legacy tabs should be hidden (not visible in tab bar)
    await expect(editorRow.getByText('Time series search')).not.toBeVisible();
    await expect(editorRow.getByText('Events')).not.toBeVisible();
    await expect(editorRow.getByText('Relationships')).not.toBeVisible();
  });

});

test.describe('Feature Flags - Config Editor', () => {
  test('Should toggle legacy data model features on/off', async ({
    readProvisionedDataSource,
    gotoDataSourceConfigPage,
    page,
  }) => {
    const datasource = await readProvisionedDataSource({ fileName: 'datasources.yml', uid: '42' });
    const configPage = await gotoDataSourceConfigPage(datasource.uid);

    // Wait for the page to fully load
    await page.waitForLoadState('networkidle');

    // Scroll to the feature flags section at the bottom
    const legacyMasterToggle = page.locator('#enable-legacy-data-model-features');
    await legacyMasterToggle.scrollIntoViewIfNeeded();
    await expect(legacyMasterToggle).toBeVisible();

    // Check the initial state (may vary based on provisioned config)
    const initiallyChecked = await legacyMasterToggle.isChecked();
    
    // If not initially checked, enable it first
    if (!initiallyChecked) {
      await legacyMasterToggle.check({ force: true });
    }
    await expect(legacyMasterToggle).toBeChecked();

    // Individual legacy feature toggles should be visible and enabled
    await expect(page.locator('#enable-timeseries-search')).toBeVisible();
    await expect(page.locator('#enable-timeseries-from-asset')).toBeVisible();
    await expect(page.locator('#enable-timeseries-custom-query')).toBeVisible();
    await expect(page.locator('#enable-events')).toBeVisible();

    // Turn off legacy features
    await legacyMasterToggle.scrollIntoViewIfNeeded();
    await legacyMasterToggle.uncheck({ force: true });
    await expect(legacyMasterToggle).not.toBeChecked();

    // Individual toggles should be disabled/hidden
    await expect(page.locator('#enable-timeseries-search')).not.toBeChecked();
    await expect(page.locator('#enable-timeseries-from-asset')).not.toBeChecked();
    await expect(page.locator('#enable-timeseries-custom-query')).not.toBeChecked();
    await expect(page.locator('#enable-events')).not.toBeChecked();

    // Turn legacy features back on
    await legacyMasterToggle.scrollIntoViewIfNeeded();
    await legacyMasterToggle.check({ force: true });
    await expect(legacyMasterToggle).toBeChecked();

    // Individual toggles should be enabled again (with their default values)
    await expect(page.locator('#enable-timeseries-search')).toBeChecked();
    await expect(page.locator('#enable-timeseries-from-asset')).toBeChecked();
    await expect(page.locator('#enable-timeseries-custom-query')).toBeChecked();
    await expect(page.locator('#enable-events')).toBeChecked();
  });

  test('Should toggle core data model features on/off', async ({
    readProvisionedDataSource,
    gotoDataSourceConfigPage,
    page,
  }) => {
    const datasource = await readProvisionedDataSource({ fileName: 'datasources.yml', uid: '42' });
    const configPage = await gotoDataSourceConfigPage(datasource.uid);

    // Wait for the page to fully load and scroll to feature flags
    await page.waitForLoadState('networkidle');
    const coreMasterToggle = page.locator('#enable-core-data-model-features');
    await coreMasterToggle.scrollIntoViewIfNeeded();
    await expect(coreMasterToggle).toBeVisible();

    // Check the initial state and ensure it's enabled for testing
    const initiallyChecked = await coreMasterToggle.isChecked();
    if (!initiallyChecked) {
      await coreMasterToggle.check({ force: true });
    }
    await expect(coreMasterToggle).toBeChecked();

    // Individual core feature toggles should be visible
    await expect(page.locator('#enable-cognite-timeseries')).toBeVisible();
    await expect(page.locator('#enable-flexible-data-modelling')).toBeVisible();

    // Turn off core features
    await coreMasterToggle.scrollIntoViewIfNeeded();
    await coreMasterToggle.uncheck({ force: true });
    await expect(coreMasterToggle).not.toBeChecked();

    // Individual toggles should be disabled
    await expect(page.locator('#enable-cognite-timeseries')).not.toBeChecked();
    await expect(page.locator('#enable-flexible-data-modelling')).not.toBeChecked();

    // Turn core features back on
    await coreMasterToggle.scrollIntoViewIfNeeded();
    await coreMasterToggle.check({ force: true });
    await expect(coreMasterToggle).toBeChecked();

    // Individual toggles should return to their default values (core features default to false)
    await expect(page.locator('#enable-cognite-timeseries')).not.toBeChecked();
    await expect(page.locator('#enable-flexible-data-modelling')).not.toBeChecked();
  });

  test('Should allow individual feature toggles when master is enabled', async ({
    readProvisionedDataSource,
    gotoDataSourceConfigPage,
    page,
  }) => {
    const datasource = await readProvisionedDataSource({ fileName: 'datasources.yml', uid: '42' });
    const configPage = await gotoDataSourceConfigPage(datasource.uid);

    // Wait for the page to fully load and scroll to feature flags
    await page.waitForLoadState('networkidle');
    const legacyMasterToggle = page.locator('#enable-legacy-data-model-features');
    await legacyMasterToggle.scrollIntoViewIfNeeded();
    
    // Ensure legacy master toggle is enabled
    await legacyMasterToggle.check({ force: true });

    // Test individual legacy feature toggles
    const timeseriesSearchToggle = page.locator('#enable-timeseries-search');
    const eventsToggle = page.locator('#enable-events');

    // Turn off individual features
    await timeseriesSearchToggle.scrollIntoViewIfNeeded();
    await timeseriesSearchToggle.uncheck({ force: true });
    await expect(timeseriesSearchToggle).not.toBeChecked();
    await expect(legacyMasterToggle).toBeChecked(); // Master should remain on

    await eventsToggle.scrollIntoViewIfNeeded();
    await eventsToggle.uncheck({ force: true });
    await expect(eventsToggle).not.toBeChecked();

    // Turn them back on
    await timeseriesSearchToggle.scrollIntoViewIfNeeded();
    await timeseriesSearchToggle.check({ force: true });
    await expect(timeseriesSearchToggle).toBeChecked();

    await eventsToggle.scrollIntoViewIfNeeded();
    await eventsToggle.check({ force: true });
    await expect(eventsToggle).toBeChecked();
  });

  test('Should show deprecated features without master toggle', async ({
    readProvisionedDataSource,
    gotoDataSourceConfigPage,
    page,
  }) => {
    const datasource = await readProvisionedDataSource({ fileName: 'datasources.yml', uid: '42' });
    const configPage = await gotoDataSourceConfigPage(datasource.uid);

    // Wait for the page to fully load and scroll to feature flags
    await page.waitForLoadState('networkidle');
    await page.locator('#enable-relationships').scrollIntoViewIfNeeded();

    // Deprecated features should be visible and toggleable independently
    await expect(page.locator('#enable-relationships')).toBeVisible();
    await expect(page.locator('#enable-templates')).toBeVisible();
    await expect(page.locator('#enable-extraction-pipelines')).toBeVisible();

    // These should not be affected by master toggles
    const relationshipsToggle = page.locator('#enable-relationships');
    const templatesToggle = page.locator('#enable-templates');

    // Toggle deprecated features independently
    await relationshipsToggle.scrollIntoViewIfNeeded();
    await relationshipsToggle.uncheck({ force: true });
    await expect(relationshipsToggle).not.toBeChecked();

    await templatesToggle.scrollIntoViewIfNeeded();
    await templatesToggle.check({ force: true });
    await expect(templatesToggle).toBeChecked();

    // Master toggles should not affect deprecated features
    const legacyMasterToggle = page.locator('#enable-legacy-data-model-features');
    const coreMasterToggle = page.locator('#enable-core-data-model-features');

    await legacyMasterToggle.scrollIntoViewIfNeeded();
    await legacyMasterToggle.uncheck({ force: true });
    await coreMasterToggle.scrollIntoViewIfNeeded();
    await coreMasterToggle.uncheck({ force: true });

    // Deprecated features should maintain their state
    await expect(relationshipsToggle).not.toBeChecked();
    await expect(templatesToggle).toBeChecked();
  });

  test('Should save and persist feature flag changes', async ({
    readProvisionedDataSource,
    gotoDataSourceConfigPage,
    page,
  }) => {
    const datasource = await readProvisionedDataSource({ fileName: 'datasources.yml', uid: '42' });
    const configPage = await gotoDataSourceConfigPage(datasource.uid);

    // Wait for the page to fully load and scroll to feature flags
    await page.waitForLoadState('networkidle');
    const legacyMasterToggle = page.locator('#enable-legacy-data-model-features');
    await legacyMasterToggle.scrollIntoViewIfNeeded();

    // Change some feature flags
    const coreMasterToggle = page.locator('#enable-core-data-model-features');

    await legacyMasterToggle.scrollIntoViewIfNeeded();
    await legacyMasterToggle.uncheck({ force: true });
    await coreMasterToggle.scrollIntoViewIfNeeded();
    await coreMasterToggle.uncheck({ force: true });

    // Save the configuration
    await page.getByTestId('data-testid Data source settings page Save and Test button').click();
    await expect(configPage).toHaveAlert('success');

    // Reload the page to verify persistence
    await page.reload();

    // Feature flags should maintain their disabled state
    await expect(page.locator('#enable-legacy-data-model-features')).not.toBeChecked();
    await expect(page.locator('#enable-core-data-model-features')).not.toBeChecked();

    // Individual features should also be disabled
    await expect(page.locator('#enable-timeseries-search')).not.toBeChecked();
    await expect(page.locator('#enable-cognite-timeseries')).not.toBeChecked();

    // Reset to original state for cleanup
    await legacyMasterToggle.scrollIntoViewIfNeeded();
    await legacyMasterToggle.check({ force: true });
    await coreMasterToggle.scrollIntoViewIfNeeded();
    await coreMasterToggle.check({ force: true });
    await page.getByTestId('data-testid Data source settings page Save and Test button').click();
    await expect(configPage).toHaveAlert('success');
  });
});
