import React, { ChangeEvent, PureComponent } from 'react';
import { LegacyForms } from '@grafana/ui';
import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { CogniteDataSourceOptions, CogniteSecureJsonData } from '../types';

const { SecretFormField, FormField } = LegacyForms;

type Props = DataSourcePluginOptionsEditorProps<CogniteDataSourceOptions, CogniteSecureJsonData>;

export class ConfigEditor extends PureComponent<Props> {
  onPathChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { onOptionsChange, options } = this.props;
    onOptionsChange({
      ...options,
      jsonData: {
        ...options.jsonData,
        cogniteApiUrl: event.target.value,
      },
    });
  };

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
        cogniteDataPlatformApiKey: event.target.value,
      },
    });
  };

  onResetAPIKey = () => {
    const { onOptionsChange, options } = this.props;
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

  render() {
    const { options } = this.props;
    const { jsonData, secureJsonFields } = options;
    const secureJsonData = options.secureJsonData || {};
    const tooltip = `This is the URL used to reach the API.
      If the project is deployed on the default multi-tenant installation (most are),
      then keep the default value and do not change the URL.
      If the project is deployed on a separate custom cluster,
      then change the URL to point at the API server for that cluster.
      If unsure, leave the URL as default.`;

    return (
      <div className="gf-form-group">
        <div className="gf-form">
          <FormField
            label="Project"
            labelWidth={6}
            inputWidth={20}
            onChange={this.onProjectChange}
            value={jsonData.cogniteProject || ''}
            placeholder="Cognite Data Fusion project"
          />
        </div>

        <div className="gf-form-inline">
          <div className="gf-form">
            <SecretFormField
              isConfigured={secureJsonFields?.cogniteDataPlatformApiKey as boolean}
              value={secureJsonData.cogniteDataPlatformApiKey || ''}
              label="API Key"
              placeholder="Cognite Data Fusion API key"
              labelWidth={6}
              inputWidth={20}
              onReset={this.onResetAPIKey}
              onChange={this.onAPIKeyChange}
            />
          </div>
        </div>

        <div className="gf-form">
          <FormField
            label="Path"
            labelWidth={6}
            inputWidth={20}
            onChange={this.onPathChange}
            value={jsonData.cogniteApiUrl || ''}
            placeholder="api.cognitedata.com"
            tooltip={tooltip}
          />
        </div>
      </div>
    );
  }
}
