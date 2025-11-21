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
    
    await use(page);
  },
});

