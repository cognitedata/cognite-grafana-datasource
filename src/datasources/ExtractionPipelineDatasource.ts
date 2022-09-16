import { DataQueryRequest, DataQueryResponse } from '@grafana/data';
import _ from 'lodash';
import { CogniteQuery, ExtractionPipelineQuery, HttpMethod } from '../types';
import { Connector } from '../connector';
import { handleError } from '../datasource';
import { convertItemsToTable } from '../cdf/client';

const exctractValuesToTable = (list) => {
  const columns = [];
  _.map(list, (item) => {
    _.mapKeys(item, (_, key) => columns.push(key));
  });
  return convertItemsToTable(list, _.uniq(columns));
};
export class ExtractionPipelineDatasource {
  public constructor(private connector: Connector) {}

  fetchExtractionPipelinesRuns = (filter) =>
    this.connector.fetchItems({
      path: '/extpipes/runs/list',
      method: HttpMethod.POST,
      data: {
        filter,
      },
    });
  fetchExtractionPipelines = (items) =>
    this.connector.fetchItems({
      path: `/extpipes/byids`,
      method: HttpMethod.POST,
      data: {
        items,
      },
    });
  getExtractionPipelinesDropdowns() {
    return this.connector.fetchItems({
      path: '/extpipes',
      method: HttpMethod.GET,
      data: undefined,
    });
  }
  private resolveManyEPRuns(selection) {
    return Promise.all(
      selection.map(({ value }) => this.fetchExtractionPipelinesRuns({ externalId: value }))
    );
  }
  postQuery(selection, getRuns) {
    if (!getRuns) return this.fetchExtractionPipelines(selection.map(({ id }) => ({ id })));
    if (selection.length > 1) return this.resolveManyEPRuns(selection);
    return this.fetchExtractionPipelinesRuns({ externalId: selection[0].value });
  }
  async runQuery(query: ExtractionPipelineQuery & { refId: string }) {
    const { selection, getRuns, refId } = query;
    try {
      if (getRuns && !selection.length) {
        handleError(new Error('Please select value for extraxtion pipelines runs'), refId);
        return [];
      }
      if (selection.length) {
        return this.postQuery(selection, getRuns);
      }
      const items = await this.connector.fetchItems({
        path: `/extpipes/list`,
        method: HttpMethod.POST,
        data: {
          filter: {},
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
    const data = _.map(results, (result) => exctractValuesToTable(result));
    // console.log(results, data);
    return {
      data,
    };
  }
}
