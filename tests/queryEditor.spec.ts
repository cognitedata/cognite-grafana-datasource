import { expect, PluginFixture, PluginOptions } from '@grafana/plugin-e2e';
import { Page, Response } from 'playwright';
import { waitForQueriesToFinish } from '../playwright/fixtures/waitForQueriesToFinish';
import { readProvisionedDataSource } from '../playwright/fixtures/readProvisionedDataSource';
import { test as patchedBase } from '../playwright/fixtures/patchNavigationStrategy';
import { addPanel as addPanelHelper } from '../playwright/fixtures/addPanel';
import semver from 'semver';

const test = patchedBase.extend<PluginFixture, PluginOptions>({ readProvisionedDataSource });

const expectedTs = [
  '59.9139-10.7522-current.clouds',
  '59.9139-10.7522-current.feels_like',
  '59.9139-10.7522-current.humidity',
  '59.9139-10.7522-current.pressure',
  '59.9139-10.7522-current.temp',
  '59.9139-10.7522-current.wind_speed',
  '59.9139-10.7522-current.visibility',
  '59.9139-10.7522-current.uvi'
].sort();

const isCdfResponse = (path: string) => {
  return (response: Response) => {
    const isTsData = response.request().url().endsWith(path);
    const is200 = response.status() === 200;
    return isTsData && is200;
  }
};

/**
 * Shared setup for CogniteTimeSeries tests: sets viewport, navigates to a new
 * panel, selects the datasource, clicks the CogniteTimeSeries tab, and picks
 * the first CogniteTimeSeries/cdf_cdm view.
 *
 * Returns { panelEditPage, editorRow, option } for further test-specific steps.
 */
async function setupCogniteTimeSeriesPanel({
  readProvisionedDataSource: readDS,
  readProvisionedDashboard: readDash,
  gotoDashboardPage: gotoDash,
  selectors,
  page,
  grafanaVersion,
}: Pick<
  PluginFixture,
  'readProvisionedDataSource' | 'readProvisionedDashboard' | 'gotoDashboardPage' | 'selectors' | 'grafanaVersion'
> & { page: Page }) {
  await page.setViewportSize({ width: 1920, height: 1080 });

  const ds = await readDS({ fileName: 'datasources.yml' });
  const dashboard = await readDash({ fileName: 'weather-station.json' });
  const dashboardPage = await gotoDash(dashboard);

  const panelEditPage = await addPanelHelper(dashboardPage, page, grafanaVersion);
  await panelEditPage.datasource.set(ds.name);

  const editorRow = panelEditPage.getQueryEditorRow("A");

  // Wait for CogniteTimeSeries tab to appear after datasource selection
  await expect(editorRow.getByText('CogniteTimeSeries')).toBeVisible();
  await editorRow.getByText('CogniteTimeSeries').click();

  const viewField = editorRow.locator('label:has-text("View")').locator('..');
  const viewDropdown = viewField.locator('input').first();
  await viewDropdown.click();

  const option = selectors.components.Select.option;
  const cogniteTimeSeriesOption = panelEditPage
    .getByGrafanaSelector(option)
    .filter({ hasText: /CogniteTimeSeries.*cdf_cdm/i });

  // Wait for the view options to load from the container inspect API
  await expect(cogniteTimeSeriesOption.first()).toBeVisible({ timeout: 10000 });
  await cogniteTimeSeriesOption.first().click();

  return { panelEditPage, editorRow, option, dashboardPage };
}

/**
 * Searches for and selects a timeseries by external ID in the CogniteTimeSeries
 * search dropdown. Waits for the search result to appear before clicking.
 */
