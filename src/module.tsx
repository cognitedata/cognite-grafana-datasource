import { DataSourcePlugin } from '@grafana/data';

import CogniteDatasource from './datasource';

import { CogniteQueryCtrl } from './queryCtrl';
import { ConfigEditor } from './components/configCtrl';
import { CogniteAnnotationsQueryCtrl } from './annotationCtrl';
import { CogniteVariableQueryCtrl } from './components/variableQueryCtrl';
import { InputQueryTarget } from 'types';

/*
export {
  CogniteDatasource as Datasource,
  CogniteQueryCtrl as QueryCtrl,
  ConfigEditor as ConfigCtrl,
  CogniteAnnotationsQueryCtrl as AnnotationsQueryCtrl,
  CogniteVariableQueryCtrl as VariableQueryEditor,
};*/


export const plugin = new DataSourcePlugin<CogniteDatasource, InputQueryTarget, any>(CogniteDatasource)
  .setConfigEditor(ConfigEditor)
//  .setQueryEditor(CogniteQueryCtrl);
