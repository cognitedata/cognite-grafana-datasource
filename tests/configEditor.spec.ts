import { test as base, expect, PluginFixture, PluginOptions } from '@grafana/plugin-e2e';
import { CogniteDataSourceOptions, CogniteSecureJsonData } from '../src/types';
import { readProvisionedDataSource } from '../playwright/fixtures/readProvisionedDataSource';

const test = base.extend<PluginFixture, PluginOptions>({ readProvisionedDataSource });

test('"Save & test" should be successful on provisioned data source', async ({
  readProvisionedDataSource,
  gotoDataSourceConfigPage,
  page,
}) => {
  const datasource = await readProvisionedDataSource({ fileName: 'datasources.yml' });
  const configPage = await gotoDataSourceConfigPage(datasource.uid);
  
  await page.getByTestId('data-testid Data source settings page Save and Test button').click();
  await expect(configPage).toHaveAlert('success', { hasText: 'Your Cognite credentials are valid' });
});

test('"Save & test" should be successful when configuration is valid', async ({
  createDataSourceConfigPage,
  readProvisionedDataSource,
  page,
}) => {
  const ds = await readProvisionedDataSource<CogniteDataSourceOptions, CogniteSecureJsonData>({ fileName: 'datasources.yml' });
  const configPage = await createDataSourceConfigPage({ type: ds.type });
  
  await page.getByRole('textbox', { name: 'Project' }).fill(ds.jsonData.cogniteProject ?? '');
  await page.getByLabel('API Host').fill(ds.jsonData.cogniteApiUrl ?? '');
  
  await page.getByLabel('OAuth2 client credentials').click();
  
  await page.getByLabel('Token URL').fill(ds.jsonData.oauthTokenUrl ?? '');
  await page.getByLabel('Client ID').fill(ds.jsonData.oauthClientId ?? '');
  await page.getByLabel('Client Secret').fill(ds.secureJsonData?.oauthClientSecret ?? '');
  await page.getByLabel('Scope').fill(ds.jsonData.oauthScope ?? '');

  await page.getByTestId('data-testid Data source settings page Save and Test button').click();
  await expect(configPage).toHaveAlert('success', { hasText: 'Your Cognite credentials are valid' });

});


test('"Save & test" should fail when configuration is invalid', async ({
  createDataSourceConfigPage,
  readProvisionedDataSource,
  page,
}) => {
  const ds = await readProvisionedDataSource<CogniteDataSourceOptions, CogniteSecureJsonData>({ fileName: 'datasources.yml' });
  const configPage = await createDataSourceConfigPage({ type: ds.type });
  
  await page.getByRole('textbox', { name: 'Project' }).fill(ds.jsonData.cogniteProject ?? '');
  await page.getByLabel('API Host').fill(ds.jsonData.cogniteApiUrl ?? '');
  
  await page.getByLabel('OAuth2 client credentials').click();
  
  await page.getByLabel('Token URL').fill(ds.jsonData.oauthTokenUrl ?? '');
  await page.getByLabel('Client ID').fill(ds.jsonData.oauthClientId ?? '');
  await page.getByLabel('Client Secret').fill('invalid');
  await page.getByLabel('Scope').fill(ds.jsonData.oauthScope ?? '');
  

  await page.getByTestId('data-testid Data source settings page Save and Test button').click();
  await expect(configPage).toHaveAlert('error', { hasText: 'Authentication to data source failed' });
});
