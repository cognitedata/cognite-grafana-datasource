import { DataQueryRequest, DataQueryResponse } from '@grafana/data';
import { CogniteQuery, ExtractionPipelineQuery, HttpMethod } from '../types';
import { Connector } from '../connector';

export class ExtractionPipelineDatasource {
  public constructor(private connector: Connector) {}

  getExtractionPipelinesDropdowns() {
    return this.connector.fetchItems({
      path: '/extpipes',
      method: HttpMethod.GET,
      data: undefined,
    });
  }
  async runQuery(query: ExtractionPipelineQuery & { refId: string }) {
    const { selection, getRuns } = query;
    return this.connector.fetchItems({
      path: `/extpipes${getRuns ? '/runs/' : '/'}list`,
      method: HttpMethod.POST,
      data: {
        filter: getRuns ? { externalId: selection.value } : { id: selection.id },
      },
    });
  }
  async query(options: DataQueryRequest<CogniteQuery>): Promise<DataQueryResponse> {
    const results = await Promise.all(
      options.targets.map((target) => {
        return this.runQuery({ refId: target.refId, ...target.extractionPipelineQuery });
      })
    );
    return {
      data: results,
    };
  }
}
