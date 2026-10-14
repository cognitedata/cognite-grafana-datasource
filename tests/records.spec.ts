/**
 * Records tab against read-only fixtures in grafana-plugin-test.
 *
 * Seeded on 2026-10-14 by scripts/seed-records-fixtures.mjs: 12 records in space
 * grafana-records-fixtures, view GrafanaE2eRecord/v1, on the shared immutable
 * stream powerbi-connector-ci-archive. Do not update or delete these records:
 * immutable records are write-once, and the tests rely on their lastUpdatedTime
 * and occurredAt values all falling on the fixture day.
 *
 * Record i (1-based) occurs at 2026-10-14T(i-1):00Z. Odd records are "north" and
 * even ones "south", and temperature is 9 + i °C, so each site has 6 records and
 * north averages 15 °C, south 16 °C.
 */
import { expect, PanelEditPage, PluginFixture } from '@grafana/plugin-e2e';
import type { Page, Response } from '@playwright/test';
import { test } from '../playwright/fixtures/patchNavigationStrategy';
import { addPanel } from '../playwright/fixtures/addPanel';
import { isCdfResponse } from '../playwright/fixtures/isCdfResponse';

const STREAM = 'powerbi-connector-ci-archive';
const VIEW_OPTION = 'GrafanaE2eRecord (grafana-records-fixtures) v1';
const FIXTURE_DAY_START = Date.parse('2026-10-14T00:00:00Z');
const FIXTURE_DAY_END = Date.parse('2026-10-15T00:00:00Z');
const RECORD_COUNT = 12;

const FILTER_PATH = `/streams/${STREAM}/records/filter`;
const AGGREGATE_PATH = `/streams/${STREAM}/records/aggregate`;

const tableCells = (panel: { locator: ReturnType<Page['locator']> }) =>
  panel.locator.locator('[role="cell"],[role="gridcell"]').allInnerTexts();

/** The first timeHistogramBuckets array anywhere in an aggregate response. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const findTimeBuckets = (node: any): any[] | undefined => {
  if (!node || typeof node !== 'object') {
    return undefined;
  }
  if (Array.isArray(node.timeHistogramBuckets)) {
    return node.timeHistogramBuckets;
  }
  for (const child of Object.values(node)) {
    const found = findTimeBuckets(child);
    if (found) {
      return found;
    }
  }
  return undefined;
};

/**
 * Opens the fixture dashboard (pinned to the fixture day), adds a panel on the
 * main datasource and selects the Records tab and the fixture view. Resolves
 * with the first /records/filter response the view selection triggers.
 */
async function setupRecordsPanel({
  readProvisionedDashboard,
  gotoDashboardPage,
  selectors,
  page,
  grafanaVersion,
}: Pick<PluginFixture, 'readProvisionedDashboard' | 'gotoDashboardPage' | 'selectors' | 'grafanaVersion'> & {
  page: Page;
}) {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const dashboard = await readProvisionedDashboard({ fileName: 'records-e2e.json' });
  const dashboardPage = await gotoDashboardPage(dashboard);

  const panelEditPage = await addPanel(dashboardPage, page, grafanaVersion);
  await panelEditPage.datasource.set('Cognite Data Fusion');

  const editorRow = panelEditPage.getQueryEditorRow('A');
  const recordsTab = editorRow.getByText(/^Records/);
  await expect(recordsTab).toBeVisible();
  await recordsTab.click();
  await expect(recordsTab).toHaveAttribute('aria-selected', 'true');

  const option = selectors.components.Select.option;
  const filterResponse = page.waitForResponse(isCdfResponse(FILTER_PATH));
  await openSelect(editorRow, 'Select a record view');
  await panelEditPage.getByGrafanaSelector(option).filter({ hasText: VIEW_OPTION }).first().click();

  return { panelEditPage, editorRow, option, filterResponse: await filterResponse };
}

/**
 * Opens a Select through its combobox input, found next to the Select's placeholder
 * or current value. Clicking that text instead is intercepted by the value container.
 */
async function openSelect(editorRow: ReturnType<PanelEditPage['getQueryEditorRow']>, shownText: string) {
  await editorRow.getByText(shownText, { exact: true }).locator('xpath=..').getByRole('combobox').click();
}

/**
 * Opens a property Select by its placeholder and clicks the option for `property`.
 * Each option also renders a type badge and the type name, so it is matched on the
 * element holding exactly the property name.
 */
async function pickProperty(
  panelEditPage: PanelEditPage,
  editorRow: ReturnType<PanelEditPage['getQueryEditorRow']>,
  option: string,
  property: string
) {
  await openSelect(editorRow, 'property');
  await panelEditPage
    .getByGrafanaSelector(option)
    .filter({ has: editorRow.page().getByText(property, { exact: true }) })
    .first()
    .click();
}

