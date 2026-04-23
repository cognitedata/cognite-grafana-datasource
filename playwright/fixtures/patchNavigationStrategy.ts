import { test as base } from '@grafana/plugin-e2e';
import type { Page } from '@playwright/test';

const DEFAULT_NAVIGATION_TIMEOUT = 60000;

const isNetworkIdleOrUndefined = (waitUntil: string | undefined): boolean => {
  return waitUntil === 'networkidle' || !waitUntil;
};

const setTimeoutIfNotSpecified = (options: any): void => {
  if (!options.timeout) {
    options.timeout = DEFAULT_NAVIGATION_TIMEOUT;
  }
};

/**
 * Patches the page.goto method to use 'load' instead of 'networkidle' by default.
 * This fixes timeout issues with Grafana 12.2.1's persistent websocket connections.
 *
 * Also registers a locator handler to auto-dismiss the "What's new in Grafana"
 * modal introduced in Grafana 13, which blocks pointer events until dismissed.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    const originalGoto = page.goto.bind(page);

    page.goto = async (url: string, options?) => {
      const modifiedOptions = { ...options };

      if (isNetworkIdleOrUndefined(modifiedOptions.waitUntil)) {
        modifiedOptions.waitUntil = 'load';
      }

      setTimeoutIfNotSpecified(modifiedOptions);

      return originalGoto(url, modifiedOptions);
    };

    // Grafana 13+ shows a "What's new" dialog on first load that blocks all
    // pointer events until dismissed. Register a handler so it is closed
    // automatically whenever it appears during any test action.
    await page.addLocatorHandler(
      page.getByRole('dialog', { name: "What's new in Grafana" }),
      async () => {
        await page.getByRole('dialog', { name: "What's new in Grafana" })
          .getByRole('button', { name: 'Close' })
          .click();
      }
    );

    await use(page);
  },
});

