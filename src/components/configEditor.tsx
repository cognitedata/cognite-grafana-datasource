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

const apiUrlTooltip = `This is the hostname used to reach the API.
If the project is deployed on the default multi-tenant installation (api.cognitedata.com),
then keep the default value and do not change the hostname.
If the project is deployed on another cluster like westeurope-1.cognitedata.com,
then change the hostname to point at the API server for that cluster.
If unsure, leave the hostname as default.`;

const oAuthPassThruTooltip = `Forward the user's upstream OAuth identity to the data source
(Their access token gets passed along).`;

const oAuthClientCredsTooltip = `The OAuth 2.0 client credentials grant flow permits this data source to use its own credentials, instead of impersonating a user, to authenticate when calling CDF.`;

const oAuthTokenUrlTooltip = `OAuth 2.0 token endpoint (v2). E.g. https://login.microsoftonline.com/your-tenant/oauth2/v2.0/token`;

const oAuthClientSecretTooltip = `A secret string that the application uses to prove its identity when requesting a token. Also can be referred to as application password.`;

const oAuthScopeTooltip = `The value passed for the scope parameter should be the resource identifier (application ID URI) of the resource you want, affixed with the .default suffix. E.g. https://api.cognitedata.com/.default.`;

const enableCogniteTimeSeriesTooltip = `Enable the Cognite TimeSeries tab for exploring time series from the Core Data Model.`;

const enableTimeseriesSearchTooltip = `Enable the Time series search tab for searching and selecting time series.`;

const enableTimeseriesFromAssetTooltip = `Enable the Time series from asset tab for finding time series linked to assets.`;

const enableTimeseriesCustomQueryTooltip = `Enable the Time series custom query tab for advanced time series querying.`;

const enableEventsTooltip = `Enable the Events tab for querying CDF events.`;

const enableRelationshipsTooltip = `Enable the Relationships tab (deprecated - use Data Models instead).`;

const enableTemplatesTooltip = `Enable the templates tab for use with the Cognite Templates preview feature (deprecated).`;

const enableEventsAdvancedFilteringTooltip = `Enable the Events advanced filtering (preview)`;

const enableFlexibleDataModellingTooltip = 'Enable Data Models';

const enableExtractionPipelinesTooltip = 'Enable Extraction Pipelines (preview) - deprecated feature.';

const enableCoreDataModelFeaturesTooltip = `Master toggle for Core Data Model features section. When disabled, all Core Data Model features will be hidden.`;

const enableLegacyDataModelFeaturesTooltip = `Master toggle for Legacy Data Model features section. When disabled, all Legacy Data Model features will be hidden.`;

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
            tooltip="Cognite Data Fusion project name."
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
            Find out more about authentication at{' '}
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

      <FieldSet label="Core Data Model features">
        <InlineFieldRow style={{ marginBottom: '4px' }}>
          <InlineFormLabel htmlFor='enable-core-data-model-features' tooltip={enableCoreDataModelFeaturesTooltip} width={20}>
            Enable Core Data Model features
          </InlineFormLabel>
          <InlineSwitch
            id='enable-core-data-model-features'
            label='Enable Core Data Model features'
            value={enableCoreDataModelFeatures}
            onChange={onMasterToggleChange('enableCoreDataModelFeatures', ['enableCogniteTimeSeries', 'enableFlexibleDataModelling'])}
          />
        </InlineFieldRow>
        {enableCoreDataModelFeatures && (
          <>
            <InlineFieldRow style={{ marginBottom: '4px' }}>
              <InlineFormLabel htmlFor='enable-cognite-timeseries' tooltip={enableCogniteTimeSeriesTooltip} width={20}>
                Cognite Timeseries
              </InlineFormLabel>
              <InlineSwitch
                id='enable-cognite-timeseries'
                label='Cognite Timeseries'
                value={enableCogniteTimeSeries}
                onChange={onJsonBoolValueChange('enableCogniteTimeSeries')}
              />
            </InlineFieldRow>
            <InlineFieldRow style={{ marginBottom: '4px' }}>
              <InlineFormLabel htmlFor='enable-flexible-data-modelling' tooltip={enableFlexibleDataModellingTooltip} width={20}>
                Data Models
              </InlineFormLabel>
              <InlineSwitch
                id='enable-flexible-data-modelling'
                label='Data Models'
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
            Enable Legacy data model features
          </InlineFormLabel>
          <InlineSwitch
            id='enable-legacy-data-model-features'
            label='Enable Legacy data model features'
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
                Advanced Filtering
              </InlineFormLabel>
              <InlineSwitch
                id='enable-events-advanced-filtering'
                label='Advanced Filtering'
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
            Extraction Pipelines
          </InlineFormLabel>
          <InlineSwitch
            id='enable-extraction-pipelines'
            label='Extraction Pipelines'
            value={enableExtractionPipelines}
            onChange={onJsonBoolValueChange('enableExtractionPipelines')}
          />
        </InlineFieldRow>
        <InlineFieldRow style={{ marginBottom: '4px' }}>
          <InlineFormLabel htmlFor='enable-templates' tooltip={enableTemplatesTooltip} width={20}>
            Cognite Templates
          </InlineFormLabel>
          <InlineSwitch
            id='enable-templates'
            label='Cognite Templates'
            value={enableTemplates}
            onChange={onJsonBoolValueChange('enableTemplates')}
          />
        </InlineFieldRow>
      </FieldSet>
    </>
  );
}
