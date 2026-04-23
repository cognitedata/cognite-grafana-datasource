import { expect, PluginFixture, PluginOptions } from '@grafana/plugin-e2e';
import { Page } from '@playwright/test';
import { readProvisionedDataSource } from '../playwright/fixtures/readProvisionedDataSource';
import { test as patchedBase } from '../playwright/fixtures/patchNavigationStrategy';
import { addPanel } from '../playwright/fixtures/addPanel';

const test = patchedBase.extend<PluginFixture, PluginOptions>({ readProvisionedDataSource });

/**
 * Toggles a checkbox to the desired state using dispatchEvent('click').
 * Playwright's native check/uncheck fails with "Element is outside of the
 * viewport" on older Grafana versions even with force:true, because the
 * config editor places feature toggles below the fold.  dispatchEvent
 * bypasses viewport and actionability checks while still throwing if the
 * element does not exist.
 */
const toggleCheckbox = async (page: Page, id: string, shouldBeChecked: boolean) => {
  const checkbox = page.locator(id);
  const isChecked = await checkbox.isChecked();
  if (isChecked !== shouldBeChecked) {
    await checkbox.dispatchEvent('click');
  }
};

test.describe('Feature Flags - Tab Visibility', () => {
  test('Legacy-only dashboard should show only legacy tabs', async ({
    readProvisionedDashboard,
    gotoDashboardPage,
    page,
    grafanaVersion,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: 'weather-station.json' });
    const dashboardPage = await gotoDashboardPage(dashboard);

    const panelEditPage = await addPanel(dashboardPage, page, grafanaVersion);
    await panelEditPage.datasource.set('Cognite Data Fusion - Legacy Only');

    const editorRow = panelEditPage.getQueryEditorRow("A");

    await expect(editorRow.getByText('Time series search')).toBeVisible();
    await expect(editorRow.getByText('Events')).toBeVisible();

    await editorRow.getByText('Time series search').click();
    await expect(editorRow.getByText('Time series search')).toHaveAttribute('aria-selected', 'true');

    await expect(editorRow.getByText('Time Series', { exact: true })).not.toBeVisible();
    await expect(editorRow.getByText('GraphQL', { exact: true })).not.toBeVisible();
  });

  test('Core-only dashboard should show only core data model tabs', async ({
    readProvisionedDashboard,
    gotoDashboardPage,
    page,
    grafanaVersion,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: 'weather-station-core.json' });
    const dashboardPage = await gotoDashboardPage(dashboard);

    const panelEditPage = await addPanel(dashboardPage, page, grafanaVersion);
    await panelEditPage.datasource.set('Cognite Data Fusion - Core Only');

    const editorRow = panelEditPage.getQueryEditorRow("A");

    const cogniteTimeSeriesTab = editorRow.getByText('Time Series', { exact: true });
    await expect(cogniteTimeSeriesTab).toBeVisible();
    await expect(editorRow.getByText('GraphQL', { exact: true })).toBeVisible();

    await cogniteTimeSeriesTab.click();
    await expect(cogniteTimeSeriesTab).toHaveAttribute('aria-selected', 'true');

    await expect(editorRow.getByText('Time series search')).not.toBeVisible();
    await expect(editorRow.getByText('Events')).not.toBeVisible();
    await expect(editorRow.getByText('Relationships')).not.toBeVisible();
  });
});

