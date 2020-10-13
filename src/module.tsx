import { DataSourcePlugin } from '@grafana/data';

import CogniteDatasource from './datasource';

import { CogniteQueryCtrl } from './queryCtrl';
import { ConfigEditor } from './components/configEditor';
import { CogniteAnnotationsQueryCtrl } from './annotationCtrl';
import { CogniteVariableQueryCtrl } from './components/variableQueryCtrl';
import { MyQuery, MyDataSourceOptions } from './types';

export const plugin = new DataSourcePlugin<CogniteDatasource, MyQuery, MyDataSourceOptions>(
  CogniteDatasource
).setConfigEditor(ConfigEditor);
//  .setQueryEditor(CogniteQueryCtrl);