async function searchAndSelectTimeSeries(
  page: Page,
  editorRow: ReturnType<Awaited<ReturnType<typeof setupCogniteTimeSeriesPanel>>['panelEditPage']['getQueryEditorRow']>,
  panelEditPage: Awaited<ReturnType<typeof setupCogniteTimeSeriesPanel>>['panelEditPage'],
  option: string,
  searchTerm: string,
  queryLetter = 'A',
) {
  const searchInput = editorRow.locator(`input[id="cognite-timeseries-search-${queryLetter}"]`);
  await searchInput.click();
  await searchInput.fill(searchTerm);

  await waitForQueriesToFinish(page);

  const escaped = searchTerm.replace(/\./g, '\\.');
  const tsOption = panelEditPage
    .getByGrafanaSelector(option)
    .filter({ hasText: new RegExp(escaped, 'i') })
    .first();
  await expect(tsOption).toBeVisible({ timeout: 10000 });
  await tsOption.click();
}

test('Panel with asset subtree queries rendered OK', async ({ selectors, readProvisionedDataSource, gotoDashboardPage, readProvisionedDashboard, page, grafanaVersion }) => {
  test.setTimeout(60000);
  const ds = await readProvisionedDataSource({ fileName: 'datasources.yml' });
  const dashboard = await readProvisionedDashboard({ fileName: 'weather-station.json' });
  const dashboardPage = await gotoDashboardPage(dashboard);

  const panelEditPage = await addPanelHelper(dashboardPage, page, grafanaVersion);
  await panelEditPage.datasource.set(ds.name);

  const editorRow = panelEditPage.getQueryEditorRow("A");

  await editorRow.getByText('Time series from asset').click();

  // Collect all /timeseries/data/latest responses via page.on so we never miss one
  // regardless of timing. waitForResponse with a fixed timeout can be missed if the
  // response fires while the test is blocked on a UI interaction or waitForQueriesToFinish.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const latestResponses: any[] = [];
  page.on('response', (response) => {
    if (isCdfResponse('/timeseries/data/latest')(response)) {
      latestResponses.push(response);
    }
  });

  const combobox = editorRow.getByRole('combobox', { name: 'Asset Tag' });
  const option = selectors.components.Select.option;

  // In Grafana 13's scene-based inline editor, the combobox can be reset by a concurrent
  // async re-render after the selection is made. Retry until the value actually sticks.
  // We detect success by checking the combobox's parent container for the selected text.
  for (let attempt = 0; attempt < 3; attempt++) {
    await combobox.click();
    await expect(panelEditPage.getByGrafanaSelector(option).first()).toBeVisible({ timeout: 10000 });
    await panelEditPage.getByGrafanaSelector(option).filter({ hasText: 'Locations' }).first().click();
    // Wait for the dropdown to dismiss
    await expect(panelEditPage.getByGrafanaSelector(option)).toHaveCount(0, { timeout: 5000 });
    // Verify the selected value is actually shown in the combobox container
    const selected = await combobox.locator('..').filter({ hasText: 'Locations' }).isVisible().catch(() => false);
    if (selected) break;
  }

  const includeSubAssets = editorRow.getByLabel('Include sub-assets').nth(1);
  await includeSubAssets.check({ force: true });
  await expect(includeSubAssets).toBeChecked();

  const includeTs = editorRow.getByLabel('Include sub-timeseries').nth(1);
  await expect(includeTs).toBeChecked();

  const latestValue = editorRow.getByLabel('Latest value').nth(1);
  await latestValue.check({ force: true });
  await expect(latestValue).toBeChecked();

  // Grafana 13 scene-based dashboards process query-option changes asynchronously.
  // The deferred query (data/latest) reliably fires within ~2 seconds of the last
  // state change, but only if the browser gets idle time to process its microtask
  // queue. waitForQueriesToFinish's repeated DOM-polling can starve that execution.
  // Pause here first so the response is captured before we start any other checks.
  await page.waitForTimeout(2500);

  await waitForQueriesToFinish(page);

  // Verify that /timeseries/data/latest was actually called with the expected series
  expect(latestResponses.length).toBeGreaterThan(0);
  const lastResponse = latestResponses[latestResponses.length - 1];
  expect(lastResponse.ok()).toBe(true);
  const json = await lastResponse.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const externalIds = [...(json.items ?? []).map(({ externalId }: any) => externalId)].sort();
  expect(externalIds).toEqual(expectedTs);

  await expect.poll(async () => {
    const panelContent = panelEditPage.panel.locator;
    // Time series visualization (Grafana < 13): series appear as clickable legend buttons
    const buttons = await panelContent.getByRole('button', { name: /59\.9139-10\.7522/ }).allInnerTexts();
    if (buttons.length > 0) return buttons.sort();
    // Grafana 13 inline editor may use a Stat visualization: series appear as plain text
    const textElems = await panelContent.getByText(/59\.9139-10\.7522/).allInnerTexts();
    return [...new Set(textElems.filter(t => /59\.9139-10\.7522/.test(t)).map(t => t.trim()))].sort();
  }, { timeout: 10000 }).toEqual(expectedTs);
});

