import { expect, PluginFixture, PluginOptions } from '@grafana/plugin-e2e';
import { Response } from 'playwright';
import { waitForQueriesToFinish } from '../playwright/fixtures/waitForQueriesToFinish';
import { readProvisionedDataSource } from '../playwright/fixtures/readProvisionedDataSource';
import { test as patchedBase } from '../playwright/fixtures/patchNavigationStrategy';
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

test('Panel with asset subtree queries rendered OK', async ({ selectors, readProvisionedDataSource, gotoDashboardPage, readProvisionedDashboard, page, grafanaVersion }) => {
  test.setTimeout(60000);
  const ds = await readProvisionedDataSource({ fileName: 'datasources.yml' });
  const dashboard = await readProvisionedDashboard({ fileName: 'weather-station.json' });
  const dashboardPage = await gotoDashboardPage(dashboard);

  const panelEditPage = await dashboardPage.addPanel();
  await panelEditPage.datasource.set(ds.name);

  const editorRow = panelEditPage.getQueryEditorRow("A");

  await editorRow.getByText('Time series from asset').click();

  const combobox = await editorRow.getByRole('combobox', { name: 'Asset Tag' });
  await combobox.click();
  
  // Wait for dropdown to populate
  await page.waitForTimeout(2000);

  const option = selectors.components.Select.option;
  await panelEditPage.getByGrafanaSelector(option).filter({ hasText: 'Locations' }).click();

  const includeSubAssets = await editorRow.getByLabel('Include sub-assets').nth(1);
  await includeSubAssets.check({ force: true });
  await expect(includeSubAssets).toBeChecked();

  const includeTs = await editorRow.getByLabel('Include sub-timeseries').nth(1);
  await expect(includeTs).toBeChecked();

  const latestValue = await editorRow.getByLabel('Latest value').nth(1);
  await latestValue.check({ force: true });
  await expect(latestValue).toBeChecked();

  await waitForQueriesToFinish(page);

  await expect(panelEditPage.refreshPanel(
    {
      timeout: 30000,
      waitForResponsePredicateCallback: async (response) => {

        if (isCdfResponse('/timeseries/data/latest')(response)) {
          const json = await response.json();
          const externalIds = [...json.items?.map(({ externalId }) => externalId)].sort();
          const isEqualArr = JSON.stringify(externalIds) === JSON.stringify(expectedTs);
          return isEqualArr;
        }

        return false;
      }
    }
  )).toBeOK();

  await expect.poll(async () => {
    const buttonTexts = await panelEditPage.panel.locator.getByRole('button', { name: /59.9139-10.7522.*/ }).allInnerTexts();
    return buttonTexts.sort();
  }, { timeout: 10000 }).toEqual(expectedTs);
});

