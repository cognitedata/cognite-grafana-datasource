import { expect } from '@grafana/plugin-e2e';
import { Page } from '@playwright/test';
import semver from 'semver';

// Workaround to get a "stable" panel state.
// Some of the queries are cached, so the API call is not made.
// In such cases standard page.waitForResponse does not work.
// We need to wait at least a second to get a new time range that is not cached.
export const waitForQueriesToFinish = async (page: Page, grafanaVersion: string) => {
  if (semver.gte(grafanaVersion, '11.4.0')) {
    const refreshButtonLocator = page.getByTestId('data-testid RefreshPicker run button');
    await expect(refreshButtonLocator).toContainText('Refresh', { timeout: 15000 });
  } else {
    const loadingBarLocator = page.getByLabel('Panel loading bar');
    await expect(loadingBarLocator).toHaveCount(0, { timeout: 15000 });
  }

  await page.waitForTimeout(1000); // otherwise the time range is the same, so the query might be cached
}
