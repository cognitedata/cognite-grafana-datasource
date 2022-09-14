import { DataQueryRequest, TableData, TimeSeries, DataQueryResponse } from '@grafana/data';
import _, { Many } from 'lodash';
import { CogniteQuery, FlexibleDataModellingQuery, HttpMethod } from '../types';
import { Connector } from '../connector';
import { handleError } from '../appEventHandler';
import { TimeseriesDatasource } from './TimeseriesDatasource';
import { convertItemsToTable } from '../cdf/client';

const getData = (edges): TableData => {
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
  return convertItemsToTable(td, _.uniq(columns));
};

export class FlexibleDataModellingDatasource {
  public constructor(
    private connector: Connector,
    private timeseriesDatasource: TimeseriesDatasource
  ) {}

  async listFlexibleDataModelling(): Promise<any> {
    return this.connector.fetchQuery(
      {
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
      },
      'listApis'
    );
  }
  async postQuery(edges, query, options, target): Promise<Many<TimeSeries | TableData>> {
    try {
      let tsData = [];
      const res = getData(edges);
      if (query.tsKeys.length) {
        const labels = [];
        const targets = _.flatten(
          _.map(edges, ({ node }) => _.filter(node, (_, key) => query.tsKeys.includes(key)))
        ).map(({ externalId, name }) => {
          if (name) labels.push(name);
          return externalId;
        });
        const { data } = await this.timeseriesDatasource.query({
          ...options,
          targets: [
            {
              ...target,
              targetRefType: 'FDMexternalId',
              targets,
              labels,
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
    const first = query.graphQlQuery.split('{')[1].trim();
    try {
      const { edges } = await this.connector.fetchQuery(
        {
          path: `/schema/api/${query.externalId}/${query.version}/graphql`,
          method: HttpMethod.POST,
          data: `{"query": "${query.graphQlQuery}"}`,
        },
        first
      );
      return this.postQuery(edges, query, options, target);
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
