import { DataQueryRequest, DataQueryResponse, TableData } from '@grafana/data';
import _ from 'lodash';
import { CogniteQuery, ExtractionPipelineQuery, HttpMethod } from '../types';
import { Connector } from '../connector';
import { handleError } from '../datasource';
import { convertItemsToTable } from '../cdf/client';

const exctractValuesToTable = (list, columns) => {
  if (list[0]?.length) {
    return _.map(list, (result) => exctractValuesToTable(result, columns));
  }
  return convertItemsToTable(list, columns);
};
const getTableData = (results) =>
  _.map(results, ({ response, columns }) => exctractValuesToTable(response, columns));

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
  async getExtractionPipelinesDropdowns(refId) {
    try {
      const response = await this.connector.fetchItems({
        path: '/extpipes',
        method: HttpMethod.GET,
        data: undefined,
      });
      return response;
    } catch (error) {
      handleError(error, refId);
      return [];
    }
  }
  private resolveManyEPRuns(selection) {
    return Promise.all(
      selection.map(({ value }) => this.fetchExtractionPipelinesRuns({ externalId: value }))
    );
  }
  postQuery(query) {
    const { selection, getRuns } = query;
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
        return this.postQuery(query);
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
      options.targets.map(async (target) => {
        try {
          const response = await this.runQuery({
            refId: target.refId,
            ...target.extractionPipelineQuery,
          });
          return {
            columns: target.extractionPipelineQuery.columns,
            response,
          };
        } catch (error) {
          handleError(error, target.refId);
          return {
            columns: target.extractionPipelineQuery.columns,
            response: [],
          };
        }
      })
    );
    const data = getTableData(results);
    return {
      data: _.flatten(data),
    };
  }
}