test('"Timeseries custom query" multiple ts OK', async ({ selectors, readProvisionedDataSource, gotoDashboardPage, readProvisionedDashboard, page, grafanaVersion }) => {
  test.setTimeout(90_000);
  const ds = await readProvisionedDataSource({ fileName: 'datasources.yml' });
  const dashboard = await readProvisionedDashboard({ fileName: 'weather-station.json' });
  const dashboardPage = await gotoDashboardPage(dashboard);

  const tsExternalIds = [
    '59.9139-10.7522-current.humidity',
    '59.9139-10.7522-current.pressure',
    '59.9139-10.7522-current.temp',
  ].sort();

  const panels = ['A', 'B', 'C'];
  const units = ['percent', 'hPa', 'Kelvin'];

  const panelEditPage = await addPanelHelper(dashboardPage, page, grafanaVersion);
  await panelEditPage.datasource.set(ds.name);

  // Select Table visualization (cross-version compatible).
  // Grafana 13 inline editor shows a viz picker with "Suggestions" and "All visualizations" tabs.
  // Older Grafana (9.5 – 12.x) uses a toggle-viz-picker button to open the picker.
  const tableViz = page.locator('[aria-label="Plugin visualization item Table"]')
    .or(page.getByTestId('data-testid Plugin visualization item Table'));
  if (!(await tableViz.isVisible())) {
    // Grafana 13: viz picker is open with a "All visualizations" tab
    const allVizTab = page.getByRole('tab', { name: 'All visualizations' });
    if (await allVizTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await allVizTab.click();
    } else {
      // Older Grafana: open picker via toggle button
      await page.getByTestId('data-testid toggle-viz-picker').click();
    }
  }
  await tableViz.click();

  for (const [index, tsExternalId] of tsExternalIds.entries()) {
    await page.getByTestId(/query-tab-add-query/).click();
    const editorRow = panelEditPage.getQueryEditorRow(panels[index]);

    await editorRow.getByText('Time series custom query').click();

    await editorRow.getByRole('textbox', { name: 'Query' }).fill(`ts{externalId="${tsExternalId}"}`);

    await editorRow.getByRole('combobox', { name: 'Aggregation' }).click();
    const option = selectors.components.Select.option;

    await panelEditPage.getByGrafanaSelector(option).filter({ hasText: 'Interpolation' }).first().click();

    await editorRow.getByRole('textbox', { name: 'Label' }).fill(`{{externalId}}-{{unit}}`);
    await editorRow.getByRole('textbox', { name: 'Granularity' }).fill(`1d`);
  }

  await waitForQueriesToFinish(page);
  await expect(panelEditPage.refreshPanel({ waitForResponsePredicateCallback: isCdfResponse('/timeseries/synthetic/query') })).toBeOK();

  // Grafana renamed this tab across versions; use a resilient role-based selector
  await page.getByRole('tab', { name: /Transform/ }).click();

  if (semver.gte(grafanaVersion, '10.2.0')) {
    await page.getByTestId('data-testid add transformation button').click();
  }

  await page.getByRole('button', { name: 'Join by field' }).click();

  const tsWithUnits = tsExternalIds.map((ts, i) => `${ts}-${units[i]}`);
  await expect(panelEditPage.panel.fieldNames).toContainText(tsWithUnits);
});


