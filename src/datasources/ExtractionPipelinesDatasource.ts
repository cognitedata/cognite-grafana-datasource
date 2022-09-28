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

type RunsResponse = {
  filter: ExtractionPipelineRunsParams;
  response: ExtractionPipelineRunsResponse[];
};
type Dataset = {
  name: string;
};
const exctractValuesToTable = (list, query, name) => {
  const { columns, selections, getRuns } = query;
  if (list[0]?.filter) {
    return _.map(list, ({ response, filter }) => {
      const { label } = _.find(selections, { value: filter.externalId });
      return exctractValuesToTable(response, query, label);
    });
  }
  const extra = [];
  const deepList = _.map(list, (item) => {
    const resource = {};
    _.map(item, (value, key) => {
      if (_.isArray(value)) {
        extra.push(
          convertItemsToTable(
            value,
            _.map(value[0], (v, k) => k),
            `${item.name} ${key}`
          )
        );
      } else if (_.isObject(value)) {
        _.map(value, (v, k) => _.assignIn(resource, { [`${key}-${k}`]: v }));
      } else _.assignIn(resource, { [key]: value });
    });

    return resource as Resource;
  });
  const tableData = convertItemsToTable(
    deepList,
    columns,
    !getRuns ? 'Extraction Pipelines' : name
  );
  return getRuns ? tableData : [tableData, ...extra];
};
export class ExtractionPipelinesDatasource {
  public constructor(private connector: Connector) {}
  private async getDataset(id, refId): Promise<Dataset[]> {
    try {
      const dataset = await this.connector.fetchItems<Dataset>({
        path: '/datasets/byids',
        method: HttpMethod.POST,
        data: {
          items: [{ id }],
        },
      });
      return dataset;
    } catch (error) {
      handleError(error, refId);
      return [{ name: `${id}` }];
    }
  }
  private fetchExtractionPipelinesRuns = async (
    filter: ExtractionPipelineRunsParams,
    refId: string,
    limit = 100
  ): Promise<RunsResponse> => {
    try {
      const response = await this.connector.fetchItems<ExtractionPipelineRunsResponse>({
        path: '/extpipes/runs/list',
        method: HttpMethod.POST,
        data: {
          filter,
          limit,
        },
      });
      return { filter, response };
    } catch (error) {
      handleError(error, refId);
      return {
        filter,
        response: [],
      };
    }
  };
  private fetchExtractionPipelines = async (
    items: FilterRequest<SelectableValue>,
    refId: string,
    columns: string[]
  ): Promise<ExtractionPipelinesWithRun[]> => {
    try {
      const pipelines = await this.connector.fetchItems<ExtractionPipelinesResponse>({
        path: `/extpipes/byids`,
        method: HttpMethod.POST,
        data: {
          items,
        },
      });
      return this.withLastRun(pipelines, refId, columns);
    } catch (error) {
      handleError(error, refId);
      return [];
    }
  };
  private withLastRun = async (
    items: ExtractionPipelinesResponse[],
    refId: string,
    columns: string[]
  ): Promise<ExtractionPipelinesWithRun[]> => {
    return Promise.all(
      items.map(
        async ({
          externalId,
          dataSetId,
          ...rest
        }: ExtractionPipelinesResponse): Promise<ExtractionPipelinesWithRun> => {
          let data;
          try {
            const { response } = await this.fetchExtractionPipelinesRuns(
              {
                externalId,
              },
              refId,
              1
            );
            data = {
              externalId,
              ...rest,
              status: response[0]?.status,
              message: response[0]?.message,
              runId: response[0]?.id,
            };
            if (columns.includes('data set')) {
              const dataset = await this.getDataset(dataSetId, refId);
              _.assignIn(data, { 'data set': dataset[0].name });
            }
            return data;
          } catch (error) {
            handleError(error, refId);
            return undefined;
          }
        }
      )
    );
  };
  postQuery(query: ExtractionPipelinesQuery, refId: string) {
    const { selections, getRuns, limit, columns } = query;
    if (!getRuns)
      return this.fetchExtractionPipelines(
        selections.map(({ id }) => ({ id })),
        refId,
        columns
      );
    return Promise.all(
      selections.map(({ value }) =>
        this.fetchExtractionPipelinesRuns({ externalId: value }, refId, limit)
      )
    );
  }
  async runQuery(query: ExtractionPipelinesQuery & { refId: string }) {
    const { selections, getRuns, refId, columns } = query;
    try {
      if (getRuns && !selections?.length) {
        handleError(new Error('Please select value for extraxtion pipelines runs'), refId);
        return [];
      }
      if (selections?.length) return this.postQuery(query, refId);
      const items = await this.connector.fetchItems<ExtractionPipelinesResponse>({
        path: `/extpipes/list`,
        method: HttpMethod.POST,
        data: {
          filter: {},
        },
      });
      return this.withLastRun(items, refId, columns);
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
          return exctractValuesToTable(response, target.extractionPipelinesQuery, undefined);
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
