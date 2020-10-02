import { DataSourcePlugin } from '@grafana/data';

import CogniteDatasource from './datasource';

import { CogniteQueryCtrl } from './queryCtrl';
import { CogniteConfigCtrl } from './configCtrl';
import { CogniteAnnotationsQueryCtrl } from './annotationCtrl';
import { CogniteVariableQueryCtrl } from './components/variableQueryCtrl';

export {
  CogniteDatasource as Datasource,
  CogniteQueryCtrl as QueryCtrl,
  CogniteConfigCtrl as ConfigCtrl,
  CogniteAnnotationsQueryCtrl as AnnotationsQueryCtrl,
  CogniteVariableQueryCtrl as VariableQueryEditor,
};

/*
export const plugin = new DataSourcePlugin<CogniteDatasource, MyQuery, MyDataSourceOptions>(CogniteDatasource)
  .setConfigEditor(CogniteConfigCtrl)
  .setQueryEditor(CogniteQueryCtrl);*/
