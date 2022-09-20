import { DataQueryRequest, DataQueryResponse, SelectableValue } from '@grafana/data';
import _ from 'lodash';
import { CogniteQuery, ExtractionPipelinesQuery, HttpMethod } from '../types';
import { Connector } from '../connector';
import { handleError } from '../appEventHandler';
import { convertItemsToTable } from '../cdf/client';
import {
  ExtractionPipelineRunsParams,
  ExtractionPipelineRunsResponse,
  ExtractionPipelinesResponse,
  ExtractionPipelinesWithRun,
  FilterRequest,
  Resource,
} from '../cdf/types';

const exctractValuesToTable = (list, columns, names: SelectableValue | SelectableValue[]) => {
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

  private fetchExtractionPipelinesRuns = (
    filter: ExtractionPipelineRunsParams,
    limit = 100
  ): Promise<ExtractionPipelineRunsResponse[]> =>
    this.connector.fetchItems<ExtractionPipelineRunsResponse>({
      path: '/extpipes/runs/list',
      method: HttpMethod.POST,
      data: {
        filter,
        limit,
      },
    });
  private fetchExtractionPipelines = async (
    items: FilterRequest<SelectableValue>,
    refId: string
  ): Promise<ExtractionPipelinesWithRun[]> => {
    try {
      const pipelines = await this.connector.fetchItems<ExtractionPipelinesResponse>({
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
  private withLastRun = async (
    items: ExtractionPipelinesResponse[],
    refId: string
  ): Promise<ExtractionPipelinesWithRun[]> => {
    return Promise.all(
      items.map(
        async ({
          externalId,
          ...rest
        }: ExtractionPipelinesResponse): Promise<ExtractionPipelinesWithRun> => {
          try {
            const run = await this.fetchExtractionPipelinesRuns(
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
            return undefined;
          }
        }
      )
    );
  };
  postQuery(query: ExtractionPipelinesQuery, refId: string) {
    const { selections, getRuns } = query;
    if (!getRuns)
      return this.fetchExtractionPipelines(
        selections.map(({ id }) => ({ id })),
        refId
      );
    if (selections.length > 1)
      return Promise.all(
        selections.map(({ value }) => this.fetchExtractionPipelinesRuns({ externalId: value }))
      );
    return this.fetchExtractionPipelinesRuns({ externalId: selections[0].value });
  }
  async runQuery(query: ExtractionPipelinesQuery & { refId: string }) {
    const { selections, getRuns, refId } = query;
    try {
      if (getRuns && !selections.length) {
        handleError(new Error('Please select value for extraxtion pipelines runs'), refId);
        return [];
      }
      if (selections.length) return this.postQuery(query, refId);
      const items = await this.connector.fetchItems<ExtractionPipelinesResponse>({
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
            target.extractionPipelinesQuery.selections
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
  async getExtractionPipelinesDropdowns(refId: string): Promise<ExtractionPipelinesResponse[]> {
    try {
      const response = await this.connector.fetchItems<ExtractionPipelinesResponse>({
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
}
