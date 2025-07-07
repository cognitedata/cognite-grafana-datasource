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

test('AllAssets variable dropdown contains expected options', async ({ gotoDashboardPage, readProvisionedDashboard, page }) => {
  const dashboard = await readProvisionedDashboard({ fileName: 'weather-station.json' });
  await gotoDashboardPage(dashboard);

  // Expected options in the AllAssets variable dropdown based on the screenshot
  const expectedOptions = ['Oslo', 'Locations'];

  // Wait for the dashboard to load completely
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000); // Extra wait for variables to load

  // Find the AllAssets variable using data-testid (works across Grafana versions)
  const allAssetsContainer = page.locator('[data-testid="data-testid template variable"]')
    .filter({ has: page.locator('label:has-text("AllAssets")') });
  
  await expect(allAssetsContainer).toBeVisible({ timeout: 10000 });

  // Click on the dropdown input to open it
  const dropdownInput = allAssetsContainer.locator('input[role="combobox"]');
  await expect(dropdownInput).toBeVisible({ timeout: 5000 });
  await dropdownInput.click();

  // Wait for dropdown options to appear and verify the expected options
  for (const expectedOption of expectedOptions) {
    // In newer Grafana versions, options appear as menu items
    const optionLocator = page.locator(`[role="option"]:has-text("${expectedOption}"), [data-testid*="option"]:has-text("${expectedOption}")`);
    await expect(optionLocator.first()).toBeVisible({ timeout: 10000 });
  }

  // Close the dropdown by pressing Escape
  await page.keyboard.press('Escape');
});
