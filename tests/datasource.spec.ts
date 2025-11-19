import { test as base, expect, PluginFixture, PluginOptions } from '@grafana/plugin-e2e';
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
    }, { timeout: 1000 }).toEqual(expectedElements);
});