test.describe('Records dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
  });

  test('list panel renders the fixture records', async ({ gotoDashboardPage, readProvisionedDashboard, page }) => {
    const dashboard = await readProvisionedDashboard({ fileName: 'records-e2e.json' });
    const filterResponse = page.waitForResponse(isCdfResponse(FILTER_PATH));
    const dashboardPage = await gotoDashboardPage(dashboard);

    const json = await (await filterResponse).json();
    expect(json.items).toHaveLength(RECORD_COUNT);

    const panel = await dashboardPage.getPanelByTitle('Records - list');
    // Sorted by occurredAt ascending, so the first record is always rendered.
    await expect.poll(async () => (await tableCells(panel)).includes('e2e-rec-01'), { timeout: 30000 }).toBe(true);
    await expect(panel.locator.locator('[role="columnheader"]').filter({ hasText: 'temperature' })).toBeVisible();
  });

  test('aggregate table groups the records by site', async ({ gotoDashboardPage, readProvisionedDashboard }) => {
    const dashboard = await readProvisionedDashboard({ fileName: 'records-e2e.json' });
    const dashboardPage = await gotoDashboardPage(dashboard);

    const panel = await dashboardPage.getPanelByTitle('Records - by site');
    await expect
      .poll(
        async () => {
          const cells = await tableCells(panel);
          return ['north', 'south', '6', '15', '16'].every((value) => cells.includes(value));
        },
        { timeout: 30000 }
      )
      .toBe(true);
  });

  test('time histogram renders one series per site', async ({ gotoDashboardPage, readProvisionedDashboard }) => {
    const dashboard = await readProvisionedDashboard({ fileName: 'records-e2e.json' });
    const dashboardPage = await gotoDashboardPage(dashboard);

    const panel = await dashboardPage.getPanelByTitle('Records - hourly by site');
    await expect(panel.locator.getByText('north · count')).toBeVisible({ timeout: 30000 });
    await expect(panel.locator.getByText('south · count')).toBeVisible();
  });
});

test.describe('Records query editor', () => {
  test('selecting a view runs a list query on the dashboard range', async ({
    readProvisionedDashboard,
    gotoDashboardPage,
    selectors,
    page,
    grafanaVersion,
  }) => {
    test.setTimeout(60000);
    const { editorRow, filterResponse } = await setupRecordsPanel({
      readProvisionedDashboard,
      gotoDashboardPage,
      selectors,
      page,
      grafanaVersion,
    });

    await expect(editorRow.getByText(new RegExp(`${STREAM} · immutable`))).toBeVisible();
    // Immutable streams always need a lastUpdatedTime window.
    await expect(editorRow.getByText('Dashboard range', { exact: true })).toBeVisible();
    await expect(editorRow.getByText('None', { exact: true })).toHaveCount(0);

    const body = filterResponse.request().postDataJSON();
    expect(body.lastUpdatedTime.gte).toBe(FIXTURE_DAY_START);
    expect(body.lastUpdatedTime.lte).toBeLessThanOrEqual(FIXTURE_DAY_END);
    expect((await filterResponse.json()).items).toHaveLength(RECORD_COUNT);

    await editorRow.getByTestId('records-open-request-preview').click();
    const preview = page.getByTestId('records-request-preview');
    await expect(preview).toContainText(FILTER_PATH);
    // Scoped to the modal and exact: before Grafana 12 the side menu's "Close menu"
    // toggle also matches a page-wide 'Close' and sits under the modal backdrop.
    await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).last().click();
    await expect(preview).toHaveCount(0);
  });

  test('a filter narrows the records', async ({
    readProvisionedDashboard,
    gotoDashboardPage,
    selectors,
    page,
    grafanaVersion,
  }) => {
    test.setTimeout(60000);
    const { panelEditPage, editorRow, option } = await setupRecordsPanel({
      readProvisionedDashboard,
      gotoDashboardPage,
      selectors,
      page,
      grafanaVersion,
    });

    await editorRow.getByTestId('records-add-filter').click();
    await pickProperty(panelEditPage, editorRow, option, 'site');

    const filtered = page.waitForResponse(
      (response: Response) =>
        isCdfResponse(FILTER_PATH)(response) && (response.request().postData() ?? '').includes('"north"')
    );
    await editorRow.getByPlaceholder('value or $variable').fill('north');
    // The value commits on blur.
    await editorRow.getByPlaceholder('value or $variable').press('Tab');

    const response = await filtered;
    expect(JSON.stringify(response.request().postDataJSON().filter)).toContain(
      '{"equals":{"property":["grafana-records-fixtures","GrafanaE2eRecord/v1","site"],"value":"north"}}'
    );
    expect((await response.json()).items).toHaveLength(RECORD_COUNT / 2);
  });

  test('aggregate mode counts records and buckets them in time', async ({
    readProvisionedDashboard,
    gotoDashboardPage,
    selectors,
    page,
    grafanaVersion,
  }) => {
    test.setTimeout(60000);
    const { panelEditPage, editorRow, option } = await setupRecordsPanel({
      readProvisionedDashboard,
      gotoDashboardPage,
      selectors,
      page,
      grafanaVersion,
    });

    const single = page.waitForResponse(isCdfResponse(AGGREGATE_PATH));
    // The radio input sits over its label and intercepts a click on the text.
    await editorRow.getByRole('radio', { name: 'Aggregate' }).check({ force: true });
    expect((await (await single).json()).aggregates.count.count).toBe(RECORD_COUNT);
    await expect(editorRow.getByText('Single row')).toBeVisible();

    // The first bucket added is a time bucket.
    await editorRow.getByTestId('records-add-bucket').click();
    await pickProperty(panelEditPage, editorRow, option, 'occurredAt');

    const histogram = page.waitForResponse(
      (response: Response) =>
        isCdfResponse(AGGREGATE_PATH)(response) && (response.request().postData() ?? '').includes('"1h"')
    );
    await openSelect(editorRow, 'auto');
    await panelEditPage.getByGrafanaSelector(option).filter({ hasText: /^1h$/ }).first().click();

    const buckets = findTimeBuckets(await (await histogram).json());
    expect(buckets).toHaveLength(RECORD_COUNT);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(buckets!.every((bucket: any) => bucket.count === 1)).toBe(true);
    // Exact, so the legacy "Time series …" tabs on this datasource don't match.
    await expect(editorRow.getByText('Time series', { exact: true })).toBeVisible();
  });
});