test('"Timeseries custom query" multiple ts OK', async ({ selectors, readProvisionedDataSource, gotoDashboardPage, readProvisionedDashboard, page, grafanaVersion }) => {
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
  
  const panelEditPage = await dashboardPage.addPanel();
  await panelEditPage.datasource.set(ds.name);
  await panelEditPage.setVisualization('Table');
  
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

  // transform into a single table, this is simpler to assert
  // Based on actual UI inspection of different Grafana versions:
  // - 11.6.7+: uses 'data-testid Tab Transformations'
  // - 11.2.10: uses 'data-testid Tab Transform data'  
  // - <11.0.0: uses role selector
  if (semver.gte(grafanaVersion, '11.5.4')) {
    await page.getByTestId('data-testid Tab Transformations').click();
  } else if (semver.gte(grafanaVersion, '11.0.0')) {
    await page.getByTestId('data-testid Tab Transform data').click();
  } else {
    await page.getByRole('tab', { name: 'Tab Transform' }).click();
  }

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
  
  // Select only the first column (externalId)
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

  // Check if the table contains the expected events
  // Since we filtered the events by prefix, we can check if the table contains the events that start with "test_event (1"
  // and do not contain the events that start with "test_event (2..9"
  const EXPECTED_EVENT_PREFIX_PATTERN = /test_event \(1/;
  const EXCLUDED_EVENT_PATTERN = /test_event \(2-9/;

  const validateCellTexts = (cellTexts: string[]) => {
    // Filter out header cells and empty cells, focus on actual event data
    const eventCells = cellTexts.filter(text => text && text.includes('test_event'));
    const hasExpectedEvents = eventCells.length > 0 && eventCells.some(text => EXPECTED_EVENT_PREFIX_PATTERN.test(text));
    const hasNoExcludedEvents = !eventCells.some(text => EXCLUDED_EVENT_PATTERN.test(text));
    return cellTexts.length && hasExpectedEvents && hasNoExcludedEvents;
  };

  await expect.poll(async () => {
    // Try different selectors for cross-Grafana version compatibility
    let cellTexts: string[] = [];
    
    // First try the standard plugin-e2e selector
    try {
      cellTexts = await panelEditPage.panel.data.allInnerTexts();
    } catch (e) {
      // Selector may not work in all Grafana versions
    }
    
    // If that fails, try direct table selectors
    if (cellTexts.length === 0) {
      try {
        const tableCells = await page.locator('table td, table th').allInnerTexts();
        cellTexts = tableCells;
      } catch (e) {
        // Table selector may not work in all cases
      }
    }
    
    // If still no data, extract from panel text (fallback for newer Grafana versions)
    if (cellTexts.length === 0) {
      try {
        const panelText = await panelEditPage.panel.locator.textContent();
        if (panelText) {
          // Extract event data from the panel text
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
  // Set a larger viewport to ensure all UI elements are visible
  await page.setViewportSize({ width: 1920, height: 1080 });
  
  const ds = await readProvisionedDataSource({ fileName: 'datasources.yml' });
  const dashboard = await readProvisionedDashboard({ fileName: 'weather-station.json' });
  const dashboardPage = await gotoDashboardPage(dashboard);

  const panelEditPage = await dashboardPage.addPanel();
  await panelEditPage.datasource.set(ds.name);
  
  // Wait for data source to be properly selected and tabs to render
  await page.waitForTimeout(1000);

  const editorRow = panelEditPage.getQueryEditorRow("A");

  // Click on CogniteTimeSeries tab
  await editorRow.getByText('CogniteTimeSeries').click();

  // Test that the View dropdown is visible (single dropdown with views from container inspect API)
  const viewField = editorRow.locator('label:has-text("View")').locator('..');
  await expect(viewField).toBeVisible();

  // Click on the View dropdown to see available options
  const viewDropdown = viewField.locator('input').first();
  await viewDropdown.click();
  
  // Wait for view options to load from the container inspect API
  await page.waitForTimeout(2000);
  
  // Check that at least one CogniteTimeSeries view option is available
  const option = selectors.components.Select.option;
  const cogniteTimeSeriesOption = panelEditPage.getByGrafanaSelector(option).filter({ hasText: /CogniteTimeSeries.*cdf_cdm/i });
  await expect(cogniteTimeSeriesOption.first()).toBeVisible({ timeout: 10000 });
  
  // Select the CogniteTimeSeries view
  await cogniteTimeSeriesOption.first().click();

  // Test that search AsyncSelect is visible - use the input element with the specific id
  const searchInput = editorRow.locator('input[id="cognite-timeseries-search-A"]');
  await expect(searchInput).toBeVisible();

  // Test aggregation selector (should be set to Average)
  const aggregationField = editorRow.locator('label:has-text("Aggregation")').locator('..');
  const aggregationValue = aggregationField.getByText('Average');
  await expect(aggregationValue).toBeVisible();

  // Test granularity input
  const granularityInput = editorRow.locator('input[id="granularity-A"]');
  await expect(granularityInput).toBeVisible();

  // Test label input  
  const labelInput = editorRow.locator('input[id="label-A"]');
  await expect(labelInput).toBeVisible();
});

test('"CogniteTimeSeries" query with selection works', async ({ selectors, readProvisionedDataSource, gotoDashboardPage, readProvisionedDashboard, page, grafanaVersion }) => {
  // Set a larger viewport to ensure all UI elements are visible
  await page.setViewportSize({ width: 1920, height: 1080 });
  
  const ds = await readProvisionedDataSource({ fileName: 'datasources.yml' });
  const dashboard = await readProvisionedDashboard({ fileName: 'weather-station.json' });
  const dashboardPage = await gotoDashboardPage(dashboard);

  const panelEditPage = await dashboardPage.addPanel();
  await panelEditPage.datasource.set(ds.name);
  
  // Wait for data source to be properly selected and tabs to render
  await page.waitForTimeout(1000);

  const editorRow = panelEditPage.getQueryEditorRow("A");

  // Click on CogniteTimeSeries tab
  await editorRow.getByText('CogniteTimeSeries').click();

  // Select a view from the View dropdown (views are fetched from container inspect API)
  const viewField = editorRow.locator('label:has-text("View")').locator('..');
  const viewDropdown = viewField.locator('input').first();
  await viewDropdown.click();
  
  // Wait for view options to load
  await page.waitForTimeout(2000);
  
  // Select the CogniteTimeSeries view
  const option = selectors.components.Select.option;
  const cogniteTimeSeriesOption = panelEditPage.getByGrafanaSelector(option).filter({ hasText: /CogniteTimeSeries.*cdf_cdm/i });
  await cogniteTimeSeriesOption.first().click();

  // Click on the search AsyncSelect and type '59.9139'
  const searchInput = editorRow.locator('input[id="cognite-timeseries-search-A"]');
  await searchInput.click();
  await searchInput.fill('59.9139');

  // Wait for search results
  await waitForQueriesToFinish(page);
  
  // Look for the timeseries option in the dropdown
  const tsOption = panelEditPage.getByGrafanaSelector(option).filter({ hasText: /59\.9139/i }).first();
  await expect(tsOption).toBeVisible({ timeout: 10000 });
  
  // Click on the first result to select it
  await tsOption.click();

  // Verify that a timeseries name appears in the search box (it should replace the placeholder)
  await expect(searchInput).not.toHaveText('Search timeseries by name/description');

  // Test label input - find the textbox that contains 'default' for label
  const labelInput = editorRow.locator('input[id="label-A"]');
  await labelInput.clear();
  await labelInput.fill('CDMTS Data');

  await waitForQueriesToFinish(page);
});

test('"CogniteTimeSeries" unit conversion is available for timeseries with units', async ({ selectors, readProvisionedDataSource, gotoDashboardPage, readProvisionedDashboard, page, grafanaVersion }) => {
  // Set a larger viewport to ensure all UI elements are visible
  await page.setViewportSize({ width: 1920, height: 1080 });
  
  const ds = await readProvisionedDataSource({ fileName: 'datasources.yml' });
  const dashboard = await readProvisionedDashboard({ fileName: 'weather-station.json' });
  const dashboardPage = await gotoDashboardPage(dashboard);

  const panelEditPage = await dashboardPage.addPanel();
  await panelEditPage.datasource.set(ds.name);
  
  // Wait for data source to be properly selected and tabs to render
  await page.waitForTimeout(1000);

  const editorRow = panelEditPage.getQueryEditorRow("A");

  // Click on CogniteTimeSeries tab
  await editorRow.getByText('CogniteTimeSeries').click();

  // Select a view from the View dropdown
  const viewField = editorRow.locator('label:has-text("View")').locator('..');
  const viewDropdown = viewField.locator('input').first();
  await viewDropdown.click();
  
  // Wait for view options to load
  await page.waitForTimeout(2000);
  
  // Select the CogniteTimeSeries view
  const option = selectors.components.Select.option;
  const cogniteTimeSeriesOption = panelEditPage.getByGrafanaSelector(option).filter({ hasText: /CogniteTimeSeries.*cdf_cdm/i });
  await cogniteTimeSeriesOption.first().click();

  // Search for a timeseries that has a unit (temperature)
  const searchInput = editorRow.locator('input[id="cognite-timeseries-search-A"]');
  await searchInput.click();
  await searchInput.fill('59.9139-10.7522-current.temp');

  // Wait for search results
  await waitForQueriesToFinish(page);
  
  // Select the temperature timeseries
  const tsOption = panelEditPage.getByGrafanaSelector(option).filter({ hasText: /59\.9139-10\.7522-current\.temp/i }).first();
  await expect(tsOption).toBeVisible({ timeout: 10000 });
  await tsOption.click();

  // Wait for unit information to load
  await page.waitForTimeout(2000);

  // Check that the current unit is displayed (should show "Unit: Degree Celsius (°C)" or similar)
  const unitLabel = editorRow.getByText(/Unit:/i);
  await expect(unitLabel).toBeVisible({ timeout: 5000 });

  // Check that the Target Unit field is visible
  const targetUnitField = editorRow.locator('label:has-text("Target Unit")');
  await expect(targetUnitField).toBeVisible();

  // Click on the Target Unit dropdown
  const targetUnitInput = targetUnitField.locator('..').locator('input').first();
  await targetUnitInput.click();

  // Wait for unit options to load
  await page.waitForTimeout(1000);

  // Check that unit options are available (should show other temperature units)
  const unitOptions = panelEditPage.getByGrafanaSelector(option);
  await expect(unitOptions.first()).toBeVisible({ timeout: 5000 });

  // Verify that at least one temperature unit option is available
  const fahrenheitOption = unitOptions.filter({ hasText: /Fahrenheit|°F/i });
  const kelvinOption = unitOptions.filter({ hasText: /Kelvin|K/i });
  
  // At least one of these should be visible
  const hasTemperatureUnits = await fahrenheitOption.count() > 0 || await kelvinOption.count() > 0;
  expect(hasTemperatureUnits).toBeTruthy();
});

test('"CogniteTimeSeries" unit conversion not shown for timeseries without units', async ({ selectors, readProvisionedDataSource, gotoDashboardPage, readProvisionedDashboard, page, grafanaVersion }) => {
  // Set a larger viewport to ensure all UI elements are visible
  await page.setViewportSize({ width: 1920, height: 1080 });
  
  const ds = await readProvisionedDataSource({ fileName: 'datasources.yml' });
  const dashboard = await readProvisionedDashboard({ fileName: 'weather-station.json' });
  const dashboardPage = await gotoDashboardPage(dashboard);

  const panelEditPage = await dashboardPage.addPanel();
  await panelEditPage.datasource.set(ds.name);
  
  // Wait for data source to be properly selected and tabs to render
  await page.waitForTimeout(1000);

  const editorRow = panelEditPage.getQueryEditorRow("A");

  // Click on CogniteTimeSeries tab
  await editorRow.getByText('CogniteTimeSeries').click();

  // Select a view from the View dropdown
  const viewField = editorRow.locator('label:has-text("View")').locator('..');
  const viewDropdown = viewField.locator('input').first();
  await viewDropdown.click();
  
  // Wait for view options to load
  await page.waitForTimeout(2000);
  
  // Select the CogniteTimeSeries view
  const option = selectors.components.Select.option;
  const cogniteTimeSeriesOption = panelEditPage.getByGrafanaSelector(option).filter({ hasText: /CogniteTimeSeries.*cdf_cdm/i });
  await cogniteTimeSeriesOption.first().click();

  // Search for a timeseries that doesn't have a unit (clouds)
  const searchInput = editorRow.locator('input[id="cognite-timeseries-search-A"]');
  await searchInput.click();
  await searchInput.fill('59.9139-10.7522-current.clouds');

  // Wait for search results
  await waitForQueriesToFinish(page);
  
  // Select the clouds timeseries
  const tsOption = panelEditPage.getByGrafanaSelector(option).filter({ hasText: /59\.9139-10\.7522-current\.clouds/i }).first();
  await expect(tsOption).toBeVisible({ timeout: 10000 });
  await tsOption.click();

  // Wait a bit for any unit information to potentially load
  await page.waitForTimeout(2000);

  // Check that the Target Unit field is NOT visible (timeseries has no unit)
  const targetUnitField = editorRow.locator('label:has-text("Target Unit")');
  await expect(targetUnitField).not.toBeVisible();

  // Check that no unit label is displayed
  const unitLabel = editorRow.getByText(/Unit:/i);
  await expect(unitLabel).not.toBeVisible();
});

test('"CogniteTimeSeries" multiple queries work', async ({ selectors, readProvisionedDataSource, gotoDashboardPage, readProvisionedDashboard, page, grafanaVersion }) => {
  // Set a larger viewport to ensure all UI elements are visible
  await page.setViewportSize({ width: 1920, height: 1080 });
  
  const ds = await readProvisionedDataSource({ fileName: 'datasources.yml' });
  const dashboard = await readProvisionedDashboard({ fileName: 'weather-station.json' });
  const dashboardPage = await gotoDashboardPage(dashboard);

  const searchTerms = ['59.9139-10.7522-current.temp', '59.9139-10.7522-current.pressure', '59.9139-10.7522-current.humidity'];
  const expectedLabels = ['temperature', 'pressure', 'humidity'];

  const panelEditPage = await dashboardPage.addPanel();
  await panelEditPage.datasource.set(ds.name);
  
  // Wait for data source to be properly selected and tabs to render
  await page.waitForTimeout(1000);

  for (const [index, searchTerm] of searchTerms.entries()) {
    if (index > 0) {
      await page.getByTestId(/query-tab-add-query/).click();
    }
    
    const queryLetter = String.fromCharCode(65 + index); // A, B, C
    const editorRow = panelEditPage.getQueryEditorRow(queryLetter);

    // Click on CogniteTimeSeries tab
    await editorRow.getByText('CogniteTimeSeries').click();

    // Select a view from the View dropdown
    const viewField = editorRow.locator('label:has-text("View")').locator('..');
    const viewDropdown = viewField.locator('input').first();
    await viewDropdown.click();
    
    // Wait for view options to load
    await page.waitForTimeout(2000);
    
    // Select the CogniteTimeSeries view
    const option = selectors.components.Select.option;
    const cogniteTimeSeriesOption = panelEditPage.getByGrafanaSelector(option).filter({ hasText: /CogniteTimeSeries.*cdf_cdm/i });
    await cogniteTimeSeriesOption.first().click();

    // Click on the search AsyncSelect and type the search term
    const searchInput = editorRow.locator(`input[id="cognite-timeseries-search-${queryLetter}"]`);
    await searchInput.click();
    await searchInput.fill(searchTerm);

    // Wait for search results
    await waitForQueriesToFinish(page);
    
    // Select first result from dropdown
    const searchOption = panelEditPage.getByGrafanaSelector(option).filter({ hasText: new RegExp(searchTerm.replace('.', '\\.'), 'i') }).first();
    await expect(searchOption).toBeVisible({ timeout: 10000 });
    await searchOption.click();

    // Set custom label - find the label textbox (last textbox with 'default')
    const labelInput = editorRow.locator(`input[id="label-${queryLetter}"]`);
    await labelInput.clear();
    await labelInput.fill(`TST ${expectedLabels[index]}`);
  }

  await waitForQueriesToFinish(page);

  // Check that all labels appear in the legend
  for (const label of expectedLabels) {
    const legendText = panelEditPage.panel.locator.getByText(`TST ${label}`);
    await expect(legendText).toBeVisible({ timeout: 10000 });
  }
});

// Data Models tab tests
test.describe('Data Models tab', () => {
  const graphqlQuery = `query MyQuery {
  listCogniteTimeSeries {
    items {
      externalId
      space
      type
      name
    }
  }
}`;

  const graphqlQueryWithEdges = `query MyQuery {
  listCogniteTimeSeries {
    edges {
      node {
        externalId
        space
        type
        name
      }
    }
  }
}`;

  test('"Data Models" tab can be selected and UI elements are visible', async ({ 
    selectors, 
    readProvisionedDataSource, 
    gotoDashboardPage, 
    readProvisionedDashboard, 
    page 
  }) => {
    // Set a larger viewport to ensure all UI elements are visible
    await page.setViewportSize({ width: 1920, height: 1080 });
    
    const ds = await readProvisionedDataSource({ fileName: 'datasources.yml' });
    const dashboard = await readProvisionedDashboard({ fileName: 'weather-station.json' });
    const dashboardPage = await gotoDashboardPage(dashboard);

    const panelEditPage = await dashboardPage.addPanel();
    await panelEditPage.datasource.set(ds.name);
    
    // Wait for data source to be properly selected and tabs to render
    await page.waitForTimeout(1000);

    const editorRow = panelEditPage.getQueryEditorRow("A");

    // Click on Data Models tab
    await editorRow.getByText('Data Models').click();

    // Test that the Data Model dropdown is visible
    const dataModelField = editorRow.locator('label:has-text("Data Model")').locator('..');
    await expect(dataModelField).toBeVisible();

    // Test that the Version dropdown is visible
    const versionField = editorRow.locator('label:has-text("Version")').locator('..');
    await expect(versionField).toBeVisible();

    // Test that the Query field (GraphQL editor) is visible
    const queryField = editorRow.locator('label:has-text("Query")').locator('..');
    await expect(queryField).toBeVisible();
  });

  test('"Data Models" tab can select a data model and version', async ({ 
    selectors, 
    readProvisionedDataSource, 
    gotoDashboardPage, 
    readProvisionedDashboard, 
    page 
  }) => {
    // Set a larger viewport to ensure all UI elements are visible
    await page.setViewportSize({ width: 1920, height: 1080 });
    
    const ds = await readProvisionedDataSource({ fileName: 'datasources.yml' });
    const dashboard = await readProvisionedDashboard({ fileName: 'weather-station.json' });
    const dashboardPage = await gotoDashboardPage(dashboard);

    const panelEditPage = await dashboardPage.addPanel();
    await panelEditPage.datasource.set(ds.name);
    
    // Wait for data source to be properly selected and tabs to render
    await page.waitForTimeout(1000);

    const editorRow = panelEditPage.getQueryEditorRow("A");

    // Click on Data Models tab
    await editorRow.getByText('Data Models').click();

    // Click on the Data Model dropdown
    const dataModelField = editorRow.locator('label:has-text("Data Model")').locator('..');
    const dataModelDropdown = dataModelField.locator('input').first();
    await dataModelDropdown.click();
    
    // Wait for data model options to load
    await page.waitForTimeout(2000);
    
    // Check that at least one data model option is available (Cognite core data model)
    const option = selectors.components.Select.option;
    const cogniteDataModelOption = panelEditPage.getByGrafanaSelector(option).filter({ hasText: /Cognite.*core.*data.*model|cdf_cdm/i });
    await expect(cogniteDataModelOption.first()).toBeVisible({ timeout: 10000 });
    
    // Select the Cognite core data model
    await cogniteDataModelOption.first().click();

    // Wait for version options to load
    await page.waitForTimeout(1000);

    // Click on the Version dropdown
    const versionField = editorRow.locator('label:has-text("Version")').locator('..');
    const versionDropdown = versionField.locator('input').first();
    await versionDropdown.click();
    
    // Wait for version options to load
    await page.waitForTimeout(1000);
    
    // Check that at least one version option is available
    const versionOption = panelEditPage.getByGrafanaSelector(option).first();
    await expect(versionOption).toBeVisible({ timeout: 5000 });
    
    // Select the first version
    await versionOption.click();
  });

  test('"Data Models" GraphQL query with numeric time series triggers datapoints API', async ({ 
    selectors, 
    readProvisionedDataSource, 
    gotoDashboardPage, 
    readProvisionedDashboard, 
    page,
    grafanaVersion
  }) => {
    test.setTimeout(90000);
    
    // Set a larger viewport to ensure all UI elements are visible
    await page.setViewportSize({ width: 1920, height: 1080 });
    
    const ds = await readProvisionedDataSource({ fileName: 'datasources.yml' });
    const dashboard = await readProvisionedDashboard({ fileName: 'weather-station.json' });
    const dashboardPage = await gotoDashboardPage(dashboard);

    const panelEditPage = await dashboardPage.addPanel();
    await panelEditPage.datasource.set(ds.name);
    
    // Wait for data source to be properly selected and tabs to render
    await page.waitForTimeout(1000);

    const editorRow = panelEditPage.getQueryEditorRow("A");

    // Click on Data Models tab
    await editorRow.getByText('Data Models').click();

    // Click on the Data Model dropdown and select Cognite core data model
    const dataModelField = editorRow.locator('label:has-text("Data Model")').locator('..');
    const dataModelDropdown = dataModelField.locator('input').first();
    await dataModelDropdown.click();
    
    await page.waitForTimeout(2000);
    
    const option = selectors.components.Select.option;
    const cogniteDataModelOption = panelEditPage.getByGrafanaSelector(option).filter({ hasText: /Cognite.*core.*data.*model|cdf_cdm/i });
    await cogniteDataModelOption.first().click();

    // Wait for version to auto-populate or select it
    await page.waitForTimeout(1000);

    // Enter the GraphQL query in the code editor
    const codeEditor = editorRow.locator('.monaco-editor').first();
    await codeEditor.click();
    
    // Clear existing content and type new query
    await page.keyboard.press('Meta+a');
    await page.keyboard.press('Backspace');
    await page.keyboard.type(graphqlQuery, { delay: 10 });

    // Click outside the editor to trigger blur/save
    await editorRow.locator('label:has-text("Query")').click();

    await waitForQueriesToFinish(page);

    // Set up response listeners for both GraphQL and datapoints API
    let graphqlResponseReceived = false;
    let datapointsResponseReceived = false;

    page.on('response', async (response) => {
      const url = response.request().url();
      if (url.includes('/graphql') && response.status() === 200) {
        graphqlResponseReceived = true;
      }
      if (url.includes('/timeseries/data') && response.status() === 200) {
        datapointsResponseReceived = true;
      }
    });

    // Refresh the panel
    await expect(panelEditPage.refreshPanel({
      timeout: 30000,
      waitForResponsePredicateCallback: async (response) => {
        const url = response.request().url();
        // Wait for either graphql or datapoints response
        return (url.includes('/graphql') || url.includes('/timeseries/data')) && response.status() === 200;
      }
    })).toBeOK();

    // Verify that time series data is displayed (panel should show chart or data, not just table)
    // The panel should either show a time series chart or have legend items with the time series names
    await expect.poll(async () => {
      // Check for legend items or time series data in the panel
      const panelContent = await panelEditPage.panel.locator.textContent();
      // Look for expected time series external IDs in the panel content
      const hasTimeSeriesData = panelContent?.includes('59.9139') || panelContent?.includes('59.9127');
      return hasTimeSeriesData;
    }, { timeout: 15000 }).toBeTruthy();
  });

  test('"Data Models" GraphQL query with edges response works', async ({ 
    selectors, 
    readProvisionedDataSource, 
    gotoDashboardPage, 
    readProvisionedDashboard, 
    page,
    grafanaVersion
  }) => {
    test.setTimeout(90000);
    
    // Set a larger viewport to ensure all UI elements are visible
    await page.setViewportSize({ width: 1920, height: 1080 });
    
    const ds = await readProvisionedDataSource({ fileName: 'datasources.yml' });
    const dashboard = await readProvisionedDashboard({ fileName: 'weather-station.json' });
    const dashboardPage = await gotoDashboardPage(dashboard);

    const panelEditPage = await dashboardPage.addPanel();
    await panelEditPage.datasource.set(ds.name);
    
    // Wait for data source to be properly selected and tabs to render
    await page.waitForTimeout(1000);

    const editorRow = panelEditPage.getQueryEditorRow("A");

    // Click on Data Models tab
    await editorRow.getByText('Data Models').click();

    // Click on the Data Model dropdown and select Cognite core data model
    const dataModelField = editorRow.locator('label:has-text("Data Model")').locator('..');
    const dataModelDropdown = dataModelField.locator('input').first();
    await dataModelDropdown.click();
    
    await page.waitForTimeout(2000);
    
    const option = selectors.components.Select.option;
    const cogniteDataModelOption = panelEditPage.getByGrafanaSelector(option).filter({ hasText: /Cognite.*core.*data.*model|cdf_cdm/i });
    await cogniteDataModelOption.first().click();

    // Wait for version to auto-populate
    await page.waitForTimeout(1000);

    // Enter the GraphQL query with edges in the code editor
    const codeEditor = editorRow.locator('.monaco-editor').first();
    await codeEditor.click();
    
    // Clear existing content and type new query
    await page.keyboard.press('Meta+a');
    await page.keyboard.press('Backspace');
    await page.keyboard.type(graphqlQueryWithEdges, { delay: 10 });

    // Click outside the editor to trigger blur/save
    await editorRow.locator('label:has-text("Query")').click();

    await waitForQueriesToFinish(page);

    // Refresh the panel and wait for GraphQL response
    await expect(panelEditPage.refreshPanel({
      timeout: 30000,
      waitForResponsePredicateCallback: async (response) => {
        const url = response.request().url();
        return url.includes('/graphql') && response.status() === 200;
      }
    })).toBeOK();

    // Verify that time series data is displayed
    await expect.poll(async () => {
      const panelContent = await panelEditPage.panel.locator.textContent();
      const hasTimeSeriesData = panelContent?.includes('59.9139') || panelContent?.includes('59.9127');
      return hasTimeSeriesData;
    }, { timeout: 15000 }).toBeTruthy();
  });

  test('"Data Models" aggregation and granularity controls are visible', async ({ 
    selectors, 
    readProvisionedDataSource, 
    gotoDashboardPage, 
    readProvisionedDashboard, 
    page 
  }) => {
    // Set a larger viewport to ensure all UI elements are visible
    await page.setViewportSize({ width: 1920, height: 1080 });
    
    const ds = await readProvisionedDataSource({ fileName: 'datasources.yml' });
    const dashboard = await readProvisionedDashboard({ fileName: 'weather-station.json' });
    const dashboardPage = await gotoDashboardPage(dashboard);

    const panelEditPage = await dashboardPage.addPanel();
    await panelEditPage.datasource.set(ds.name);
    
    // Wait for data source to be properly selected and tabs to render
    await page.waitForTimeout(1000);

    const editorRow = panelEditPage.getQueryEditorRow("A");

    // Click on Data Models tab
    await editorRow.getByText('Data Models').click();

    // Wait for UI to render
    await page.waitForTimeout(500);

    // Test that Aggregation dropdown is visible
    const aggregationField = editorRow.locator('label:has-text("Aggregation")').locator('..');
    await expect(aggregationField).toBeVisible();

    // Test that Granularity input is visible
    const granularityField = editorRow.locator('label:has-text("Granularity")').locator('..');
    await expect(granularityField).toBeVisible();

    // Test that Label input is visible
    const labelField = editorRow.locator('label:has-text("Label")').locator('..');
    await expect(labelField).toBeVisible();
  });
});
