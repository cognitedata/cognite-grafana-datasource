import React, { ChangeEvent, PureComponent, useState } from 'react';
import { Icon, LegacyForms } from '@grafana/ui';
import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { CogniteDataSourceOptions, CogniteSecureJsonData } from '../types';

const { SecretFormField, FormField, Switch } = LegacyForms;

type ConfigEditorProps = DataSourcePluginOptionsEditorProps<
  CogniteDataSourceOptions,
  CogniteSecureJsonData
>;

const apiUrlTooltip = `This is the URL used to reach the API.
If the project is deployed on the default multi-tenant installation (most are),
then keep the default value and do not change the URL.
If the project is deployed on a separate custom cluster,
then change the URL to point at the API server for that cluster.
If unsure, leave the URL as default.`;

const oAuthPassThruTooltip = `Forward the user's upstream OAuth identity to the data source
(Their access token gets passed along).`;

export function ConfigEditor(props: ConfigEditorProps) {
  const [showHelp, setShowHelp] = useState(false);
  const { onOptionsChange, options } = props;
  const { secureJsonData = {}, jsonData, secureJsonFields } = options;
  const { apiKey = '' } = secureJsonData;
  const { cogniteProject = '', cogniteApiUrl = '', oauthPassThru } = jsonData;

  const onApiUrlChange = (event: ChangeEvent<HTMLInputElement>) => {
    onOptionsChange({
      ...options,
      jsonData: {
        ...options.jsonData,
        cogniteApiUrl: event.target.value,
      },
    });
  };

  // TODO: Verify that this is correct.
  const onProjectChange = (event: ChangeEvent<HTMLInputElement>) => {
    onOptionsChange({
      ...options,
      jsonData: {
        ...options.jsonData,
        cogniteProject: event.target.value,
      },
    });
  };

  // Secure field (only sent to the backend)
  const onAPIKeyChange = (event: ChangeEvent<HTMLInputElement>) => {
    onOptionsChange({
      ...options,
      secureJsonData: {
        cogniteDataPlatformApiKey: event.target.value,
      },
    });
  };

  const onOAuthPassThruChange = (event: ChangeEvent<HTMLInputElement>) => {
    onOptionsChange({
      ...options,
      jsonData: {
        ...options.jsonData,
        oauthPassThru: event.currentTarget.checked,
      },
    });
  };

  const onResetAPIKey = () => {
    onOptionsChange({
      ...options,
      secureJsonFields: {
        ...options.secureJsonFields,
        cogniteDataPlatformApiKey: false,
      },
      secureJsonData: {
        ...options.secureJsonData,
        cogniteDataPlatformApiKey: '',
      },
    });
  };

  return (
    <>
      <div className="gf-form-group">
        <h3 className="page-heading">HTTP</h3>
        <div className="gf-form-inline">
          <FormField
            label="Project"
            labelWidth={6}
            inputWidth={20}
            onChange={onProjectChange}
            value={cogniteProject}
            placeholder="Cognite Data Fusion project"
            tooltip="Cognite Data Fusion project name."
          />
        </div>

        <div className="gf-form-inline">
          <FormField
            label="API URL"
            labelWidth={6}
            inputWidth={20}
            onChange={onApiUrlChange}
            value={cogniteApiUrl}
            placeholder="api.cognitedata.com"
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
            labelClass="width-13"
            checked={oauthPassThru}
            onChange={onOAuthPassThruChange}
            tooltip={oAuthPassThruTooltip}
          />
        </div>
        {!oauthPassThru && (
          <div className="gf-form-inline">
            <div className="gf-form">
              <SecretFormField
                isConfigured={secureJsonFields.apiKey}
                value={apiKey}
                label="API Key"
                placeholder="Cognite Data Fusion API key"
                tooltip="Cognite Data Fusion API key."
                labelWidth={6}
                inputWidth={20}
                onReset={onResetAPIKey}
                onChange={onAPIKeyChange}
              />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
