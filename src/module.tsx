import { DataSourcePlugin } from '@grafana/data';

import CogniteDatasource from './datasource';

import { ConfigEditor } from './components/configEditor';
import { QueryEditor } from './components/queryEditor';
import { CogniteAnnotationsQueryCtrl } from './annotationCtrl';
import { CogniteVariableQueryEditor } from './components/variableQueryEditor';
import { MyQuery, CogniteDataSourceOptions } from './types';

export const plugin = new DataSourcePlugin<CogniteDatasource, MyQuery, CogniteDataSourceOptions>(
  CogniteDatasource
)
  .setConfigEditor(ConfigEditor)
  .setVariableQueryEditor(CogniteVariableQueryEditor)
  .setQueryEditor(QueryEditor);