test('"Event query" as table is OK', async ({ page, gotoDashboardPage, readProvisionedDashboard, grafanaVersion }) => {
  const dashboard = await readProvisionedDashboard({ fileName: 'weather-station.json' });
  const dashboardPage = await gotoDashboardPage(dashboard);
  const EVENTS_QUERY_PANEL_ID = '3';
  const panelEditPage = await dashboardPage.gotoPanelEditPage(EVENTS_QUERY_PANEL_ID)

  await expect(panelEditPage.panel.fieldNames).toContainText(["externalId", "description", "startTime", "endTime"]);

  const deleteColumnButtonPattern = /event-remove-col-/;
  while (await page.getByTestId(deleteColumnButtonPattern).count() !== 1) {
    await page.getByTestId(deleteColumnButtonPattern).last().click();
  }

  const query = `
    {
      "prefix": {
          "property": ["externalId"],
          "value": "test_event (1"
      }
    }`;

  if (semver.gte(grafanaVersion, '10.2.0')) {
    await page.getByTestId(/Code editor container/).getByRole("textbox").first().fill(query);
  } else {
    await page.getByLabel(/Code editor container/).getByRole("textbox").first().fill(query);
  }

  await waitForQueriesToFinish(page);
  await expect(panelEditPage.refreshPanel({ waitForResponsePredicateCallback: isCdfResponse('/events/list') })).toBeOK();


  await expect(panelEditPage.panel.fieldNames).toHaveText("externalId");
  await expect(panelEditPage.panel.fieldNames).not.toContainText(["description", "startTime", "endTime"]);

  const EXPECTED_EVENT_PREFIX_PATTERN = /test_event \(1/;
  const EXCLUDED_EVENT_PATTERN = /test_event \(2-9/;

  const validateCellTexts = (cellTexts: string[]) => {
    const eventCells = cellTexts.filter(text => text && text.includes('test_event'));
    const hasExpectedEvents = eventCells.length > 0 && eventCells.some(text => EXPECTED_EVENT_PREFIX_PATTERN.test(text));
    const hasNoExcludedEvents = !eventCells.some(text => EXCLUDED_EVENT_PATTERN.test(text));
    return cellTexts.length && hasExpectedEvents && hasNoExcludedEvents;
  };

  await expect.poll(async () => {
    let cellTexts: string[] = [];

    try {
      cellTexts = await panelEditPage.panel.data.allInnerTexts();
    } catch (e) {
      // Selector may not work in all Grafana versions
    }

    if (cellTexts.length === 0) {
      try {
        const tableCells = await page.locator('table td, table th').allInnerTexts();
        cellTexts = tableCells;
      } catch (e) {
        // Table selector may not work in all cases
      }
    }

    if (cellTexts.length === 0) {
      try {
        const panelText = await panelEditPage.panel.locator.textContent();
        if (panelText) {
          cellTexts = panelText.split(/(?=test_event)/).filter(text => text.includes('test_event'));
        }
      } catch (e) {
        // Final fallback failed
      }
    }

    return validateCellTexts(cellTexts);
  }, { timeout: 10000 }).toBeTruthy();
});

test('"Event query" can open Help panel', async ({ page, gotoDashboardPage, readProvisionedDashboard }) => {
  const dashboard = await readProvisionedDashboard({ fileName: 'weather-station.json' });
  const dashboardPage = await gotoDashboardPage(dashboard);
  const EVENTS_QUERY_PANEL_ID = '3';

  await dashboardPage.gotoPanelEditPage(EVENTS_QUERY_PANEL_ID)

  await page.getByTestId(/event-query-help/).click();

  await expect(dashboardPage).toHaveAlert('info', { hasText: 'Event query syntax help' });
});

test('"CogniteTimeSeries" tab can be selected and search works', async ({ selectors, readProvisionedDataSource, gotoDashboardPage, readProvisionedDashboard, page, grafanaVersion }) => {
  const { panelEditPage, editorRow } = await setupCogniteTimeSeriesPanel({
    readProvisionedDataSource,
    readProvisionedDashboard,
    gotoDashboardPage,
    selectors,
    page,
    grafanaVersion,
  });

  const viewField = editorRow.locator('label:has-text("View")').locator('..');
  await expect(viewField).toBeVisible();

  const searchInput = editorRow.locator('input[id="cognite-timeseries-search-A"]');
  await expect(searchInput).toBeVisible();

  const aggregationField = editorRow.locator('label:has-text("Aggregation")').locator('..');
  const aggregationValue = aggregationField.getByText('Average');
  await expect(aggregationValue).toBeVisible();

  const granularityInput = editorRow.locator('input[id="granularity-A"]');
  await expect(granularityInput).toBeVisible();

  const labelInput = editorRow.locator('input[id="label-A"]');
  await expect(labelInput).toBeVisible();
});

test('"CogniteTimeSeries" query with selection works', async ({ selectors, readProvisionedDataSource, gotoDashboardPage, readProvisionedDashboard, page, grafanaVersion }) => {
  const { panelEditPage, editorRow, option } = await setupCogniteTimeSeriesPanel({
    readProvisionedDataSource,
    readProvisionedDashboard,
    gotoDashboardPage,
    selectors,
    page,
    grafanaVersion,
  });

  await searchAndSelectTimeSeries(page, editorRow, panelEditPage, option, '59.9139');

  const searchInput = editorRow.locator('input[id="cognite-timeseries-search-A"]');
  await expect(searchInput).not.toHaveText('Search timeseries by name/description');

  const labelInput = editorRow.locator('input[id="label-A"]');
  await labelInput.clear();
  await labelInput.fill('CDMTS Data');

  await waitForQueriesToFinish(page);
});

test('"CogniteTimeSeries" unit conversion is available for timeseries with units', async ({ selectors, readProvisionedDataSource, gotoDashboardPage, readProvisionedDashboard, page, grafanaVersion }) => {
  const { panelEditPage, editorRow, option } = await setupCogniteTimeSeriesPanel({
    readProvisionedDataSource,
    readProvisionedDashboard,
    gotoDashboardPage,
    selectors,
    page,
    grafanaVersion,
  });

  await searchAndSelectTimeSeries(page, editorRow, panelEditPage, option, '59.9139-10.7522-current.temp');

  // Wait for unit label to appear after timeseries selection
  const unitLabel = editorRow.getByText(/Unit:/i);
  await expect(unitLabel).toBeVisible({ timeout: 10000 });

  const targetUnitField = editorRow.locator('label:has-text("Target Unit")');
  await expect(targetUnitField).toBeVisible();

  const targetUnitInput = targetUnitField.locator('..').locator('input').first();
  await targetUnitInput.click();

  const unitOptions = panelEditPage.getByGrafanaSelector(option);
  await expect(unitOptions.first()).toBeVisible({ timeout: 5000 });

  const fahrenheitOption = unitOptions.filter({ hasText: /Fahrenheit|°F/i });
  const kelvinOption = unitOptions.filter({ hasText: /Kelvin|K/i });

  const hasTemperatureUnits = await fahrenheitOption.count() > 0 || await kelvinOption.count() > 0;
  expect(hasTemperatureUnits).toBeTruthy();
});

test('"CogniteTimeSeries" unit conversion not shown for timeseries without units', async ({ selectors, readProvisionedDataSource, gotoDashboardPage, readProvisionedDashboard, page, grafanaVersion }) => {
  const { panelEditPage, editorRow, option } = await setupCogniteTimeSeriesPanel({
    readProvisionedDataSource,
    readProvisionedDashboard,
    gotoDashboardPage,
    selectors,
    page,
    grafanaVersion,
  });

  await searchAndSelectTimeSeries(page, editorRow, panelEditPage, option, '59.9139-10.7522-current.clouds');

  // Wait for the search dropdown to close, confirming the selection was processed
  const dropdownOption = panelEditPage
    .getByGrafanaSelector(option)
    .filter({ hasText: /59\.9139-10\.7522-current\.clouds/i })
    .first();
  await expect(dropdownOption).not.toBeVisible();

  // Target Unit and Unit label should NOT appear for timeseries without units
  const targetUnitField = editorRow.locator('label:has-text("Target Unit")');
  await expect(targetUnitField).not.toBeVisible();

  const unitLabel = editorRow.getByText(/Unit:/i);
  await expect(unitLabel).not.toBeVisible();
});

test('"CogniteTimeSeries" multiple queries work', async ({ selectors, readProvisionedDataSource, gotoDashboardPage, readProvisionedDashboard, page, grafanaVersion }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });

  const ds = await readProvisionedDataSource({ fileName: 'datasources.yml' });
  const dashboard = await readProvisionedDashboard({ fileName: 'weather-station.json' });
  const dashboardPage = await gotoDashboardPage(dashboard);

  const searchTerms = ['59.9139-10.7522-current.temp', '59.9139-10.7522-current.pressure', '59.9139-10.7522-current.humidity'];
  const expectedLabels = ['temperature', 'pressure', 'humidity'];

  const panelEditPage = await addPanelHelper(dashboardPage, page, grafanaVersion);
  await panelEditPage.datasource.set(ds.name);

  for (const [index, searchTerm] of searchTerms.entries()) {
    if (index > 0) {
      await page.getByTestId(/query-tab-add-query/).click();
    }

    const queryLetter = String.fromCharCode(65 + index);
    const editorRow = panelEditPage.getQueryEditorRow(queryLetter);

    // Wait for CogniteTimeSeries tab and click it
    await expect(editorRow.getByText('CogniteTimeSeries')).toBeVisible();
    await editorRow.getByText('CogniteTimeSeries').click();

    const viewField = editorRow.locator('label:has-text("View")').locator('..');
    const viewDropdown = viewField.locator('input').first();
    await viewDropdown.click();

    const option = selectors.components.Select.option;
    const cogniteTimeSeriesOption = panelEditPage.getByGrafanaSelector(option).filter({ hasText: /CogniteTimeSeries.*cdf_cdm/i });
    await expect(cogniteTimeSeriesOption.first()).toBeVisible({ timeout: 10000 });
    await cogniteTimeSeriesOption.first().click();

    await searchAndSelectTimeSeries(page, editorRow, panelEditPage, option, searchTerm, queryLetter);

    const labelInput = editorRow.locator(`input[id="label-${queryLetter}"]`);
    await labelInput.clear();
    await labelInput.fill(`TST ${expectedLabels[index]}`);
  }

  await waitForQueriesToFinish(page);

  for (const label of expectedLabels) {
    const legendText = panelEditPage.panel.locator.getByText(`TST ${label}`);
    await expect(legendText).toBeVisible({ timeout: 10000 });
  }
});

