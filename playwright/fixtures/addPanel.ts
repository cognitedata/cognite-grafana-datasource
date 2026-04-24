import semver from 'semver';
import type { Page } from '@playwright/test';
import { DashboardPage, PanelEditPage } from '@grafana/plugin-e2e';

/**
 * Cross-version addPanel helper.
 *
 * Grafana 13 introduced a completely new inline panel editing UI. The old
 * "data-testid Add button" toolbar selector no longer exists. The new flow
 * uses the sidebar panel:
 *
 *   1. Enter edit mode
 *   2. Wait for "Sidebar container" to appear
 *   3. If "sidebar add new panel" button is not visible, click
 *      "Dashboard Sidebar new button" to open the add panel sidebar
 *   4. Click "sidebar add new panel"
 *   5. Click "Configure" button to open the visualization/query editor
 *
 * After step 5, the datasource picker ("data-testid Select a data source")
 * becomes visible and PanelEditPage.datasource.set() works normally.
 *
 * For Grafana < 13 the original addPanel() is used unchanged.
 */
export async function addPanel(
  dashboardPage: DashboardPage,
  page: Page,
  grafanaVersion: string
): Promise<PanelEditPage> {
  if (semver.lt(grafanaVersion, '13.0.0')) {
    // Grafana 10.0.x only: wait for the toolbar to finish its initial layout.
    // On these builds the "Show more items" overflow button briefly appears and
    // detaches before the click can land, causing a race condition.
    // Later versions (10.1+) don't have this issue, and 12.x never reaches
    // networkidle due to background WebSocket/polling activity.
    if (semver.lt(grafanaVersion, '10.1.0')) {
      await page.waitForLoadState('networkidle');
    }
    return dashboardPage.addPanel();
  }

  // Enter edit mode
  await page.getByTestId('data-testid Edit dashboard button').click();

  // Wait for the Grafana 13 sidebar to appear
  await page.waitForSelector('[data-testid="data-testid Sidebar container"]', { timeout: 10000 });

  // If the "new panel" button is not already visible (sidebar may be collapsed),
  // click the "new button" to open the add-panel section of the sidebar
  const newPanelButton = page.getByTestId('data-testid sidebar add new panel');
  if (!await newPanelButton.isVisible()) {
    await page.getByTestId('data-testid Dashboard Sidebar new button').click();
  }

  // Click the "Add new panel" button in the sidebar
  await newPanelButton.click();

  // Grafana 13.0.x uses a generic "Configure" role button; 13.1+ uses a
  // specific testid. We're running 13.0.x so use the role selector.
  const sidebarContainer = page.getByTestId('data-testid Sidebar container');
  await sidebarContainer.getByRole('button', { name: 'Configure' }).click();

  // Read the panel id from the URL if Grafana updated it (scene-based dashboards
  // may not change the URL for new panels; default to '1').
  let panelId = '1';
  try {
    await page.waitForURL(/[?&]editPanel=/, { timeout: 5000 });
    panelId = new URL(page.url()).searchParams.get('editPanel') ?? '1';
  } catch {
    // Inline editing — no URL change is expected in Grafana 13
  }

  // ctx and dashboard are public fields on DashboardPage
  const ctx = (dashboardPage as any).ctx;  // eslint-disable-line @typescript-eslint/no-explicit-any
  const dashboard = (dashboardPage as any).dashboard;  // eslint-disable-line @typescript-eslint/no-explicit-any
  return new PanelEditPage(ctx, { dashboard, id: panelId });
}
