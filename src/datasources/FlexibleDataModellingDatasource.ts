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
export class FlexibleDataModellingDatasource {
  constructor(private connector: Connector, private timeseriesDatasource: TimeseriesDatasource) {}

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
      let tsData = [];
      const res = getEdgesTableData(edges);
      const labels = [];
      const targets: string[] = [];
      const instanceIds: Array<{ space: string; externalId: string }> = [];

      _.forEach(edges, ({ node }) => {
        // Check if the node itself is a numeric time series (type === 'numeric' at node level)
        if (
          _.has(node, 'type') &&
          node.type === 'numeric' &&
          _.has(node, 'space') &&
          _.has(node, 'externalId') &&
          node.space != null &&
          node.externalId != null
        ) {
          if (_.has(node, 'name')) {
            labels.push(node.name);
          }
          instanceIds.push({ space: node.space, externalId: node.externalId });
        }

        // Also check nested properties within node
        _.forEach(node, (value, key) => {
          const typename = '__typename';
          // Check for __typename === 'TimeSeries' (legacy behavior - requires tsKeys)
          if (
            query.tsKeys.includes(key) &&
            _.has(value, typename) &&
            value[typename] === 'TimeSeries'
          ) {
            if (_.has(value, 'name')) {
              labels.push(value.name);
            }
            if (_.has(value, 'externalId')) {
              targets.push(value.externalId);
            }
          }
          // Check for type === 'numeric' with space and externalId in nested properties
          else if (
            _.isObject(value) &&
            _.has(value, 'type') &&
            (value as any).type === 'numeric' &&
            _.has(value, 'space') &&
            _.has(value, 'externalId') &&
            (value as any).space != null &&
            (value as any).externalId != null
          ) {
            if (_.has(value, 'name')) {
              labels.push((value as any).name);
            }
            instanceIds.push({ space: (value as any).space, externalId: (value as any).externalId });
          }
        });
      });

      if (targets.length > 0 || instanceIds.length > 0) {
        const { data } = await this.timeseriesDatasource.query({
          ...options,
          targets: [
            {
              ...target,
              flexibleDataModellingQuery: {
                ...target.flexibleDataModellingQuery,
                targets,
                instanceIds,
                labels,
              },
            },
          ],
        });
        tsData = data;
      }
      return _.concat(res, tsData);
    } catch (error) {
      handleError(error, target.refId);
      return [];
    }
  }
  async postQueryItems(items, query, options, target) {
    try {
      let tsData = [];
      const res = getItemsTableData(items);
      const labels = [];
      const targets: string[] = [];
      const instanceIds: Array<{ space: string; externalId: string }> = [];

      _.forEach(items, (item) => {
        // Check if the item itself is a numeric time series (type === 'numeric' at item level)
        if (
          _.has(item, 'type') &&
          item.type === 'numeric' &&
          _.has(item, 'space') &&
          _.has(item, 'externalId') &&
          item.space != null &&
          item.externalId != null
        ) {
          if (_.has(item, 'name')) {
            labels.push(item.name);
          }
          instanceIds.push({ space: item.space, externalId: item.externalId });
        }

        // Also check nested properties within item
        _.forEach(item, (value, key) => {
          const typename = '__typename';
          // Check for __typename === 'TimeSeries' (legacy behavior - requires tsKeys)
          if (
            query.tsKeys.includes(key) &&
            _.has(value, typename) &&
            value[typename] === 'TimeSeries'
          ) {
            if (_.has(value, 'name')) {
              labels.push(value.name);
            }
            if (_.has(value, 'externalId')) {
              targets.push(value.externalId);
            }
          }
          // Check for type === 'numeric' with space and externalId in nested properties
          else if (
            _.isObject(value) &&
            _.has(value, 'type') &&
            (value as any).type === 'numeric' &&
            _.has(value, 'space') &&
            _.has(value, 'externalId') &&
            (value as any).space != null &&
            (value as any).externalId != null
          ) {
            if (_.has(value, 'name')) {
              labels.push((value as any).name);
            }
            instanceIds.push({ space: (value as any).space, externalId: (value as any).externalId });
          }
        });
      });

      if (targets.length > 0 || instanceIds.length > 0) {
        const { data } = await this.timeseriesDatasource.query({
          ...options,
          targets: [
            {
              ...target,
              flexibleDataModellingQuery: {
                ...target.flexibleDataModellingQuery,
                targets,
                instanceIds,
                labels,
              },
            },
          ],
        });
        tsData = data;
      }
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
