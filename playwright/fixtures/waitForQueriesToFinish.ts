import { expect } from '@grafana/plugin-e2e';

const grafanaVersion = process.env.GRAFANA_VERSION ?? '11.0.0'
const [majorVersion, minorVersion] = grafanaVersion.split('.').map(Number);

// Workaround to get a "stable" panel state
export const waitForQueriesToFinish = async (page) => {
  const isGrafanaGte = (major: number, minor: number) => {
    if (majorVersion > major) {
      return true;
    } else if (majorVersion === major && minorVersion >= minor) {
      return true;
    }
    return false;
  }

  if (isGrafanaGte(11, 4)) {
    const refreshButtonLocator = page.getByTestId('data-testid RefreshPicker run button');
    await expect(refreshButtonLocator).toContainText('Refresh', { timeout: 15000 });
  } else {
    const loadingBarLocator = page.getByLabel('Panel loading bar');
    await expect(loadingBarLocator).toHaveCount(0, { timeout: 15000 });
  }

  await page.waitForTimeout(1000); // otherwise the time range is the same, so the query might be cached
}
