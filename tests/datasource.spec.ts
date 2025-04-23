import { test as base, expect, PluginFixture, PluginOptions } from '@grafana/plugin-e2e';
import { readProvisionedDataSource } from '../playwright/fixtures/readProvisionedDataSource';

const test = base.extend<PluginFixture, PluginOptions>({ readProvisionedDataSource });

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
