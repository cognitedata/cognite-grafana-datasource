import { DataQueryRequest, DataQueryResponse } from '@grafana/data';
import { CogniteQuery, ExtractionPipelineQuery, HttpMethod } from '../types';
import { Connector } from '../connector';

export class ExtractionPipelineDatasource {
  public constructor(private connector: Connector) {}

  async runQuery(query: ExtractionPipelineQuery & { refId: string }) {
    const { externalId } = query;
    return this.connector.fetchItems({
      path: '/extpipes/runs/list',
      method: HttpMethod.POST,
      data: {
        filter: {
          externalId,
        },
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
