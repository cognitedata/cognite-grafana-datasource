import React, { ChangeEvent, useState } from 'react';
import { FieldSet, Icon, InlineField, InlineFieldRow, InlineFormLabel, InlineSwitch, Input, SecretInput } from '@grafana/ui';
import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { CogniteDataSourceOptions, CogniteSecureJsonData } from '../types';
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

const enableTemplatesTooltip = `Enable the templates tab for use with the Cognite Templates preview feature.`;

const enableEventsAdvancedFilteringTooltip = `Enable the Events advanced filtering (preview)`;

const enableFlexibleDataModellingTooltip = 'Enable Data Models';

const enableExtractionPipelinesTooltip = 'Enable Extraction Pipelines (preview)';

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
      <FieldSet label='HTTP'>
          <InlineField
            label="Project"
            labelWidth={24}            
            tooltip="Cognite Data Fusion project name."
          >
            <Input
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
                Client Id
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

      <FieldSet label="Opt-in features">
        <InlineFieldRow style={{ marginBottom: '4px' }}>
          <InlineFormLabel htmlFor='enable-templates' tooltip={enableTemplatesTooltip} width={12}>
            Cognite Templates
          </InlineFormLabel>
          <InlineSwitch
            id='enable-templates'
            label='Cognite Templates'
            value={enableTemplates}
            onChange={onJsonBoolValueChange('enableTemplates')}
          />
        </InlineFieldRow>
        <InlineFieldRow style={{ marginBottom: '4px' }}>
          <InlineFormLabel htmlFor='enable-events-advanced-filtering' tooltip={enableEventsAdvancedFilteringTooltip} width={12}>
            Advanced Filtering
          </InlineFormLabel>
          <InlineSwitch
            id='enable-events-advanced-filtering'
            label='Advanced Filtering'
            value={enableEventsAdvancedFiltering}
            onChange={onJsonBoolValueChange('enableEventsAdvancedFiltering')}
          />
        </InlineFieldRow>
        <InlineFieldRow style={{ marginBottom: '4px' }}>
          <InlineFormLabel htmlFor='enable-flexible-data-modelling' tooltip={enableFlexibleDataModellingTooltip} width={12}>
            Data Models
          </InlineFormLabel>
          <InlineSwitch
            id='enable-flexible-data-modelling'
            label='Data Models'
            value={enableFlexibleDataModelling}
            onChange={onJsonBoolValueChange('enableFlexibleDataModelling')}
          />
        </InlineFieldRow>
        <InlineFieldRow style={{ marginBottom: '4px' }}>
          <InlineFormLabel htmlFor='enable-extraction-pipelines' tooltip={enableExtractionPipelinesTooltip} width={12}>
            Extraction Pipelines
          </InlineFormLabel>
          <InlineSwitch
            id='enable-extraction-pipelines'
            label='Extraction Pipelines'
            value={enableExtractionPipelines}
            onChange={onJsonBoolValueChange('enableExtractionPipelines')}
          />
        </InlineFieldRow>
      </FieldSet>
    </>
  );
}
