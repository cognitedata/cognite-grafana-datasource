import { expect, PluginFixture, PluginOptions } from '@grafana/plugin-e2e';
import { readProvisionedDataSource } from '../playwright/fixtures/readProvisionedDataSource';
import { test as patchedBase } from '../playwright/fixtures/patchNavigationStrategy';

const test = patchedBase.extend<PluginFixture, PluginOptions>({ readProvisionedDataSource });

test.describe('CogniteActivities dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
  });

  test('Asset activities panel renders rows', async ({ gotoDashboardPage, readProvisionedDashboard, page }) => {
    test.setTimeout(60000);
    const dashboard = await readProvisionedDashboard({ fileName: 'weather-station-activities.json' });
    const dashboardPage = await gotoDashboardPage(dashboard);

    await page.waitForSelector('.react-grid-layout', { timeout: 30000 });

    const panel = await dashboardPage.getPanelByTitle('Activities - Asset (Fornebu Weather Station)');

    // Grafana table uses role="cell" divs, not <td>
    await expect.poll(
      async () => {
        const cells = await panel.locator.locator('[role="cell"]').allInnerTexts();
        return cells.some((c) => c.startsWith('weather-activity-'));
      },
      { timeout: 30000 }
    ).toBe(true);

    // Verify expected columns are present in the header
    await expect(panel.locator.locator('[role="columnheader"]').filter({ hasText: 'externalId' })).toBeVisible();
    await expect(panel.locator.locator('[role="columnheader"]').filter({ hasText: 'name' })).toBeVisible();
    await expect(panel.locator.locator('[role="columnheader"]').filter({ hasText: 'asset' })).toBeVisible();
  });

  test('Equipment activities panel renders rows', async ({ gotoDashboardPage, readProvisionedDashboard, page }) => {
    test.setTimeout(60000);
    const dashboard = await readProvisionedDashboard({ fileName: 'weather-station-activities.json' });
    const dashboardPage = await gotoDashboardPage(dashboard);

    await page.waitForSelector('.react-grid-layout', { timeout: 30000 });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));

    const panel = await dashboardPage.getPanelByTitle('Activities - Equipment (Lysaker Visibility Sensor)');

    await expect.poll(
      async () => {
        const cells = await panel.locator.locator('[role="cell"]').allInnerTexts();
        return cells.some((c) => c.startsWith('weather-activity-'));
      },
      { timeout: 30000 }
    ).toBe(true);

    await expect(panel.locator.locator('[role="columnheader"]').filter({ hasText: 'externalId' })).toBeVisible();
    await expect(panel.locator.locator('[role="columnheader"]').filter({ hasText: 'equipment' })).toBeVisible();
  });

  test('TimeSeries activities panel renders rows', async ({ gotoDashboardPage, readProvisionedDashboard, page }) => {
    test.setTimeout(60000);
    const dashboard = await readProvisionedDashboard({ fileName: 'weather-station-activities.json' });
    const dashboardPage = await gotoDashboardPage(dashboard);

    await page.waitForSelector('.react-grid-layout', { timeout: 30000 });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    const panel = await dashboardPage.getPanelByTitle('Activities - TimeSeries (59.9139-10.7522-current.temp)');

    await expect.poll(
      async () => {
        const cells = await panel.locator.locator('[role="cell"]').allInnerTexts();
        return cells.some((c) => c.startsWith('weather-activity-'));
      },
      { timeout: 30000 }
    ).toBe(true);

    await expect(panel.locator.locator('[role="columnheader"]').filter({ hasText: 'externalId' })).toBeVisible();
    await expect(panel.locator.locator('[role="columnheader"]').filter({ hasText: 'timeSeries' })).toBeVisible();
  });
});
