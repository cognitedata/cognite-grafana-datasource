import { expect } from '@grafana/plugin-e2e';
import { Page } from '@playwright/test';
import semver from 'semver';

// Workaround to get a "stable" panel state.
// Some of the queries are cached, so the API call is not made.
// In such cases standard page.waitForResponse does not work.
// We need to wait at least a second to get a new time range that is not cached.
export const waitForQueriesToFinish = async (page: Page, grafanaVersion: string) => {
  // Try to detect the actual UI elements available instead of relying on version detection
  // which can be unreliable in Docker environments
  
  try {
    // First, try the newer refresh button approach (Grafana 11.4.0+)
    const refreshButtonLocator = page.getByTestId('data-testid RefreshPicker run button');
    
    // Check if the refresh button exists and has text content
    await refreshButtonLocator.waitFor({ state: 'visible', timeout: 2000 });
    const buttonText = await refreshButtonLocator.textContent();
    
    if (buttonText && buttonText.trim()) {
      // Refresh button has text content, wait for it to show "Refresh"
      await expect(refreshButtonLocator).toContainText('Refresh', { timeout: 15000 });
    } else {
      // Refresh button exists but has no text, fall back to loading bar approach
      throw new Error('Refresh button has no text content');
    }
  } catch (error) {
    // Fall back to the older loading bar approach (Grafana < 11.4.0)
    try {
      const loadingBarLocator = page.getByLabel('Panel loading bar');
      await expect(loadingBarLocator).toHaveCount(0, { timeout: 15000 });
    } catch (loadingBarError) {
      // If both approaches fail, try a simple timeout as last resort
      await page.waitForTimeout(2000);
    }
  }

  await page.waitForTimeout(1000); // otherwise the time range is the same, so the query might be cached
}
