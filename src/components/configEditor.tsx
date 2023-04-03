import React, { ChangeEvent, useState } from 'react';
import { Icon, LegacyForms } from '@grafana/ui';
import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { CogniteDataSourceOptions, CogniteSecureJsonData } from '../types';
import { FeatureFlagsWarning, KonamiTracker } from './devFeatures';
import '../css/common.css';

const { SecretFormField, FormField, Switch } = LegacyForms;

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

const enableTemplatesTooltip = `Enable the templates tab for use with the Cognite Templates preview feature.`;

const enableEventsAdvancedFilteringTooltip = `Enable the Events advanced filtering (preview)`;

const enableFlexibleDataModellingTooltip = 'Enable Data Models (preview)';

const enableExtractionPipelinesTooltip = 'Enable Extraction Pipelines (preview)';

export function ConfigEditor(props: ConfigEditorProps) {
  const [showHelp, setShowHelp] = useState(false);
  const { onOptionsChange, options } = props;
  const { secureJsonData = {}, jsonData, secureJsonFields } = options;
  const { cogniteDataPlatformApiKey = '', oauthClientSecret = '' } = secureJsonData;
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
    enableTemplates,
    enableEventsAdvancedFiltering,
    enableFlexibleDataModelling,
    enableExtractionPipelines,
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

  const onJsonStringValueChange =
    (key: keyof CogniteDataSourceOptions) => (event: ChangeEvent<HTMLInputElement>) =>
      onJsonDataChange({ [key]: event.target.value });

  const onJsonBoolValueChange =
    (key: keyof CogniteDataSourceOptions) => (event: ChangeEvent<HTMLInputElement>) =>
      onJsonDataChange({ [key]: event.currentTarget.checked });

  // Secure field (only sent to the backend)
  const onChangeSecretValue =
    (secretKey: keyof CogniteSecureJsonData) => (event: ChangeEvent<HTMLInputElement>) =>
      onOptionsChange({
        ...options,
        secureJsonData: {
          [secretKey]: event.target.value,
        },
      });

  const onResetSecretValue = (secretKey: keyof CogniteSecureJsonData) => () =>
    onOptionsChange({
      ...options,
      secureJsonFields: {
        ...options.secureJsonFields,
        [secretKey]: false,
      },
      secureJsonData: {
        ...options.secureJsonData,
        [secretKey]: '',
      },
    });

  return (
    <>
      <div className="gf-form-group">
        <h3 className="page-heading">HTTP</h3>
        <div className="gf-form gf-form-inline">
          <FormField
            label="Project"
            labelWidth={12}
            inputWidth={21}
            onChange={onJsonStringValueChange('cogniteProject')}
            value={cogniteProject}
            placeholder={defaultProject ?? 'Cognite Data Fusion project'}
            tooltip="Cognite Data Fusion project name."
          />
        </div>

        <div className="gf-form gf-form-inline">
          <FormField
            label="API Host"
            labelWidth={12}
            inputWidth={21}
            onChange={onJsonStringValueChange('cogniteApiUrl')}
            value={cogniteApiUrl}
            placeholder={clusterUrl ?? 'api.cognitedata.com'}
            tooltip={apiUrlTooltip}
          />
        </div>
      </div>

      <div className="gf-form-group">
        <h3 className="page-heading">
          Auth <Icon name="question-circle" onClick={() => setShowHelp(!showHelp)} />
        </h3>
        {showHelp && (
          <pre>
            Find out more about authentication at{' '}
            <a href="https://docs.cognite.com/cdf/dashboards/guides/grafana/admin.html#step-3-configure-the-cognite-data-source-for-grafana">
              docs.cognite.com/cdf/dashboards/guides/grafana/admin.html
            </a>
          </pre>
        )}
        <div className="gf-form-inline">
          <Switch
            label="Forward OAuth Identity"
            labelClass="width-12"
            checked={oauthPassThru}
            onChange={onJsonBoolValueChange('oauthPassThru')}
            tooltip={oAuthPassThruTooltip}
          />
        </div>
        {!oauthPassThru && (
          <div className="gf-form">
            <Switch
              label="OAuth2 client credentials"
              labelClass="width-12"
              checked={oauthClientCreds}
              onChange={onJsonBoolValueChange('oauthClientCreds')}
              tooltip={oAuthClientCredsTooltip}
            />
          </div>
        )}
        {!oauthPassThru && oauthClientCreds && (
          <>
            <div className="gf-form">
              <FormField
                label="Token URL"
                labelWidth={12}
                inputWidth={21}
                onChange={onJsonStringValueChange('oauthTokenUrl')}
                value={oauthTokenUrl}
                placeholder="https://login.example.com/.../oauth2/v2.0/token"
                tooltip={oAuthTokenUrlTooltip}
              />
            </div>
            <div className="gf-form">
              <FormField
                label="Client Id"
                labelWidth={12}
                inputWidth={21}
                onChange={onJsonStringValueChange('oauthClientId')}
                value={oauthClientId}
                placeholder="Your Application (client) ID"
              />
            </div>
            <div className="gf-form">
              <SecretFormField
                isConfigured={secureJsonFields.oauthClientSecret}
                value={oauthClientSecret}
                label="Client secret"
                tooltip={oAuthClientSecretTooltip}
                labelWidth={12}
                inputWidth={21}
                placeholder="******"
                onReset={onResetSecretValue('oauthClientSecret')}
                onChange={onChangeSecretValue('oauthClientSecret')}
              />
            </div>
            <div className="gf-form">
              <FormField
                label="Scope"
                labelWidth={12}
                inputWidth={21}
                onChange={onJsonStringValueChange('oauthScope')}
                value={oauthScope}
                tooltip={oAuthScopeTooltip}
                placeholder="E.g. https://api.cognitedata.com/.default"
              />
            </div>
          </>
        )}
        {!(oauthPassThru || oauthClientCreds) && (
          <div className="gf-form-inline">
            <div className="gf-form">
              <SecretFormField
                isConfigured={secureJsonFields.cogniteDataPlatformApiKey}
                value={cogniteDataPlatformApiKey}
                label="API Key"
                placeholder="Cognite Data Fusion API key"
                tooltip="Cognite Data Fusion API key."
                labelWidth={12}
                inputWidth={20}
                onReset={onResetSecretValue('cogniteDataPlatformApiKey')}
                onChange={onChangeSecretValue('cogniteDataPlatformApiKey')}
              />
            </div>
          </div>
        )}
      </div>

      <div className="gf-form-group">
        <h3 className="page-heading">Opt-in features</h3>
        <div className="gf-form-inline">
          <Switch
            label="Cognite Templates"
            labelClass="width-12"
            checked={enableTemplates}
            onChange={onJsonBoolValueChange('enableTemplates')}
            tooltip={enableTemplatesTooltip}
          />
        </div>
        <div className="gf-form-inline">
          <Switch
            label="Advanced Filtering"
            labelClass="width-12"
            checked={enableEventsAdvancedFiltering}
            onChange={onJsonBoolValueChange('enableEventsAdvancedFiltering')}
            tooltip={enableEventsAdvancedFilteringTooltip}
          />
        </div>
        <div className="gf-form-inline">
          <Switch
            label="Data Models"
            labelClass="width-12"
            checked={enableFlexibleDataModelling}
            onChange={onJsonBoolValueChange('enableFlexibleDataModelling')}
            tooltip={enableFlexibleDataModellingTooltip}
          />
        </div>
        <div className="gf-form-inline">
          <Switch
            label="Extraction Pipelines"
            labelClass="width-12"
            checked={enableExtractionPipelines}
            onChange={onJsonBoolValueChange('enableExtractionPipelines')}
            tooltip={enableExtractionPipelinesTooltip}
          />
        </div>
      </div>
    </>
  );
}
