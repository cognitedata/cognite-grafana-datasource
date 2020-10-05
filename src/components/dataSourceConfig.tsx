import React, { useState, useCallback } from 'react';
import { css, cx } from 'emotion';
import { DataSourceSettings, SelectableValue } from '@grafana/data';

import { LegacyForms } from '@grafana/ui';
import { MyDataSourceOptions } from 'types';

const { FormField, Input, Select } = LegacyForms;

// import { InlineFormLabel } from '../FormLabel/FormLabel';
// import { TagsInput } from '../TagsInput/TagsInput';
// import { useTheme } from '../../themes';

export interface HttpSettingsBaseProps {
  /** The configuration object of the data source */
  dataSourceConfig: DataSourceSettings<MyDataSourceOptions, any>;
  /** Callback for handling changes to the configuration object */
  onChange: (config: DataSourceSettings) => void;
}

export interface HttpSettingsProps extends HttpSettingsBaseProps {
  /** The default url for the data source */
  defaultUrl: string;
  /** Show the http access help box */
  showAccessOptions?: boolean;
}

const DEFAULT_ACCESS_OPTION = {
  label: 'Server (default)',
  value: 'proxy',
};

export const DataSourceConfig: React.FC<HttpSettingsProps> = props => {
  const { defaultUrl, dataSourceConfig, onChange, showAccessOptions } = props;
  const [isAccessHelpVisible, setIsAccessHelpVisible] = useState(false);
  // const theme = useTheme();

  const onSettingsChange = useCallback(
    (change: Partial<DataSourceSettings<any, any>>) => {
      onChange({
        ...dataSourceConfig,
        ...change,
      });
    },
    [dataSourceConfig]
  );

  const isValidUrl = /^(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?$/.test(
    dataSourceConfig.url
  );

  const notValidStyle = css`
    box-shadow: inset 0 0px 5px red;
  `;

  const inputStyle = cx({ [`width-20`]: true, [notValidStyle]: !isValidUrl });

  const urlInput = (
    <Input
      className={inputStyle}
      placeholder={defaultUrl}
      value={dataSourceConfig.url}
      onChange={event => onSettingsChange({ url: event.currentTarget.value })}
    />
  );

  const projectInput = (
    <Input
      className={inputStyle}
      placeholder={defaultUrl}
      value={dataSourceConfig.jsonData.project}
      onChange={event => onSettingsChange({ url: event.currentTarget.value })}
    />
  );

  const apiKeyInput = (
    <Input
      className={inputStyle}
      placeholder={defaultUrl}
      value={dataSourceConfig.jsonData.project}
      onChange={event => onSettingsChange({ url: event.currentTarget.value })}
    />
  );

  return (
    <div>
      <h3 className="page-heading">Authentication</h3>

      <div className="gf-form-group">
        <div className="gf-form-inline">
          <div className="gf-form">
            <span className="gf-form-label width-9">Project</span>
            <FormField
              label="URL"
              labelWidth={11}
              tooltip="Cognite Data Fusion project"
              inputEl={projectInput}
            />

            {/* <info-popover mode="right-absolute">
                <p>Cognite Data Fusion project name.</p>
            </info-popover> */}
          </div>
        </div>
        <div className="gf-form-inline">
          <div className="gf-form" ng-if="!ctrl.current.secureJsonFields.cogniteDataPlatformApiKey">
            <span className="gf-form-label width-9">API key</span>
            <input
              type="password"
              className="gf-form-input"
              ng-model="ctrl.current.secureJsonData.cogniteDataPlatformApiKey"
              placeholder="Cognite Data Fusion API key"
            />
            {/* <info-popover mode="right-absolute">
                <p>Cognite Data Fusion API key.</p>
            </info-popover> */}
          </div>
          <div className="gf-form" ng-if="ctrl.current.secureJsonFields.cogniteDataPlatformApiKey">
            <span className="gf-form-label width-9">API key</span>
            <input
              type="text"
              className="gf-form-input max-width-12"
              disabled={false}
              value="Configured"
            />
            <a
              className="btn btn-secondary gf-form-btn"
              href="#"
              ng-click="ctrl.current.secureJsonData.cogniteDataPlatformApiKey = undefined; ctrl.current.secureJsonFields.cogniteDataPlatformApiKey = false;"
            >
              Reset
            </a>
          </div>
        </div>
        <div className="gf-form-inline">
          <div className="gf-form">
            <span className="gf-form-label width-9">API url</span>
            <input
              type="text"
              className="gf-form-input"
              ng-model="ctrl.current.jsonData.cogniteApiUrl"
              placeholder="api.cognitedata.com"
            />
            {/* <info-popover mode="right-absolute">
                <p>This is the URL used to reach the API.
                If the project is deployed on the default multi-tenant installation (most are),
                then keep the default value and do not change the URL.
                If the project is deployed on a separate custom cluster,
                then change the URL to point at the API server for that cluster.
                If unsure, leave the URL as default.</p>
            </info-popover> */}
          </div>
        </div>
      </div>
    </div>
  );
};
