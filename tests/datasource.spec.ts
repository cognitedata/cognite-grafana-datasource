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
  await page.waitForTimeout(2000); // Extra wait for variables to load

  // Find and click the AllAssets variable input to open the dropdown
  const allAssetsInput = page.locator('#var-AllAssets');
  await expect(allAssetsInput).toBeVisible({ timeout: 10000 });
  await allAssetsInput.click();

  // Wait for the dropdown options to appear
  const optionsContainer = page.locator('#options-AllAssets');
  await expect(optionsContainer).toBeVisible({ timeout: 5000 });

  // Check for expected options using the exact data-testid structure
  for (const expectedOption of expectedOptions) {
    const optionButton = page.getByTestId(`data-testid Dashboard template variables Variable Value DropDown option text ${expectedOption}`);
    await expect(optionButton).toBeVisible({ timeout: 5000 });
  }

  // Close the dropdown by pressing Escape
  await page.keyboard.press('Escape');
});
