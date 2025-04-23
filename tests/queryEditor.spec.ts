import { test as base, expect, PluginFixture, PluginOptions } from '@grafana/plugin-e2e';
import { waitForQueriesToFinish } from '../playwright/fixtures/waitForQueriesToFinish';
import { readProvisionedDataSource } from '../playwright/fixtures/readProvisionedDataSource';

const test = base.extend<PluginFixture, PluginOptions>({ readProvisionedDataSource });

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

test('Panel with asset subtree queries rendered OK', async ({ selectors, readProvisionedDataSource, gotoDashboardPage, readProvisionedDashboard, page }) => {
  const ds = await readProvisionedDataSource({ fileName: 'datasources.yml' });
  const dashboard = await readProvisionedDashboard({ fileName: 'weather-station.json' });
  const dashboardPage = await gotoDashboardPage(dashboard);

  const panelEditPage = await dashboardPage.addPanel();
  await panelEditPage.datasource.set(ds.name);

  const editorRow = panelEditPage.getQueryEditorRow("A");

  await editorRow.getByText('Time series from asset').click();

  const combobox = await editorRow.getByRole('combobox', { name: 'Asset Tag' });
  await combobox.click();

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
      timeout: 10000,
      waitForResponsePredicateCallback: async (response) => {
        
        const isTsData = response.request().url().endsWith('/timeseries/data/latest');
        const is200 = response.status() === 200;
        
        if (isTsData && is200) {
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
