import React from 'react';
import { DataSourceConfig } from './dataSourceConfig';
import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { MyDataSourceOptions } from '../types';

interface Props extends DataSourcePluginOptionsEditorProps<MyDataSourceOptions> {}

export const ConfigEditor: React.FC<Props> = ({ onOptionsChange, options }) => {
  return (
    <DataSourceConfig
      defaultUrl="https://api.example.com"
      dataSourceConfig={options}
      onChange={onOptionsChange}
    />
  );
};