test('"CogniteTimeSeries with Activities" panel loads with annotations', async ({ readProvisionedDataSource, gotoDashboardPage, readProvisionedDashboard, page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });

  const ds = await readProvisionedDataSource({ fileName: 'datasources.yml' });
  const dashboard = await readProvisionedDashboard({ fileName: 'weather-station-core.json' });
  const dashboardPage = await gotoDashboardPage(dashboard);

  const ACTIVITIES_PANEL_ID = '6';
  const panelEditPage = await dashboardPage.gotoPanelEditPage(ACTIVITIES_PANEL_ID);

  await expect(page.getByText('CogniteTimeSeries with Activities - Core Data Model')).toBeVisible();

  await waitForQueriesToFinish(page);

  await expect(panelEditPage.panel.locator).toBeVisible();
});

test('"CogniteTimeSeries" activities toggle appears when timeseries selected', async ({ selectors, readProvisionedDataSource, gotoDashboardPage, readProvisionedDashboard, page, grafanaVersion }) => {
  const { panelEditPage, editorRow, option } = await setupCogniteTimeSeriesPanel({
    readProvisionedDataSource,
    readProvisionedDashboard,
    gotoDashboardPage,
    selectors,
    page,
    grafanaVersion,
  });

  // Activities toggle should NOT be visible yet (no timeseries selected)
  const activitiesToggleBefore = editorRow.getByLabel('Activities').nth(1);
  await expect(activitiesToggleBefore).not.toBeVisible();

  await searchAndSelectTimeSeries(page, editorRow, panelEditPage, option, '59.9139-10.7522-current.temp');

  // Now the Activities toggle should appear
  const activitiesToggleAfter = editorRow.getByLabel('Activities').nth(1);
  await expect(activitiesToggleAfter).toBeVisible({ timeout: 5000 });
});

