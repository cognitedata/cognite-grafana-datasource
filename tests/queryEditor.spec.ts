import { test as base, expect, PluginFixture, PluginOptions } from '@grafana/plugin-e2e';
import { Response } from 'playwright';
import { waitForQueriesToFinish } from '../playwright/fixtures/waitForQueriesToFinish';
import { readProvisionedDataSource } from '../playwright/fixtures/readProvisionedDataSource';
import semver from 'semver';

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


const isCdfResponse = (path: string) => {
  return (response: Response) => {
    const isTsData = response.request().url().endsWith(path);
    const is200 = response.status() === 200;

    return isTsData && is200;
  }
};

test('Panel with asset subtree queries rendered OK', async ({ selectors, readProvisionedDataSource, gotoDashboardPage, readProvisionedDashboard, page, grafanaVersion }) => {
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

  await waitForQueriesToFinish(page, grafanaVersion);

  await expect(panelEditPage.refreshPanel(
    {
      timeout: 10000,
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

  await waitForQueriesToFinish(page, grafanaVersion);
  await expect(panelEditPage.refreshPanel({ waitForResponsePredicateCallback: isCdfResponse('/timeseries/synthetic/query') })).toBeOK();

  // transform into a single table, this is simpler to assert
  if (semver.gte(grafanaVersion, '11.5.4')) {
    await page.getByTestId('data-testid Tab Transformations').click();
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

  await waitForQueriesToFinish(page, grafanaVersion);
  await expect(panelEditPage.refreshPanel({ waitForResponsePredicateCallback: isCdfResponse('/events/list') })).toBeOK();

  // Check if the table contains the expected events
  // Since we filtered the events by prefix, we can check if the table contains the events that start with "test_event (1"
  // and do not contain the events that start with "test_event (2..9"
  const ALL_EVENT_PREFIX_PATTERN = /^test_event/;
  const EXPECTED_EVENT_PREFIX_PATTERN = /test_event \(1/;
  const EXCLUDED_EVENT_PATTERN = /test_event \(2-9/;

  const validateCellTexts = (cellTexts: string[]) => {
    const hasExpectedEvents = cellTexts.every(text => EXPECTED_EVENT_PREFIX_PATTERN.test(text));
    const hasNoExcludedEvents = !cellTexts.some(text => EXCLUDED_EVENT_PATTERN.test(text));
    return cellTexts.length && hasExpectedEvents && hasNoExcludedEvents;
  };

  await expect.poll(async () => {
    const cellTexts = await panelEditPage.panel.locator.getByRole('cell', { name: ALL_EVENT_PREFIX_PATTERN }).allTextContents();
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
