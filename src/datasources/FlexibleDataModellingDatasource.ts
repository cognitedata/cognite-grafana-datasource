import { DataQueryRequest, TableData, TimeSeries, DataQueryResponse } from '@grafana/data';
import _, { Many } from 'lodash';
import { getIntrospectionQuery, IntrospectionQuery } from 'graphql';
import { CogniteQuery, FDMQueryResponse, FlexibleDataModellingQuery, HttpMethod } from '../types';
import { Connector } from '../connector';
import { handleError } from '../appEventHandler';
import { TimeseriesDatasource } from './TimeseriesDatasource';
import { convertItemsToTable } from '../cdf/client';
import { getFirstSelection } from '../utils';

const getItemsTableData = (items): TableData => {
  const columns = ['item'];
  const td = [];
  _.map(items, (item, index) => {
    const fixedItemProps = { item: index };
    _.mapValues(item, (v, itemKey) => {
      if (_.isObject(v)) {
        _.mapKeys(v, (_, key) => columns.push(key));
        td.push({
          item: index,
          itemKey,
          ...v,
        });
      }
      columns.push(!_.isObject(v) ? itemKey : 'itemKey');
      _.assignIn(fixedItemProps, !_.isObject(v) && { [itemKey]: v });
    });
    td.push(fixedItemProps);
  });
  return convertItemsToTable(td, _.uniq(columns), 'items');
};
const getEdgesTableData = (edges): TableData => {
  const columns = ['node'];
  const td = [];
  _.map(edges, ({ node }, index) => {
    const fixNodeProps = { node: index };
    _.mapValues(node, (v, nodeKey) => {
      if (_.isObject(v)) {
        _.mapKeys(v, (_, key) => columns.push(key));
        td.push({
          node: index,
          nodeKey,
          ...v,
        });
      }
      columns.push(!_.isObject(v) ? nodeKey : 'nodeKey');
      _.assignIn(fixNodeProps, !_.isObject(v) && { [nodeKey]: v });
    });
    td.push(fixNodeProps);
  });
  return convertItemsToTable(td, _.uniq(columns), 'edges');
};
const getFirstNameValue = (arr) => arr?.name?.value;

/**
 * Represents a time series item with its identifier and label
 */
interface TimeseriesItem {
  type: 'target' | 'instanceId';
  value: string | { space: string; externalId: string };
  label: string;
}

export class FlexibleDataModellingDatasource {
  constructor(private connector: Connector, private timeseriesDatasource: TimeseriesDatasource) {}

  /**
   * Extracts time series identifiers from FDM response items.
   * Handles both legacy __typename === 'TimeSeries' and new type === 'numeric' detection.
   */
  private extractTimeseriesItems(dataItems: any[], query: FlexibleDataModellingQuery): TimeseriesItem[] {
    const items: TimeseriesItem[] = [];

    _.forEach(dataItems, (item) => {
      // Check if the item itself is a numeric time series
      if (item?.type === 'numeric' && item.space != null && item.externalId != null) {
        items.push({
          type: 'instanceId',
          value: { space: item.space, externalId: item.externalId },
          label: item.name || '',
        });
      }

      // Also check nested properties within item
      _.forEach(item, (value, key) => {
        // Legacy behavior for __typename === 'TimeSeries'
        if (
          query.tsKeys.includes(key) &&
          _.isObject(value) &&
          (value as any).__typename === 'TimeSeries' &&
          (value as any).externalId
        ) {
          items.push({
            type: 'target',
            value: (value as any).externalId,
            label: (value as any).name || '',
          });
        }
        // New detection for nested numeric time series
        else if (
          _.isObject(value) &&
          (value as any).type === 'numeric' &&
          (value as any).space != null &&
          (value as any).externalId != null
        ) {
          items.push({
            type: 'instanceId',
            value: { space: (value as any).space, externalId: (value as any).externalId },
            label: (value as any).name || '',
          });
        }
      });
    });

    return items;
  }

  /**
   * Queries time series datapoints, one request per time series.
   * Each time series gets its own request to ensure sufficient datapoints
   * and unique refIds to prevent request cancellation.
   */
  private async queryTimeseriesItems(
    items: TimeseriesItem[],
    query: FlexibleDataModellingQuery,
    options: any,
    target: any
  ): Promise<any[]> {
    if (items.length === 0) {
      return [];
    }

    // Query each time series individually with unique refIds
    const queryPromises = items.map((item, index) => {
      const targets = item.type === 'target' ? [item.value as string] : [];
      const instanceIds = item.type === 'instanceId' 
        ? [item.value as { space: string; externalId: string }] 
        : [];

      return this.timeseriesDatasource.query({
        ...options,
        targets: [
          {
            ...target,
            refId: `${target.refId}_fdm_${index}`,
            flexibleDataModellingQuery: {
              ...query,
              targets,
              instanceIds,
              labels: [item.label],
            },
          },
        ],
      });
    });

    const results = await Promise.all(queryPromises);
    return _.flatten(results.map((r) => r.data));
  }

