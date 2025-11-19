import { test as base } from '@grafana/plugin-e2e';
import type { Page } from '@playwright/test';

/**
 * Patches the page.goto method to use 'load' instead of 'networkidle' by default.
 * This fixes timeout issues with Grafana 12.2.1's persistent websocket connections.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    // Store the original goto method
    const originalGoto = page.goto.bind(page);
    
    // Override page.goto to change 'networkidle' to 'load'
    page.goto = async (url: string, options?) => {
      const modifiedOptions = { ...options };
      
      // If waitUntil is 'networkidle', change it to 'load'
      if (modifiedOptions.waitUntil === 'networkidle' || !modifiedOptions.waitUntil) {
        modifiedOptions.waitUntil = 'load';
      }
      
      // Increase timeout if not specified
      if (!modifiedOptions.timeout) {
        modifiedOptions.timeout = 60000;
      }
      
      return originalGoto(url, modifiedOptions);
    };
    
    await use(page);
  },
});

