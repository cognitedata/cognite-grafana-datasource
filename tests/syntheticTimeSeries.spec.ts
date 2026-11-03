import { expect } from '@grafana/plugin-e2e';
import type { Page, Request, Response } from '@playwright/test';
import { waitForQueriesToFinish } from '../playwright/fixtures/waitForQueriesToFinish';
import { test } from '../playwright/fixtures/patchNavigationStrategy';
import { addPanel as addPanelHelper } from '../playwright/fixtures/addPanel';

// A weather-station series in the e2e fixture project; its instance lives in cdm_try.
const FIXTURE_EXTERNAL_ID = '59.9139-10.7522-current.temp';
const FIXTURE_SPACE = 'cdm_try';
const VIEW_REF = { type: 'view', space: 'cdf_cdm', externalId: 'CogniteTimeSeries', version: 'v1' };

// Seeded by scripts/seed-synthetic-time-series-fixtures.mjs: two assets, each related to
// a temperature and a flow series through the time series' `assets` property.
const ASSETS_SPACE = 'grafana-ts-fixtures';
const NORTH_ASSET = { space: ASSETS_SPACE, externalId: 'ts-expr-asset-north' };
const SOUTH_ASSET = { space: ASSETS_SPACE, externalId: 'ts-expr-asset-south' };
const NORTH_SERIES = ['ts-expr-north-temp', 'ts-expr-north-flow'];
const SOUTH_SERIES = ['ts-expr-south-temp', 'ts-expr-south-flow'];
const ASSETS_PROPERTY = ['cdf_cdm', 'CogniteTimeSeries/v1', 'assets'];

const externalIdsIn = (expressions: string[]) =>
  expressions.map((expression) => expression.match(/externalId='([^']+)'/)?.[1]).sort();

/** The synthetic query CDF answered, so a test can check both what was sent and that it was accepted. */
const syntheticResponse = (page: Page) =>
  page.waitForResponse((response: Response) => response.url().endsWith('/timeseries/synthetic/query'));

/** A series in the panel's legend, which only appears once its data came back. */
const legendSeries = (page: Page, name: string) => page.getByTestId(`data-testid VizLegend series ${name}`);

/** The filter's lookup of CogniteTimeSeries instances, not the unit catalog the tab also lists. */
const isTimeSeriesLookup = (request: Request) =>
  request.url().endsWith('/models/instances/list') &&
  request.postDataJSON()?.sources?.[0]?.source?.externalId === 'CogniteTimeSeries';

test('"Synthetic time series" resolves a filter variable and sends the instance to the synthetic API', async ({
  readProvisionedDataSource,
  readProvisionedDashboard,
  gotoDashboardPage,
  page,
  grafanaVersion,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });

  const ds = await readProvisionedDataSource({ fileName: 'datasources.yml' });
  const dashboard = await readProvisionedDashboard({ fileName: 'weather-station.json' });
  const dashboardPage = await gotoDashboardPage(dashboard);
  const panelEditPage = await addPanelHelper(dashboardPage, page, grafanaVersion);
  await panelEditPage.datasource.set(ds.name);

  const editorRow = panelEditPage.getQueryEditorRow('A');

  // By role: the Alpha chip sits inside the tab, so its text is not the label alone.
  const tab = editorRow.getByRole('tab', { name: /^Synthetic time series/ });
  await expect(tab).toBeVisible();
  await tab.click();

  // The default view is selected, with one variable A as a picked series.
  await expect(editorRow.locator('input[id="view-A"]')).toBeVisible();
  await expect(editorRow.getByText('CogniteTimeSeries (cdf_cdm) v1', { exact: true })).toBeVisible();
  await expect(editorRow.getByTestId('variable-name-A-0')).toHaveValue('A');

  // Switch A to a filter and type one; Enter commits the row.
  await editorRow.getByRole('radio', { name: 'Filter' }).click();
  // role="code" is the editor itself; Monaco also mounts hidden widgets with the .monaco-editor class.
  const filterEditor = editorRow.locator('[data-testid="variable-filter-editor-A-0"] [role="code"]');
  await expect(filterEditor).toBeVisible();
  await filterEditor.click();
  // insertText, not type: it bypasses the completion popup and the auto-closed quotes.
  await page.keyboard.insertText(`externalId='${FIXTURE_EXTERNAL_ID}'`);
  // Escape closes a completion popup, if any opened, so Enter commits the row.
  await page.keyboard.press('Escape');
  await page.keyboard.press('Enter');

  const expressionEditor = editorRow.locator('[data-testid="expression-editor"] [role="code"]');
  await expressionEditor.click();
  await page.keyboard.insertText('A * 2');

  const instanceLookup = page.waitForRequest(isTimeSeriesLookup);
  const syntheticQuery = syntheticResponse(page);
  // Leaving the editor commits the expression and runs the query.
  await editorRow.locator('input[id="label-A"]').click();

  const lookupBody = (await instanceLookup).postDataJSON();
  expect(lookupBody.sources).toEqual([{ source: VIEW_REF }]);
  expect(lookupBody.filter).toEqual({ equals: { property: ['node', 'externalId'], value: FIXTURE_EXTERNAL_ID } });

  const synthetic = await syntheticQuery;
  expect(synthetic.ok()).toBe(true);
  const syntheticBody = synthetic.request().postDataJSON();
  expect(syntheticBody.items).toHaveLength(1);
  const expression: string = syntheticBody.items[0].expression;
  expect(expression).toContain(`space='${FIXTURE_SPACE}'`);
  expect(expression).toContain(`externalId='${FIXTURE_EXTERNAL_ID}'`);
  expect(expression).toContain("aggregate='average'");
  expect(expression).toMatch(/\} \* 2$/);

  await waitForQueriesToFinish(page);
});