  async listFlexibleDataModelling(refId: string): Promise<
    FDMQueryResponse<{
      space: string;
      externalId: string;
      version: string;
      name: string;
      description: string;
      graphQlDml: string;
    }>
  > {
    try {
      // Use REST API instead of GraphQL to support includeGlobal parameter
      // https://api-docs.cognite.com/20230101/tag/Data-models/operation/listDataModels
      const items = await this.connector.fetchItems<{
        space: string;
        externalId: string;
        version: string;
        name: string;
        description: string;
        isGlobal?: boolean;
      }>({
        path: '/models/datamodels',
        method: HttpMethod.GET,
        data: undefined,
        params: { limit: 1000, includeGlobal: true },
      });
      
      // Map to expected format (graphQlDml will be fetched separately when needed)
      const mappedItems = items.map((item) => ({
        space: item.space,
        externalId: item.externalId,
        version: item.version,
        name: item.name || item.externalId,
        description: item.description || '',
        graphQlDml: '', // Will be fetched when a specific model is selected
      }));
      
      return {
        listGraphQlDmlVersions: {
          items: mappedItems,
        },
      };
    } catch (error) {
      handleError(error, refId);
      return {
        listGraphQlDmlVersions: {
          items: [],
        },
      };
    }
  }
  async listVersionByExternalIdAndSpace(
    refId: string,
    space: string,
    externalId: string
  ): Promise<
    FDMQueryResponse<{
      space: string;
      externalId: string;
      version: string;
      name: string;
      description: string;
      graphQlDml: string;
    }>
  > {
    try {
      const { data } = await this.connector.fetchQuery<{
        space: string;
        externalId: string;
        version: string;
        name: string;
        description: string;
        graphQlDml: string;
      }>({
        path: '/dml/graphql',
        method: HttpMethod.POST,
        data: JSON.stringify({
          query: `
                query getDataModelVersionsById($space:String!, $externalId:String!) {
                  graphQlDmlVersionsById(space: $space, externalId: $externalId) {
                    items {
                      
              space
              externalId
              version
              name
              description
              graphQlDml
              createdTime
              lastUpdatedTime
              
                    }
                  }
                }
             `,
          variables: { space, externalId },
        }),
      });
      return data;
    } catch (error) {
      handleError(error, refId);
      return {
        graphQlDmlVersionsById: {
          items: [],
        },
      };
    }
  }
  async postQueryEdges(edges, query, options, target): Promise<Many<TimeSeries | TableData>> {
    try {
      const res = getEdgesTableData(edges);
      const nodes = _.map(edges, 'node');
      const tsItems = this.extractTimeseriesItems(nodes, query);
      const tsData = await this.queryTimeseriesItems(tsItems, target.flexibleDataModellingQuery, options, target);
      return _.concat(res, tsData);
    } catch (error) {
      handleError(error, target.refId);
      return [];
    }
  }

  async postQueryItems(items, query, options, target) {
    try {
      const res = getItemsTableData(items);
      const tsItems = this.extractTimeseriesItems(items, query);
      const tsData = await this.queryTimeseriesItems(tsItems, target.flexibleDataModellingQuery, options, target);
      return _.concat(res, tsData);
    } catch (error) {
      handleError(error, target.refId);
      return [];
    }
  }
  async runQuery(
    query: FlexibleDataModellingQuery,
    options,
    target
  ): Promise<Many<TimeSeries | TableData>> {
    try {
      const { data, errors } = await this.connector.fetchQuery({
        path: `/userapis/spaces/${query.space}/datamodels/${query.externalId}/versions/${query.version}/graphql`,
        method: HttpMethod.POST,
        data: JSON.stringify({ query: query.graphQlQuery }),
      });

      if (errors) {
        handleError(_.head(errors), target.refId);
        return [];
      }
      const firstResponse = _.get(
        data,
        getFirstNameValue(_.head(getFirstSelection(query.graphQlQuery, target.refId)))
      );
      if (firstResponse) {
        if (_.has(firstResponse, 'edges')) {
          const { edges } = firstResponse;
          return this.postQueryEdges(edges, query, options, target);
        }
        if (_.has(firstResponse, 'items')) {
          const { items } = firstResponse;
          return this.postQueryItems(items, query, options, target);
        }
        return [];
      }
      handleError(
        new Error('An error occurred while attempting to get a response from FDM!'),
        target.refId
      );
      return [];
    } catch (error) {
      handleError(error, target.refId);
      return [];
    }
  }
  async runIntrospectionQuery(
    query: Omit<FlexibleDataModellingQuery, 'tsKeys' | 'graphQlQuery'>,
    target
  ): Promise<IntrospectionQuery | undefined> {
    try {
      const { data, errors } = await this.connector.fetchQuery({
        path: `/userapis/spaces/${query.space}/datamodels/${query.externalId}/versions/${query.version}/graphql`,
        method: HttpMethod.POST,
        data: JSON.stringify({ query: getIntrospectionQuery() }),
      });
      if (errors) {
        handleError(_.head(errors), target.refId);
        return undefined;
      }
      return data as unknown as IntrospectionQuery;
    } catch (error) {
      handleError(error, target.refId);
      return undefined;
    }
  }
  async query(options: DataQueryRequest<CogniteQuery>): Promise<DataQueryResponse> {
    const response = await Promise.all(
      _.map(options.targets, (target) =>
        this.runQuery(
          {
            ...target.flexibleDataModellingQuery,
          },
          options,
          target
        )
      )
    );
    return { data: _.flatten(response) };
  }
}
