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
    if (semver.gte(grafanaVersion, '11.0.0')) {
        await page.getByTestId('data-testid annotations-test-button').click();
        await expect(annotationEditPage).toHaveAlert('success', { hasText: /[0-9]+ events.*/ });
    } else if (semver.gte(grafanaVersion, '10.0.0')) {
        await page.getByRole('button', { name: 'TEST' }).click();
        await expect(page.locator('.alert-info')).toHaveText(/[0-9]+ events.*/);
    }
  });