test('"CogniteTimeSeries" enabling activities shows configuration options', async ({ selectors, readProvisionedDataSource, gotoDashboardPage, readProvisionedDashboard, page, grafanaVersion }) => {
  const { panelEditPage, editorRow, option } = await setupCogniteTimeSeriesPanel({
    readProvisionedDataSource,
    readProvisionedDashboard,
    gotoDashboardPage,
    selectors,
    page,
    grafanaVersion,
  });

  await searchAndSelectTimeSeries(page, editorRow, panelEditPage, option, '59.9139-10.7522-current.temp');

  const activitiesToggle = editorRow.getByLabel('Activities').nth(1);
  await expect(activitiesToggle).toBeVisible({ timeout: 5000 });
  await activitiesToggle.check({ force: true });
  await expect(activitiesToggle).toBeChecked();

  // Wait for activity configuration UI to render
  const activityViewLabel = editorRow.getByText('View').nth(1);
  await expect(activityViewLabel).toBeVisible({ timeout: 5000 });

  const scheduledToggle = editorRow.getByLabel('Scheduled').nth(1);
  await expect(scheduledToggle).toBeVisible();
});

test('"CogniteTimeSeries" can select activity view', async ({ selectors, readProvisionedDataSource, gotoDashboardPage, readProvisionedDashboard, page, grafanaVersion }) => {
  const { panelEditPage, editorRow, option } = await setupCogniteTimeSeriesPanel({
    readProvisionedDataSource,
    readProvisionedDashboard,
    gotoDashboardPage,
    selectors,
    page,
    grafanaVersion,
  });

  await searchAndSelectTimeSeries(page, editorRow, panelEditPage, option, '59.9139-10.7522-current.temp');

  const activitiesToggle = editorRow.getByLabel('Activities').nth(1);
  await expect(activitiesToggle).toBeVisible({ timeout: 5000 });
  await activitiesToggle.check({ force: true });

  // Wait for the second View field (activity view) to appear
  const activityViewFields = editorRow.locator('label:has-text("View")');
  await expect(activityViewFields.nth(1)).toBeVisible({ timeout: 5000 });

  const activityViewCount = await activityViewFields.count();
  expect(activityViewCount).toBeGreaterThanOrEqual(2);

  const activityViewInput = activityViewFields.nth(1).locator('..').locator('input').first();
  await activityViewInput.click();

  const activityViewOption = panelEditPage.getByGrafanaSelector(option).filter({ hasText: /CogniteActivity.*cdf_cdm/i });
  await expect(activityViewOption.first()).toBeVisible({ timeout: 10000 });

  await activityViewOption.first().click();

  await expect(activityViewOption.first()).not.toBeVisible();
});

test('"CogniteTimeSeries" scheduled time toggle works', async ({ selectors, readProvisionedDataSource, gotoDashboardPage, readProvisionedDashboard, page, grafanaVersion }) => {
  const { panelEditPage, editorRow, option } = await setupCogniteTimeSeriesPanel({
    readProvisionedDataSource,
    readProvisionedDashboard,
    gotoDashboardPage,
    selectors,
    page,
    grafanaVersion,
  });

  await searchAndSelectTimeSeries(page, editorRow, panelEditPage, option, '59.9139-10.7522-current.temp');

  const activitiesToggle = editorRow.getByLabel('Activities').nth(1);
  await expect(activitiesToggle).toBeVisible({ timeout: 5000 });
  await activitiesToggle.check({ force: true });

  const scheduledToggle = editorRow.getByLabel('Scheduled').nth(1);
  await expect(scheduledToggle).toBeVisible({ timeout: 5000 });

  await expect(scheduledToggle).not.toBeChecked();

  await scheduledToggle.check({ force: true });
  await expect(scheduledToggle).toBeChecked();

  await scheduledToggle.uncheck({ force: true });
  await expect(scheduledToggle).not.toBeChecked();
});
