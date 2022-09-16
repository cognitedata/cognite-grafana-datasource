import { DataQueryRequest, DataQueryResponse } from '@grafana/data';
import _ from 'lodash';
import { CogniteQuery, ExtractionPipelineQuery, HttpMethod } from '../types';
import { Connector } from '../connector';
import { handleError } from '../datasource';
import { convertItemsToTable } from '../cdf/client';

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
  async runQuery(query: ExtractionPipelineQuery & { refId: string }) {
    const { selection, getRuns, refId } = query;
    try {
      if (getRuns) {
        if (!selection.length) {
          handleError(new Error('Please select value for extraxtion pipelines runs'), refId);
          return [];
        }
        if (selection.length > 1) {
          const columns = ['index'];
          const epData = [];
          const items = await Promise.all(
            selection.map(({ value }) => this.fetchExtractionPipelinesRuns({ externalId: value }))
          );
          _.map(items, (item, index) => {
            const fixNodeProps = { index };
            _.mapValues(item, (value, key) => {
              if (_.isObject(value)) {
                _.mapKeys(value, (_, objKey) => columns.push(objKey));
                epData.push({
                  index,
                  key,
                  ...value,
                });
              }
              columns.push(!_.isObject(value) ? key : 'key');
              _.assignIn(fixNodeProps, !_.isObject(value) && { [key]: value });
            });
          });
          return convertItemsToTable(epData, _.uniq(columns));
        }
        const items = await this.connector.fetchItems({
          path: '/extpipes/runs/list',
          method: HttpMethod.POST,
          data: {
            filter: { externalId: selection[0].value },
          },
        });
        return items;
      }
      if (selection.length) {
        const items = await this.fetchExtractionPipelines(selection.map(({ id }) => ({ id })));
        return items;
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
    return {
      data: results,
    };
  }
}
