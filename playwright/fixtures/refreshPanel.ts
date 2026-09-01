import semver from 'semver';
import type { Page, Response } from '@playwright/test';
import { PanelEditPage } from '@grafana/plugin-e2e';

type RefreshOptions = {
  waitForResponsePredicateCallback: (response: Response) => boolean | Promise<boolean>;
};

/**
 * Cross-version panel refresh helper.
 *
 * plugin-e2e v3's PanelEditPage.refreshPanel() scopes the run button to the
 * panel editor content and falls back to a "toggle-viz-options" control,
 * neither of which exists on Grafana 10.0.x — so click the run button
 * directly there and delegate to plugin-e2e everywhere else.
 */
export async function refreshPanel(
  panelEditPage: PanelEditPage,
  page: Page,
  grafanaVersion: string,
  options: RefreshOptions
): Promise<Response> {
  if (semver.gte(grafanaVersion, '10.1.0')) {
    return panelEditPage.refreshPanel(options);
  }
  const responsePromise = page.waitForResponse(options.waitForResponsePredicateCallback);
  await page.getByTestId('data-testid RefreshPicker run button').click();
  return responsePromise;
}
