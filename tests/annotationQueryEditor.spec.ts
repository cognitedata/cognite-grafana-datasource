import semver from 'semver';
import { test as base, expect, PluginFixture, PluginOptions } from '@grafana/plugin-e2e';
import { readProvisionedDataSource } from '../playwright/fixtures/readProvisionedDataSource';
const test = base.extend<PluginFixture, PluginOptions>({ readProvisionedDataSource });

test('annotation query in provisioned dashboard should return a 200 response', async ({
    readProvisionedDashboard,
    gotoAnnotationEditPage,
    page,
    grafanaVersion,
  }) => {
    const dashboard = await readProvisionedDashboard({ fileName: 'weather-station.json' });
    const annotationEditPage = await gotoAnnotationEditPage({ dashboard, id: '1' });
    
    // Try modern button first, fallback to legacy button
    try {
        const modernButton = page.getByTestId('data-testid annotations-test-button');
        await modernButton.waitFor({ state: 'visible', timeout: 5000 });
        await modernButton.click();
        await expect(annotationEditPage).toHaveAlert('success', { hasText: /[0-9]+ events.*/ });
    } catch (error) {
        // Fallback to legacy button for older Grafana versions
        const legacyButton = page.getByRole('button', { name: 'TEST' });
        await expect(legacyButton).toBeVisible({ timeout: 10000 });
        await legacyButton.click();
        await expect(page.locator('.alert-info')).toHaveText(/[0-9]+ events.*/, { timeout: 15000 });
    }
  });
