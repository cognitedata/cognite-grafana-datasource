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
      if (query.tsKeys.length) {
        const labels = [];
        const targets = _.map(
          _.filter(
            _.flatten(
              _.map(edges, ({ node }) =>
                _.filter(node, (value, key) => {
                  const typename = '__typename';
                  if (_.has(value, typename) && value[typename] === 'TimeSeries') {
                    if (_.has(value, 'name')) {
                      labels.push(value.name);
                    }
                    return query.tsKeys.includes(key) && _.has(value, 'externalId');
                  }
                  return false;
                })
              )
            )
          ),
          'externalId'
        );
        const { data } = await this.timeseriesDatasource.query({
          ...options,
          targets: [
            {
              ...target,
              flexibleDataModellingQuery: {
                ...target.flexibleDataModellingQuery,
                targets,
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
      if (query.tsKeys.length) {
        const labels = [];
        const targets = _.map(
          _.filter(
            _.flatten(
              _.map(items, (item) =>
                _.filter(item, (value, key) => {
                  const typename = '__typename';
                  if (_.has(value, typename) && value[typename] === 'TimeSeries') {
                    if (_.has(value, 'name')) {
                      labels.push(value.name);
                    }
                    return query.tsKeys.includes(key) && _.has(value, 'externalId');
                  }
                  return false;
                })
              )
            )
          ),
          'externalId'
        );
        const { data } = await this.timeseriesDatasource.query({
          ...options,
          targets: [
            {
              ...target,
              flexibleDataModellingQuery: {
                ...target.flexibleDataModellingQuery,
                targets,
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
