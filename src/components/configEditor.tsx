import React, { ChangeEvent, useState } from 'react';
import { FieldSet, Icon, InlineField, InlineFieldRow, InlineFormLabel, InlineSwitch, Input, SecretInput } from '@grafana/ui';
import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { CogniteDataSourceOptions, CogniteSecureJsonData } from '../types';
import { FEATURE_DEFAULTS, FeatureKey } from '../featureDefaults';
import { 
  stringValueHandler, 
  boolValueHandler, 
  secretValueHandler, 
  resetSecretHandler,
  masterToggleHandler
} from '../configEditorUtils';
import '../css/common.css';


type ConfigEditorProps = DataSourcePluginOptionsEditorProps<
  CogniteDataSourceOptions,
  CogniteSecureJsonData
>;

const apiUrlTooltip = `Hostname used to reach the API. 
For projects deployed on the default multi-tenant installation (api.cognitedata.com), keep the default value and do not change the hostname.
For projects deployed on another cluster (e.g., westeurope-1.cognitedata.com), change the hostname to point at the cluster's API server.
When unsure, keep the hostname as the default.`;

const oAuthPassThruTooltip = `Pass the user's identity from the OAuth service to the data source. Their access token will be passed along.`;

const oAuthClientCredsTooltip = `The OAuth 2.0 client credentials grant flow permits this data source to use its own credentials, instead of impersonating a user, to authenticate when calling CDF.`;

const oAuthTokenUrlTooltip = `OAuth 2.0 token endpoint (v2). Example: https://login.microsoftonline.com/your-tenant/oauth2/v2.0/token`;

const oAuthClientSecretTooltip = `A secret string that the application uses to prove its identity when requesting a token. Also referred to as an application password.`;

const oAuthScopeTooltip = `The value passed for the scope parameter should be the resource identifier (application ID URI) of the resource you want, affixed with the .default suffix. Example: https://api.cognitedata.com/.default.`;

const enableCogniteTimeSeriesTooltip = `Enable to explore time series from the core data model`;

const enableTimeseriesSearchTooltip = `Enable to search and select time series`;

const enableTimeseriesFromAssetTooltip = `Enable to find time series linked to assets`;

const enableTimeseriesCustomQueryTooltip = `Enable for advanced time series querying`;

const enableEventsTooltip = `Enable to query CDF events`;

const enableRelationshipsTooltip = `Deprecated. Use the data models feature instead.`;

const enableTemplatesTooltip = `Deprecated. Enables the Cognite templates preview.`;

const enableEventsAdvancedFilteringTooltip = `Enable advanced filtering for events (preview)`;

const enableFlexibleDataModellingTooltip = 'Enable to use data models';

const enableExtractionPipelinesTooltip = 'Deprecated. Enables extraction pipelines (preview).';

const enableCoreDataModelFeaturesTooltip = `Enable to show all core data model features`;

const enableLegacyDataModelFeaturesTooltip = `Enable to show all legacy data model features`;

// Feature keys are derived from FEATURE_DEFAULTS to ensure only boolean feature flags are handled

