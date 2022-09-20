import { DataQueryRequest, DataQueryResponse, TableData } from '@grafana/data';
import _ from 'lodash';
import { CogniteQuery, ExtractionPipelinesQuery, HttpMethod } from '../types';
import { Connector } from '../connector';
import { handleError } from '../appEventHandler';
import { convertItemsToTable } from '../cdf/client';
import { Resource } from '../cdf/types';

type ExtractionPipelinesWithRun = {
  id?: number;
  status?: string;
  message?: string;
};
const exctractValuesToTable = (list, columns, names = undefined) => {
  if (list[0]?.length) {
    return _.map(list, (result, index) =>
      exctractValuesToTable(result, columns, names[index].value)
    );
  }
  const deepList = _.map(list, (item) => {
    const resource = {};
    _.map(item, (value, key) => {
      if (_.isArray(value)) {
        _.map(value[0], (v, k) => _.assignIn(resource, { [`${key}-${k}`]: v }));
      } else if (_.isObject(value)) {
        _.map(value, (v, k) => _.assignIn(resource, { [`${key}-${k}`]: v }));
      } else _.assignIn(resource, { [key]: value });
    });
    return resource as Resource;
  });
  return convertItemsToTable(deepList, columns, names);
};
export class ExtractionPipelinesDatasource {
  public constructor(private connector: Connector) {}

  private fetchExtractionPipelinesRuns = (filter, limit = 100) =>
    this.connector.fetchItems({
      path: '/extpipes/runs/list',
      method: HttpMethod.POST,
      data: {
        filter,
        limit,
      },
    });
  private fetchExtractionPipelines = async (items, refId) => {
    try {
      const pipelines = await this.connector.fetchItems({
        path: `/extpipes/byids`,
        method: HttpMethod.POST,
        data: {
          items,
        },
      });
      return this.withLastRun(pipelines, refId);
    } catch (error) {
      handleError(error, refId);
      return [];
    }
  };
  private withLastRun = (items, refId) => {
    return Promise.all(
      items.map(async ({ externalId, ...rest }) => {
        try {
          const run: ExtractionPipelinesWithRun[] = await this.fetchExtractionPipelinesRuns(
            {
              externalId,
            },
            1
          );
          return {
            externalId,
            ...rest,
            status: run[0]?.status,
            message: run[0]?.message,
            runId: run[0]?.id,
          };
        } catch (error) {
          handleError(error, refId);
          return [];
        }
      })
    );
  };
  private resolveManyEPRuns(selection) {
    return Promise.all(
      selection.map(({ value }) => this.fetchExtractionPipelinesRuns({ externalId: value }))
    );
  }
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
  postQuery(query, refId) {
    const { selection, getRuns } = query;
    if (!getRuns)
      return this.fetchExtractionPipelines(
        selection.map(({ id }) => ({ id })),
        refId
      );
    if (selection.length > 1) return this.resolveManyEPRuns(selection);
    return this.fetchExtractionPipelinesRuns({ externalId: selection[0].value });
  }
  async runQuery(query: ExtractionPipelinesQuery & { refId: string }) {
    const { selection, getRuns, refId } = query;
    try {
      if (getRuns && !selection.length) {
        handleError(new Error('Please select value for extraxtion pipelines runs'), refId);
        return [];
      }
      if (selection.length) return this.postQuery(query, refId);
      const items = await this.connector.fetchItems({
        path: `/extpipes/list`,
        method: HttpMethod.POST,
        data: {
          filter: {},
        },
      });
      return this.withLastRun(items, refId);
    } catch (error) {
      handleError(error, refId);
      return [];
    }
  }
  async query(options: DataQueryRequest<CogniteQuery>): Promise<DataQueryResponse> {
    const data = await Promise.all(
      options.targets.map(async (target) => {
        try {
          const response = await this.runQuery({
            refId: target.refId,
            ...target.extractionPipelinesQuery,
          });
          return exctractValuesToTable(
            response,
            target.extractionPipelinesQuery.columns,
            target.extractionPipelinesQuery.selection
          );
        } catch (error) {
          handleError(error, target.refId);
          return [];
        }
      })
    );
    return {
      data: _.flatten(data),
    };
  }
}
