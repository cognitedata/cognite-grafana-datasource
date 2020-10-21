import React, { ChangeEvent, PureComponent } from 'react';
import { LegacyForms } from '@grafana/ui';
import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { CogniteDataSourceOptions, MySecureJsonData } from '../types';

const { SecretFormField, FormField, Switch } = LegacyForms;

type ConfigEditorProps = DataSourcePluginOptionsEditorProps<
  CogniteDataSourceOptions,
  MySecureJsonData
>;

const apiUrlTooltip = `This is the URL used to reach the API.
If the project is deployed on the default multi-tenant installation (most are),
then keep the default value and do not change the URL.
If the project is deployed on a separate custom cluster,
then change the URL to point at the API server for that cluster.
If unsure, leave the URL as default.`;

const oAuthPassThruTooltip = `Forward the user's upstream OAuth identity to the data source
(Their access token gets passed along).`;

export class ConfigEditor extends PureComponent<ConfigEditorProps> {
  onApiUrlChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onOptionsChange, options } = this.props;
    onOptionsChange({
      ...options,
      jsonData: {
        ...options.jsonData,
        cogniteApiUrl: event.target.value,
      },
    });
  };

  // TODO: Verify that this is correct.
  onProjectChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onOptionsChange, options } = this.props;
    onOptionsChange({
      ...options,
      jsonData: {
        ...options.jsonData,
        cogniteProject: event.target.value,
      },
    });
  };

  // Secure field (only sent to the backend)
  onAPIKeyChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onOptionsChange, options } = this.props;
    onOptionsChange({
      ...options,
      secureJsonData: {
        apiKey: event.target.value,
      },
    });
  };

  onOAuthPassThruChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onOptionsChange, options } = this.props;
    onOptionsChange({
      ...options,
      jsonData: {
        ...options.jsonData,
        oauthPassThru: event.currentTarget.checked,
      },
    });
  };

  onResetAPIKey = () => {
    const { onOptionsChange, options } = this.props;
    onOptionsChange({
      ...options,
      secureJsonFields: {
        ...options.secureJsonFields,
        apiKey: false,
      },
      secureJsonData: {
        ...options.secureJsonData,
        apiKey: '',
      },
    });
  };

  render() {
    const { options } = this.props;
    const { secureJsonData = {}, jsonData, secureJsonFields } = options;
    const { apiKey = '' } = secureJsonData;
    const { cogniteProject = '', cogniteApiUrl = '', oauthPassThru } = jsonData;

    return (
      <>
        <div className="gf-form-group">
          <h3 className="page-heading">HTTP</h3>
          <div className="gf-form-inline">
            <FormField
              label="Project"
              labelWidth={6}
              inputWidth={20}
              onChange={this.onProjectChange}
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
              onChange={this.onApiUrlChange}
              value={cogniteApiUrl}
              placeholder="api.cognitedata.com"
              tooltip={apiUrlTooltip}
            />
          </div>
        </div>

        <div className="gf-form-group">
          <h3 className="page-heading">Auth</h3>
          <div className="gf-form-inline">
            <Switch
              label="Forward OAuth Identity"
              labelClass="width-13"
              checked={oauthPassThru}
              onChange={this.onOAuthPassThruChange}
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
                  onReset={this.onResetAPIKey}
                  onChange={this.onAPIKeyChange}
                />
              </div>
            </div>
          )}
        </div>
      </>
    );
  }
}
