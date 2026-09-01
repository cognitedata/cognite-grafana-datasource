import { test as base } from '@grafana/plugin-e2e';

/**
 * Registers a locator handler to auto-dismiss the "What's new in Grafana"
 * modal introduced in Grafana 13, which blocks pointer events until dismissed.
 * plugin-e2e does not handle this dialog itself.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
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