test('"Synthetic time series" filters on a dashboard variable of asset instance ids', async ({
  readProvisionedDashboard,
  gotoDashboardPage,
  page,
}) => {
  // The provisioned dashboard: variable `asset` lists the fixture assets as instance ids
  // (north selected), and its panel filters A on `assets=$asset, type='numeric'`.
  const dashboard = await readProvisionedDashboard({ fileName: 'synthetic-time-series-e2e.json' });

  const instanceLookup = page.waitForRequest(isTimeSeriesLookup);
  const syntheticQuery = syntheticResponse(page);
  await gotoDashboardPage(dashboard);

  // The variable's instance id becomes a direct-relation value; `=` on a list property is containsAny.
  const lookupBody = (await instanceLookup).postDataJSON();
  expect(lookupBody.filter.and).toEqual(
    expect.arrayContaining([
      { containsAny: { property: ASSETS_PROPERTY, values: [NORTH_ASSET] } },
      { equals: { property: ['cdf_cdm', 'CogniteTimeSeries/v1', 'type'], value: 'numeric' } },
    ])
  );
  const synthetic = await syntheticQuery;
  expect(synthetic.ok()).toBe(true);
  const syntheticBody = synthetic.request().postDataJSON();
  expect(externalIdsIn(syntheticBody.items.map((item: { expression: string }) => item.expression))).toEqual(
    [...NORTH_SERIES].sort()
  );
  await waitForQueriesToFinish(page);
  for (const name of NORTH_SERIES) {
    await expect(legendSeries(page, name)).toBeVisible();
  }

  // Both assets selected: one value per reference, and every related series is resolved.
  const bothLookup = page.waitForRequest(isTimeSeriesLookup);
  const bothSynthetic = syntheticResponse(page);
  await gotoDashboardPage({
    ...dashboard,
    queryParams: new URLSearchParams([
      ['var-asset', JSON.stringify(NORTH_ASSET)],
      ['var-asset', JSON.stringify(SOUTH_ASSET)],
    ]),
  });
  expect((await bothLookup).postDataJSON().filter.and).toEqual(
    expect.arrayContaining([{ containsAny: { property: ASSETS_PROPERTY, values: [NORTH_ASSET, SOUTH_ASSET] } }])
  );
  const both = await bothSynthetic;
  expect(both.ok()).toBe(true);
  const bothBody = both.request().postDataJSON();
  expect(externalIdsIn(bothBody.items.map((item: { expression: string }) => item.expression))).toEqual(
    [...NORTH_SERIES, ...SOUTH_SERIES].sort()
  );
  await waitForQueriesToFinish(page);
  for (const name of [...NORTH_SERIES, ...SOUTH_SERIES]) {
    await expect(legendSeries(page, name)).toBeVisible();
  }
});

test('"Synthetic time series" excludes an asset variable and matches a multi-value text variable', async ({
  readProvisionedDashboard,
  gotoDashboardPage,
  page,
}) => {
  // Filter: space='grafana-ts-fixtures', assets!=$asset, name=$tag, with the north asset and
  // three names selected: the north asset's time series drop out, leaving the two south ones.
  const dashboard = await readProvisionedDashboard({ fileName: 'synthetic-time-series-e2e-vars.json' });

  const instanceLookup = page.waitForRequest(isTimeSeriesLookup);
  const syntheticQuery = syntheticResponse(page);
  await gotoDashboardPage(dashboard);

  expect((await instanceLookup).postDataJSON().filter.and).toEqual(
    expect.arrayContaining([
      { not: { containsAny: { property: ASSETS_PROPERTY, values: [NORTH_ASSET] } } },
      {
        in: {
          property: ['cdf_cdm', 'CogniteTimeSeries/v1', 'name'],
          values: ['ts-expr-north-temp', 'ts-expr-south-temp', 'ts-expr-south-flow'],
        },
      },
    ])
  );
  const synthetic = await syntheticQuery;
  expect(synthetic.ok()).toBe(true);
  const syntheticBody = synthetic.request().postDataJSON();
  expect(externalIdsIn(syntheticBody.items.map((item: { expression: string }) => item.expression))).toEqual(
    [...SOUTH_SERIES].sort()
  );
  await waitForQueriesToFinish(page);
  for (const name of SOUTH_SERIES) {
    await expect(legendSeries(page, name)).toBeVisible();
  }
  await expect(legendSeries(page, 'ts-expr-north-temp')).toHaveCount(0);
});
