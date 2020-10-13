import { DataSourcePlugin } from '@grafana/data';

import CogniteDatasource from './datasource';

import { ConfigEditor } from './components/configEditor';
import { CogniteAnnotationsQueryCtrl } from './annotationCtrl';
import { CogniteVariableQueryCtrl } from './components/variableQueryCtrl';
import { MyQuery, CogniteDataSourceOptions } from './types';

export const plugin = new DataSourcePlugin<CogniteDatasource, MyQuery, CogniteDataSourceOptions>(
  CogniteDatasource
)
  .setConfigEditor(ConfigEditor)
  .setVariableQueryEditor(CogniteVariableQueryCtrl);
//  .setQueryEditor(CogniteQueryCtrl);
