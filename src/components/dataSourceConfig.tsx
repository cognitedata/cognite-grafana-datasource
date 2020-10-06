import React, { useState, useCallback } from 'react';
import { css, cx } from 'emotion';
import { DataSourceSettings, SelectableValue } from '@grafana/data';

import { LegacyForms } from '@grafana/ui';
import { DataSourceProps, MyDataSourceOptions } from 'types';

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

export const DataSourceConfig: React.FC<DataSourceProps> = props => {
  const { defaultUrl, defaultProject, dataSourceConfig, onChange, showAccessOptions } = props;
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

  function ApiUrlInput(props) {
    const urlInput = (
      <Input
        className={props.inputStyle}
        placeholder={props.defaultUrl}
        value={props.dataSourceConfig.url}
        onChange={event => onSettingsChange({ url: event.currentTarget.value })}
      />
    );
    let tooltip =
      `This is the URL used to reach the API.
      If the project is deployed on the default multi-tenant installation (most are),
      then keep the default value and do not change the URL.
      If the project is deployed on a separate custom cluster,
      then change the URL to point at the API server for that cluster.
      If unsure, leave the URL as default.`;

    return (
      <div className="gf-form-inline">
        <div className="gf-form">
          {
            // FIXME: ctrl.current.jsonData.cogniteApiUrl
          }
          <FormField
            label="API URL"
            labelWidth={11}
            tooltip={tooltip}
            inputEl={urlInput}
          />
        </div>
      </div>
    )
  }

  function ProjectInput(props) {
    let projectInput = (
      <Input
        className={inputStyle}
        placeholder={defaultProject}
        value={dataSourceConfig.jsonData.project}
        onChange={event => onSettingsChange({ url: event.currentTarget.value })}
      />)

    return (
      <div className="gf-form-inline">
        <div className="gf-form">
          <FormField
            label="Project"
            labelWidth={11}
            tooltip="Cognite Data Fusion project name."
            inputEl={projectInput}
          />
        </div>
      </div>
    )
  }

  function ApiKeyInput(props) {
    let input;
    if (props.dataSourceConfig.url) {
      input = (
        <Input
          className={inputStyle}
          placeholder={defaultUrl}
          value={dataSourceConfig.jsonData.project}
          onChange={event => onSettingsChange({ url: event.currentTarget.value /** Set Api-key instead of URL */})}
          type="password"
        />
        /* <info-popover mode="right-absolute">
                <p>Cognite Data Fusion API key.</p>
            </info-popover> */
      );
    } else {
      input = (
        <>
          <Input
          className={inputStyle}
          placeholder="Configured"
          value={dataSourceConfig.jsonData.project}
          disabled={true}
          />
          <a
            className="btn btn-secondary gf-form-btn"
            href="#"
            onClick={/*Unset API key here?*/()=>(null)} // ctrl.current.secureJsonFields.cogniteDataPlatformApiKey
          >
            Reset
          </a>
        </>
      )
    }

    return (
      <div className="gf-form-inline">
        <div className="gf-form">
          <FormField
            label="API Key"
            labelWidth={11}
            tooltip="Cognite Data Fusion API key."
            inputEl={input}
          />
        </div>
      </div>
    )
  };

  return (
    <div>
      <h3 className="page-heading">Authentication</h3>

      <div className="gf-form-group">
        <ApiKeyInput dataSourceConfig={DataSourceConfig} />
        <ProjectInput />
        <ApiUrlInput inputStyle={inputStyle} defaultUrl={defaultUrl} dataSourceConfig={dataSourceConfig}/>
      </div>
    </div>
  );
};