test.describe('Feature Flags - Config Editor', () => {
  let configPage: any;
  let page: Page;

  test.beforeEach(async ({ readProvisionedDataSource, gotoDataSourceConfigPage, page: p }) => {
    page = p;
    await page.setViewportSize({ width: 1920, height: 1080 });
    const datasource = await readProvisionedDataSource({ fileName: 'datasources.yml', name: 'Cognite Data Fusion - Config Test' });
    configPage = await gotoDataSourceConfigPage(datasource.uid);
    await page.waitForLoadState('load');
    // Feature toggles are in the Features tab of the new tabbed config editor
    await page.getByRole('tab', { name: 'Features' }).click();
  });

  test('Should toggle legacy data model features on/off', async () => {
    const legacyMasterToggle = page.locator('#enable-legacy-data-model-features');

    await expect(legacyMasterToggle).toBeVisible();

    await toggleCheckbox(page, '#enable-legacy-data-model-features', true);
    await expect(legacyMasterToggle).toBeChecked();

    await expect(page.locator('#enable-timeseries-search')).toBeVisible();
    await expect(page.locator('#enable-timeseries-from-asset')).toBeVisible();
    await expect(page.locator('#enable-timeseries-custom-query')).toBeVisible();
    await expect(page.locator('#enable-events')).toBeVisible();

    await toggleCheckbox(page, '#enable-legacy-data-model-features', false);
    await expect(legacyMasterToggle).not.toBeChecked();

    await expect(page.locator('#enable-timeseries-search')).not.toBeChecked();
    await expect(page.locator('#enable-timeseries-from-asset')).not.toBeChecked();
    await expect(page.locator('#enable-timeseries-custom-query')).not.toBeChecked();
    await expect(page.locator('#enable-events')).not.toBeChecked();

    await toggleCheckbox(page, '#enable-legacy-data-model-features', true);
    await expect(legacyMasterToggle).toBeChecked();

    await expect(page.locator('#enable-timeseries-search')).toBeChecked();
    await expect(page.locator('#enable-timeseries-from-asset')).toBeChecked();
    await expect(page.locator('#enable-timeseries-custom-query')).toBeChecked();
    await expect(page.locator('#enable-events')).toBeChecked();
  });

  test('Should toggle core data model features on/off', async () => {
    const coreMasterToggle = page.locator('#enable-core-data-model-features');

    await expect(coreMasterToggle).toBeVisible();

    await toggleCheckbox(page, '#enable-core-data-model-features', true);
    await expect(coreMasterToggle).toBeChecked();

    await expect(page.locator('#enable-cognite-timeseries')).toBeVisible();
    await expect(page.locator('#enable-flexible-data-modelling')).toBeVisible();

    await toggleCheckbox(page, '#enable-core-data-model-features', false);
    await expect(coreMasterToggle).not.toBeChecked();

    await expect(page.locator('#enable-cognite-timeseries')).not.toBeChecked();
    await expect(page.locator('#enable-flexible-data-modelling')).not.toBeChecked();

    await toggleCheckbox(page, '#enable-core-data-model-features', true);
    await expect(coreMasterToggle).toBeChecked();

    await expect(page.locator('#enable-cognite-timeseries')).toBeChecked();
    await expect(page.locator('#enable-flexible-data-modelling')).toBeChecked();
  });

  test('Should allow individual feature toggles when master is enabled', async () => {
    const legacyMasterToggle = page.locator('#enable-legacy-data-model-features');
    await toggleCheckbox(page, '#enable-legacy-data-model-features', true);

    const timeseriesSearchToggle = page.locator('#enable-timeseries-search');
    const eventsToggle = page.locator('#enable-events');

    await toggleCheckbox(page, '#enable-timeseries-search', false);
    await expect(timeseriesSearchToggle).not.toBeChecked();
    await expect(legacyMasterToggle).toBeChecked();

    await toggleCheckbox(page, '#enable-events', false);
    await expect(eventsToggle).not.toBeChecked();

    await toggleCheckbox(page, '#enable-timeseries-search', true);
    await expect(timeseriesSearchToggle).toBeChecked();

    await toggleCheckbox(page, '#enable-events', true);
    await expect(eventsToggle).toBeChecked();
  });

  test('Should show deprecated features without master toggle', async () => {
    await expect(page.locator('#enable-relationships')).toBeVisible();
    await expect(page.locator('#enable-templates')).toBeVisible();
    await expect(page.locator('#enable-extraction-pipelines')).toBeVisible();

    const relationshipsToggle = page.locator('#enable-relationships');
    const templatesToggle = page.locator('#enable-templates');

    await toggleCheckbox(page, '#enable-relationships', false);
    await expect(relationshipsToggle).not.toBeChecked();

    await toggleCheckbox(page, '#enable-templates', true);
    await expect(templatesToggle).toBeChecked();

    await toggleCheckbox(page, '#enable-legacy-data-model-features', false);
    await toggleCheckbox(page, '#enable-core-data-model-features', false);

    await expect(relationshipsToggle).not.toBeChecked();
    await expect(templatesToggle).toBeChecked();
  });

  test('Should save and persist feature flag changes', async () => {
    await toggleCheckbox(page, '#enable-legacy-data-model-features', false);
    await toggleCheckbox(page, '#enable-core-data-model-features', false);

    await page.getByTestId('data-testid Data source settings page Save and Test button').click();
    await expect(configPage).toHaveAlert('success');

    await page.reload();
    await page.waitForLoadState('load');
    // Re-navigate to Features tab after reload
    await page.getByRole('tab', { name: 'Features' }).click();

    await expect(page.locator('#enable-legacy-data-model-features')).not.toBeChecked();
    await expect(page.locator('#enable-core-data-model-features')).not.toBeChecked();

    await expect(page.locator('#enable-timeseries-search')).not.toBeChecked();
    await expect(page.locator('#enable-cognite-timeseries')).not.toBeChecked();

    await toggleCheckbox(page, '#enable-legacy-data-model-features', true);
    await toggleCheckbox(page, '#enable-core-data-model-features', true);
    await page.getByTestId('data-testid Data source settings page Save and Test button').click();
    await expect(configPage).toHaveAlert('success');
  });
});
