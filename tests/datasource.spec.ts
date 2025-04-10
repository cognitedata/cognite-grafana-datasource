import { test as base, expect, PluginFixture, PluginOptions } from '@grafana/plugin-e2e';
import { readProvisionedDataSource } from '../playwright/fixtures/readProvisionedDataSource';

const test = base.extend<PluginFixture, PluginOptions>({ readProvisionedDataSource });

test('Panel with multiple time series queries rendered OK', async ({ gotoDashboardPage, readProvisionedDashboard, page }) => {
  const dashboard = await readProvisionedDashboard({ fileName: 'weather-station.json' });
  await gotoDashboardPage(dashboard);

  // Check labels are rendered correctly
  await expect(page.getByTestId('data-testid panel content')).toMatchAriaSnapshot(`
    - list:
      - listitem:
        - button "59.9139-10.7522-current.clouds percent"
      - listitem:
        - button "59.9139-10.7522-current.feels_like Kelvin"
      - listitem:
        - button "59.9139-10.7522-current.humidity percent"
      - listitem:
        - button "59.9139-10.7522-current.pressure hPa"
      - listitem:
        - button "59.9139-10.7522-current.temp Kelvin"
      - listitem:
        - button "59.9139-10.7522-current.wind_speed meter / second"
      - listitem:
        - button "59.9139-10.7522-current.uvi W/m2"
  `);
});
