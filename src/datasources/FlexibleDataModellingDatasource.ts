import { DataQueryRequest, TableData, TimeSeries, DataQueryResponse } from '@grafana/data';
import _, { Many } from 'lodash';
import {
  CogniteQuery,
  FDMQueryResponse,
  FDMResponse,
  FlexibleDataModellingQuery,
  HttpMethod,
} from '../types';
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
  public constructor(
    private connector: Connector,
    private timeseriesDatasource: TimeseriesDatasource
  ) {}

  async listFlexibleDataModelling(refId: string): Promise<FDMQueryResponse> {
    try {
      const { data } = await this.connector.fetchQuery<FDMResponse>({
        path: '/schema/graphql',
        method: HttpMethod.POST,
        data: `{
             "query": "query {
               listApis {
                 edges {
                   node {
                     externalId
                     name
                     description
                     createdTime
                     versions {
                       version
                       createdTime
                     }
                   }
                 }
               }
             }"
           }`,
      });
      return data;
    } catch (error) {
      handleError(error, refId);
      return {
        listApis: {
          edges: [],
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
                  if (_.has(value, 'name')) labels.push(value.name);
                  return query.tsKeys.includes(key) && _.has(value, 'externalId');
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
      const res = getItemsTableData(items);
      if (query.tsKeys.length) {
        const labels = [];
        const targets = _.map(_.filter(_.map(items, (item) => item)), 'externalId');
      }
      console.log(items, query, options, target, this);
      return _.concat(res);
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
        path: `/schema/api/${query.externalId}/${query.version}/graphql`,
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
