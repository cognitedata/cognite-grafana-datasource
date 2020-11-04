import { DataSourcePlugin } from '@grafana/data';

import CogniteDatasource from './datasource';

import { ConfigEditor } from './components/configEditor';
import { QueryEditor } from './components/queryEditor';
import { CogniteAnnotationsQueryCtrl } from './annotationCtrl';
import { CogniteVariableQueryEditor } from './components/variableQueryEditor';
import { CogniteQuery, CogniteDataSourceOptions } from './types';

export const plugin = new DataSourcePlugin<
  CogniteDatasource,
  CogniteQuery,
  CogniteDataSourceOptions
>(CogniteDatasource)
  .setConfigEditor(ConfigEditor)
  .setVariableQueryEditor(CogniteVariableQueryEditor)
  .setQueryEditor(QueryEditor)
  .setAnnotationQueryCtrl(CogniteAnnotationsQueryCtrl);
