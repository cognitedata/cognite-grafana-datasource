import { CustomVariableSupport, DataQueryRequest, DataQueryResponse } from '@grafana/data';
import { Observable, from } from 'rxjs';
import CogniteDatasource from './datasource';
import { CogniteVariableQueryEditor } from './components/variableQueryEditor';
import { VariableQueryData } from './types';

/**
 * Grafana's current variable API, replacing `setVariableQueryEditor` plus a bare
 * `metricFindQuery`. Execution itself is unchanged: the same `metricFindQuery` runs,
 * and `{ text, value }` rows are a shape Grafana turns into variable options
 * directly, so saved variables resolve exactly as they did before.
 */
export class CogniteVariableSupport extends CustomVariableSupport<CogniteDatasource> {
  constructor(private readonly datasource: CogniteDatasource) {
    super();
    // Grafana calls this without binding, so the reference has to carry its own `this`.
    this.query = this.query.bind(this);
  }

  editor = CogniteVariableQueryEditor as any;

  query(request: DataQueryRequest<any>): Observable<DataQueryResponse> {
    const [target] = request.targets ?? [];
    // Variables saved before the object model existed are bare strings, and still
    // resolve through the asset-centric path.
    const variableQuery: VariableQueryData =
      typeof target === 'string' ? { query: target } : { ...(target ?? { query: '' }) };

    return from(
      this.datasource
        .metricFindQuery(variableQuery)
        .then((data): DataQueryResponse => ({ data }))
    );
  }
}
