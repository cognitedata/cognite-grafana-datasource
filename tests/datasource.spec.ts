import { expect, PluginFixture, PluginOptions } from '@grafana/plugin-e2e';
import { readProvisionedDataSource } from '../playwright/fixtures/readProvisionedDataSource';
import { test as patchedBase } from '../playwright/fixtures/patchNavigationStrategy';

const test = patchedBase.extend<PluginFixture, PluginOptions>({ readProvisionedDataSource });

test('Panel with multiple time series queries rendered OK', async ({ gotoDashboardPage, readProvisionedDashboard, page }) => {
  const dashboard = await readProvisionedDashboard({ fileName: 'weather-station.json' });
  await gotoDashboardPage(dashboard);

  var expectedTs = [
    '59.9139-10.7522-current.clouds percent',
    '59.9139-10.7522-current.feels_like Kelvin',
    '59.9139-10.7522-current.humidity percent',
    '59.9139-10.7522-current.pressure hPa',
    '59.9139-10.7522-current.temp Kelvin',
    '59.9139-10.7522-current.wind_speed meter / second',
    '59.9139-10.7522-current.uvi W/m2'
  ];

  const buttons = await page.getByRole('button', { name: /59.9139-10.7522.*/ });
  
  for (const expectedTsName of expectedTs) {
    const button = buttons.locator(`text=${expectedTsName}`);
    await expect(button).toBeVisible();
  }
});

test('Panel with multiple CogniteTimeSeries queries rendered OK', async ({ gotoDashboardPage, readProvisionedDashboard, page }) => {
  // Set a larger viewport to ensure all panels are visible
  await page.setViewportSize({ width: 1920, height: 1080 });
  
  const dashboard = await readProvisionedDashboard({ fileName: 'weather-station.json' });
  await gotoDashboardPage(dashboard);

  // Wait for dashboard panels to be ready
  await page.waitForSelector('.react-grid-layout', { timeout: 30000 });
  
  var expectedTs = [
    'CDMTS wind speed',
    'CDMTS feels like',
    'CDMTS humidity',
    'CDMTS pressure',
    'CDMTS temp',
  ];

  // Scroll down to ensure CDMTS panel is visible
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

  const buttons = await page.getByRole('button', { name: /CDMTS.*/ });
  
  for (const expectedTsName of expectedTs) {
    const button = buttons.locator(`text=${expectedTsName}`);
    await expect(button).toBeVisible();
  }
});


test('Panel with Relationships rendered OK', async ({ gotoDashboardPage, readProvisionedDashboard }) => {
  const dashboard = await readProvisionedDashboard({ fileName: 'weather-station.json' });
  const dashboardPage = await gotoDashboardPage(dashboard);

  var expectedElements = [
    '59.9139-10.7522-current.clouds',
    '59.9139-10.7522-current.feels_like',
    '59.9139-10.7522-current.humidity',
    '59.9139-10.7522-current.pressure',
    '59.9139-10.7522-current.temp',
    '59.9139-10.7522-current.wind_speed',
    '59.9139-10.7522-current.uvi',
    'Oslo',
    'Oslo asset',
  ].sort();

  await expect.poll(async () => {
      const panel1 = await dashboardPage.getPanelByTitle('Relationships');
      const nodes = await panel1.locator.getByLabel(/Node/).getByText(/.+/).allInnerTexts();
      return nodes.sort();
    }, { timeout: 10000 }).toEqual(expectedElements);
});

test('Data Modeling panel with GraphQL CogniteTimeSeries rendered OK', async ({ gotoDashboardPage, readProvisionedDashboard, page }) => {
  // Set a larger viewport to ensure all panels are visible
  await page.setViewportSize({ width: 1920, height: 1080 });
  
  // Track datapoints API responses
  const datapointsResponses: any[] = [];
  
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('/timeseries/data/list') && response.status() === 200) {
      try {
        const json = await response.json();
        datapointsResponses.push(json);
      } catch (e) {
        // Ignore JSON parse errors
      }
    }
  });

  const dashboard = await readProvisionedDashboard({ fileName: 'weather-station-core.json' });
  await gotoDashboardPage(dashboard);

  // Wait for dashboard panels to be ready
  await page.waitForSelector('.react-grid-layout', { timeout: 30000 });
  
  // Scroll down to ensure the Data Modeling panel is visible
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  
  // Wait for the panel to load and render data
  // Need time for multiple parallel requests to complete
  await page.waitForTimeout(15000);

  // The Data Modeling panel uses GraphQL to query CogniteTimeSeries
  // and should display time series with names from the response
  // Check that at least some time series legend items are visible
  const legendButtons = page.getByRole('button', { name: /59\.9139-10\.7522.*|59\.9127-10\.7461.*/ });
  
  // Wait for at least one legend item to appear (indicating data was fetched)
  await expect(legendButtons.first()).toBeVisible({ timeout: 30000 });
  
  // Verify we have multiple time series displayed in the legend
  // The GraphQL query returns 16 time series from both locations
  const legendCount = await legendButtons.count();
  expect(legendCount).toBeGreaterThanOrEqual(10);
  
  // Verify that datapoints API was called for multiple time series
  expect(datapointsResponses.length).toBeGreaterThanOrEqual(10);
  
  // Check that at least one response has items with datapoints
  const hasDatapoints = datapointsResponses.some((response) => {
    const items = response?.items || [];
    return items.some((item: any) => {
      const datapoints = item?.datapoints || [];
      return datapoints.length > 0;
    });
  });
  
  expect(hasDatapoints).toBe(true);
});
