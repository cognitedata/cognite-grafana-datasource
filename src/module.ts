import { DataSourcePlugin } from '@grafana/data';

import CogniteDatasource from './datasource';

import { ConfigEditor } from './components/configEditor';
import { QueryEditor } from './components/queryEditor';

import { CogniteQuery, CogniteDataSourceOptions } from './types';

// The variable editor is registered through `CustomVariableSupport` on the
// datasource itself, which is Grafana's current API for variable queries.
export const plugin = new DataSourcePlugin<
  CogniteDatasource,
  CogniteQuery,
  CogniteDataSourceOptions
>(CogniteDatasource)
  .setConfigEditor(ConfigEditor)
  .setQueryEditor(QueryEditor)
