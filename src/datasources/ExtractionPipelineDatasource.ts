import { DataQueryRequest, DataQueryResponse } from '@grafana/data';
import { CogniteQuery, ExtractionPipelineQuery, HttpMethod } from '../types';
import { Connector } from '../connector';
import { handleError } from '../datasource';

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
    try {
      const items = await this.connector.fetchItems({
        path: `/extpipes${getRuns ? '/runs/' : '/'}list`,
        method: HttpMethod.POST,
        data: {
          filter: getRuns ? { externalId: selection.value } : { name: selection.label },
        },
      });
      return items;
    } catch (error) {
      handleError(error, query.refId);
      return [];
    }
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