export function ConfigEditor(props: ConfigEditorProps) {
  const [showHelp, setShowHelp] = useState(false);
  const { onOptionsChange, options } = props;
  const { secureJsonData = {}, jsonData, secureJsonFields } = options;
  const { oauthClientSecret = '' } = secureJsonData;
  const {
    cogniteProject = '',
    defaultProject,
    cogniteApiUrl = '',
    clusterUrl,
    oauthPassThru,
    oauthClientCreds,
    oauthClientId,
    oauthTokenUrl,
    oauthScope,
    // Master toggles for feature sections
    enableCoreDataModelFeatures = FEATURE_DEFAULTS.enableCoreDataModelFeatures,
    enableLegacyDataModelFeatures = FEATURE_DEFAULTS.enableLegacyDataModelFeatures,
    // Core Data Model features
    enableCogniteTimeSeries = FEATURE_DEFAULTS.enableCogniteTimeSeries,
    // Legacy data model features
    enableTimeseriesSearch = FEATURE_DEFAULTS.enableTimeseriesSearch,
    enableTimeseriesFromAsset = FEATURE_DEFAULTS.enableTimeseriesFromAsset,
    enableTimeseriesCustomQuery = FEATURE_DEFAULTS.enableTimeseriesCustomQuery,
    enableEvents = FEATURE_DEFAULTS.enableEvents,
    // Deprecated features
    enableTemplates = FEATURE_DEFAULTS.enableTemplates,
    enableEventsAdvancedFiltering = FEATURE_DEFAULTS.enableEventsAdvancedFiltering,
    enableFlexibleDataModelling = FEATURE_DEFAULTS.enableFlexibleDataModelling,
    enableExtractionPipelines = FEATURE_DEFAULTS.enableExtractionPipelines,
    enableRelationships = FEATURE_DEFAULTS.enableRelationships,
  } = jsonData;

  const onJsonDataChange = (patch: Partial<ConfigEditorProps['options']['jsonData']>) => {
    onOptionsChange({
      ...options,
      jsonData: {
        ...jsonData,
        ...patch,
      },
    });
  };

  const onJsonStringValueChange = (key: keyof CogniteDataSourceOptions) =>
    stringValueHandler(key, onJsonDataChange);

  const onJsonBoolValueChange = (key: keyof CogniteDataSourceOptions) =>
    boolValueHandler(key, onJsonDataChange);

  const onMasterToggleChange = (masterKey: FeatureKey, dependentKeys: FeatureKey[]) =>
    masterToggleHandler(masterKey, dependentKeys, onJsonDataChange);

  const onChangeSecretValue = (secretKey: keyof CogniteSecureJsonData) =>
    secretValueHandler(secretKey, options, onOptionsChange);

  const onResetSecretValue = (secretKey: keyof CogniteSecureJsonData) =>
    resetSecretHandler(secretKey, options, onOptionsChange);

  return (
    <>
      <FieldSet label='HTTP'>
          <InlineField
            label="Project"
            labelWidth={24}            
            tooltip="Your CDF project name."
          >
            <Input
              id='cognite-project'
              value={cogniteProject}
              width={42}
              placeholder={defaultProject ?? 'Cognite Data Fusion project'}
              onChange={onJsonStringValueChange('cogniteProject')}
            />
          </InlineField>

        <InlineField
          label="API Host"
          labelWidth={24}
          tooltip={apiUrlTooltip}
        >
          <Input
            id='cognite-api-host'
            value={cogniteApiUrl}
            width={42}
            placeholder={clusterUrl ?? 'api.cognitedata.com'}
            onChange={onJsonStringValueChange('cogniteApiUrl')}
          />
        </InlineField>
      </FieldSet>

      <FieldSet 
        label={<>Auth <Icon name="question-circle" onClick={() => setShowHelp(!showHelp)} /></>}
        >

        {showHelp && (
          <pre>
            Learn more about authentication at{' '}
            <a href="https://docs.cognite.com/cdf/dashboards/guides/grafana/admin.html#step-3-configure-the-cognite-data-source-for-grafana">
              docs.cognite.com/cdf/dashboards/guides/grafana/admin.html
            </a>
          </pre>
        )}
        <InlineFieldRow style={{ marginBottom: '4px' }}>
          <InlineFormLabel htmlFor='oauth-pass-thru' tooltip={oAuthPassThruTooltip} width={12}>
            Forward OAuth Identity
          </InlineFormLabel>
          <InlineSwitch
            label='Forward OAuth Identity'
            id='oauth-pass-thru'
            value={oauthPassThru}
            onChange={onJsonBoolValueChange('oauthPassThru')}
          />
        </InlineFieldRow>
        {!oauthPassThru && (
          <InlineFieldRow style={{ marginBottom: '4px' }}>
            <InlineFormLabel htmlFor='oauth-client-creds' tooltip={oAuthClientCredsTooltip} width={12}>
              OAuth2 client credentials
            </InlineFormLabel>
            <InlineSwitch
              label='OAuth2 client credentials'
              value={oauthClientCreds}
              onChange={onJsonBoolValueChange('oauthClientCreds')}
            />
          </InlineFieldRow>
        )}
        {!oauthPassThru && oauthClientCreds && (
          <>
            <InlineFieldRow style={{ marginBottom: '4px' }}>
              <InlineFormLabel htmlFor='oauth-token-url' tooltip={oAuthTokenUrlTooltip} width={12}>
                Token URL
              </InlineFormLabel>
              <Input
                id='oauth-token-url'
                value={oauthTokenUrl}
                width={42}
                placeholder="https://login.example.com/.../oauth2/v2.0/token"
                onChange={onJsonStringValueChange('oauthTokenUrl')}
              />
            </InlineFieldRow>
            <InlineFieldRow style={{ marginBottom: '4px' }}>
              <InlineFormLabel htmlFor='oauth-client-id' tooltip={oAuthClientSecretTooltip} width={12}>
                Client ID
              </InlineFormLabel>
              <Input
                id='oauth-client-id'
                value={oauthClientId}
                width={42}
                placeholder="Your Application (client) ID"
                onChange={onJsonStringValueChange('oauthClientId')}
              />
            </InlineFieldRow>
            <InlineFieldRow>
              <InlineField label="Client secret" labelWidth={24} tooltip={oAuthClientSecretTooltip}>
                <SecretInput
                  id="oauth-client-secret"
                  isConfigured={secureJsonFields.oauthClientSecret}
                  value={oauthClientSecret}
                  label="Client secret"
                  width={42}
                  placeholder="******"
                  onReset={onResetSecretValue('oauthClientSecret')}
                  onChange={onChangeSecretValue('oauthClientSecret')}
                />
              </InlineField>
            </InlineFieldRow>
            <InlineFieldRow style={{ marginBottom: '4px' }}>
              <InlineFormLabel htmlFor='oauth-scope' tooltip={oAuthScopeTooltip} width={12}>
                Scope
              </InlineFormLabel>
              <Input
                id='oauth-scope'
                value={oauthScope}
                width={42}
                placeholder="E.g. https://api.cognitedata.com/.default"
                onChange={onJsonStringValueChange('oauthScope')}
              />
            </InlineFieldRow>
          </>
        )}
      </FieldSet>

      <FieldSet label="Core data model features">
        <InlineFieldRow style={{ marginBottom: '4px' }}>
          <InlineFormLabel htmlFor='enable-core-data-model-features' tooltip={enableCoreDataModelFeaturesTooltip} width={20}>
            Core data model features
          </InlineFormLabel>
          <InlineSwitch
            id='enable-core-data-model-features'
            label='Core data model features'
            value={enableCoreDataModelFeatures}
            onChange={onMasterToggleChange('enableCoreDataModelFeatures', ['enableCogniteTimeSeries', 'enableFlexibleDataModelling'])}
          />
        </InlineFieldRow>
        {enableCoreDataModelFeatures && (
          <>
            <InlineFieldRow style={{ marginBottom: '4px' }}>
              <InlineFormLabel htmlFor='enable-cognite-timeseries' tooltip={enableCogniteTimeSeriesTooltip} width={20}>
                CogniteTimeSeries
              </InlineFormLabel>
              <InlineSwitch
                id='enable-cognite-timeseries'
                label='CogniteTimeSeries'
                value={enableCogniteTimeSeries}
                onChange={onJsonBoolValueChange('enableCogniteTimeSeries')}
              />
            </InlineFieldRow>
            <InlineFieldRow style={{ marginBottom: '4px' }}>
              <InlineFormLabel htmlFor='enable-flexible-data-modelling' tooltip={enableFlexibleDataModellingTooltip} width={20}>
                Data models
              </InlineFormLabel>
              <InlineSwitch
                id='enable-flexible-data-modelling'
                label='Data models'
                value={enableFlexibleDataModelling}
                onChange={onJsonBoolValueChange('enableFlexibleDataModelling')}
              />
            </InlineFieldRow>
          </>
        )}
      </FieldSet>

      <FieldSet label="Legacy data model features">
        <InlineFieldRow style={{ marginBottom: '4px' }}>
          <InlineFormLabel htmlFor='enable-legacy-data-model-features' tooltip={enableLegacyDataModelFeaturesTooltip} width={20}>
            Legacy data model features
          </InlineFormLabel>
          <InlineSwitch
            id='enable-legacy-data-model-features'
            label='Legacy data model features'
            value={enableLegacyDataModelFeatures}
            onChange={onMasterToggleChange('enableLegacyDataModelFeatures', [
              'enableTimeseriesSearch',
              'enableTimeseriesFromAsset', 
              'enableTimeseriesCustomQuery',
              'enableEvents',
              'enableEventsAdvancedFiltering'
            ])}
          />
        </InlineFieldRow>
        {enableLegacyDataModelFeatures && (
          <>
            <InlineFieldRow style={{ marginBottom: '4px' }}>
              <InlineFormLabel htmlFor='enable-timeseries-search' tooltip={enableTimeseriesSearchTooltip} width={20}>
                Time series search
              </InlineFormLabel>
              <InlineSwitch
                id='enable-timeseries-search'
                label='Time series search'
                value={enableTimeseriesSearch}
                onChange={onJsonBoolValueChange('enableTimeseriesSearch')}
              />
            </InlineFieldRow>
            <InlineFieldRow style={{ marginBottom: '4px' }}>
              <InlineFormLabel htmlFor='enable-timeseries-from-asset' tooltip={enableTimeseriesFromAssetTooltip} width={20}>
                Time series from asset
              </InlineFormLabel>
              <InlineSwitch
                id='enable-timeseries-from-asset'
                label='Time series from asset'
                value={enableTimeseriesFromAsset}
                onChange={onJsonBoolValueChange('enableTimeseriesFromAsset')}
              />
            </InlineFieldRow>
            <InlineFieldRow style={{ marginBottom: '4px' }}>
              <InlineFormLabel htmlFor='enable-timeseries-custom-query' tooltip={enableTimeseriesCustomQueryTooltip} width={20}>
                Time series custom query
              </InlineFormLabel>
              <InlineSwitch
                id='enable-timeseries-custom-query'
                label='Time series custom query'
                value={enableTimeseriesCustomQuery}
                onChange={onJsonBoolValueChange('enableTimeseriesCustomQuery')}
              />
            </InlineFieldRow>
            <InlineFieldRow style={{ marginBottom: '4px' }}>
              <InlineFormLabel htmlFor='enable-events' tooltip={enableEventsTooltip} width={20}>
                Events
              </InlineFormLabel>
              <InlineSwitch
                id='enable-events'
                label='Events'
                value={enableEvents}
                onChange={onJsonBoolValueChange('enableEvents')}
              />
            </InlineFieldRow>
            <InlineFieldRow style={{ marginBottom: '4px' }}>
              <InlineFormLabel htmlFor='enable-events-advanced-filtering' tooltip={enableEventsAdvancedFilteringTooltip} width={20}>
                Advanced filtering
              </InlineFormLabel>
              <InlineSwitch
                id='enable-events-advanced-filtering'
                label='Advanced filtering'
                value={enableEventsAdvancedFiltering}
                onChange={onJsonBoolValueChange('enableEventsAdvancedFiltering')}
              />
            </InlineFieldRow>
          </>
        )}
      </FieldSet>

      <FieldSet label="Deprecated features">
        <InlineFieldRow style={{ marginBottom: '4px' }}>
          <InlineFormLabel htmlFor='enable-relationships' tooltip={enableRelationshipsTooltip} width={20}>
            Relationships
          </InlineFormLabel>
          <InlineSwitch
            id='enable-relationships'
            label='Relationships'
            value={enableRelationships}
            onChange={onJsonBoolValueChange('enableRelationships')}
          />
        </InlineFieldRow>
        <InlineFieldRow style={{ marginBottom: '4px' }}>
          <InlineFormLabel htmlFor='enable-extraction-pipelines' tooltip={enableExtractionPipelinesTooltip} width={20}>
            Extraction pipelines
          </InlineFormLabel>
          <InlineSwitch
            id='enable-extraction-pipelines'
            label='Extraction pipelines'
            value={enableExtractionPipelines}
            onChange={onJsonBoolValueChange('enableExtractionPipelines')}
          />
        </InlineFieldRow>
        <InlineFieldRow style={{ marginBottom: '4px' }}>
          <InlineFormLabel htmlFor='enable-templates' tooltip={enableTemplatesTooltip} width={20}>
            Cognite templates
          </InlineFormLabel>
          <InlineSwitch
            id='enable-templates'
            label='Cognite templates'
            value={enableTemplates}
            onChange={onJsonBoolValueChange('enableTemplates')}
          />
        </InlineFieldRow>
      </FieldSet>
    </>
  );
}
