import semver from 'semver';
import type { Page } from '@playwright/test';
import { DashboardPage, PanelEditPage } from '@grafana/plugin-e2e';

/**
 * Cross-version addPanel helper.
 *
 * @grafana/plugin-e2e v3 handles the Grafana 13 add-panel flows internally
 * (sidebar layout on 13.x, toolbar on 9.5–12.x), so this simply delegates to
 * DashboardPage.addPanel().
 */
export async function addPanel(
  dashboardPage: DashboardPage,
  page: Page,
  grafanaVersion: string
): Promise<PanelEditPage> {
  // Grafana 10.0.x only: wait for the toolbar to finish its initial layout.
  // On these builds the "Show more items" overflow button briefly appears and
  // detaches before the click can land, causing a race condition.
  if (semver.lt(grafanaVersion, '10.1.0')) {
    await page.waitForLoadState('networkidle');
  }
  return dashboardPage.addPanel();
}
