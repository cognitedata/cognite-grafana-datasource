import {
  DataQueryRequest,
  DataQueryResponse,
  ScopedVars,
  MutableDataFrame,
  FieldType,
} from '@grafana/data';

import { TemplateSrv } from '@grafana/runtime';
import _ from 'lodash';
import { Connector } from '../connector';
import { TemplateQuery, CogniteQuery, HttpMethod } from '../types';

type QueryResult = { query: TemplateQuery & { refId: string }; results: any };

export class TemplatesDatasource {
  public constructor(private templateSrv: TemplateSrv, private connector: Connector) {}

  cachedTemplateGroups = [];

  async listTemplatesGroups() {
    if (this.cachedTemplateGroups.length) {
      return this.cachedTemplateGroups;
    }

    return this.connector
      .fetchItems({
        path: '/templategroups/list',
        method: HttpMethod.POST,
        data: {},
      })
      .then((res) => {
        this.cachedTemplateGroups = res;
        return this.cachedTemplateGroups;
      });
  }

  async listTemplateGroupVersions(externalId: string) {
    return this.connector.fetchItems<{ version: number }>({
      path: `/templategroups/${encodeURIComponent(externalId)}/versions/list`,
      method: HttpMethod.POST,
      data: {},
    });
  }

  private postQuery(query: Partial<TemplateQuery>, payload: string) {
    const { groupExternalId, version } = query;
    const q = payload.replace(/[\n]+/gm, '');
    console.log(q);
    return this.connector
      .fetchData({
        path: `/templategroups/${encodeURIComponent(groupExternalId)}/versions/${version}/graphql`,
        cacheTime: '1s',
        method: HttpMethod.POST,
        data: {
          query: q,
        },
      })
      .then((results: any) => {
        return { query, results };
      })
      .catch((err: any) => {
        if (err.data && err.data.error) {
          throw {
            message: `GraphQL error: ${err.data.error.message}`,
            error: err.data.error,
          };
        }

        throw err;
      });
  }

  private runQuery(
    query: TemplateQuery & { refId: string },
    scopedVars: ScopedVars | undefined = undefined
  ) {
    let payload = query.graphQlQuery;
    payload = this.templateSrv.replace(payload, scopedVars);
    return this.postQuery(query, payload) as Promise<QueryResult>;
  }

  private static getItems(resultsData: any, dataPath: string): any[] {
    if (!resultsData) {
      throw 'resultsData was null or undefined';
    }

    const data = TemplatesDatasource.getDataFromPathInObject(resultsData.data, dataPath);

    if (!data) {
      const { errors } = resultsData;
      if (errors && errors.length !== 0) {
        throw errors[0];
      }
      throw `Your data path did not exist! Data Path: '${dataPath}''`;
    }

    if (resultsData.errors) {
      // There can still be errors even if there is data
      // eslint-disable-next-line no-console
      console.log('Got GraphQL errors:', resultsData.error);
    }

    return Array.isArray(data) ? data : [data];
  }

  private static fromMultiStringToArray(multiString: string): string[] {
    const identifierArray: string[] = multiString.split(',').map((str) => str.trim());
    return identifierArray;
  }

  static formatGroupByIdentifiers(groupByValues: string[][]) {
    return groupByValues.length > 1
      ? `(${groupByValues
          .map((groupByValue) => `${groupByValue[0]}: ${groupByValue[1]}`)
          .join(', ')})`
      : groupByValues[0][1];
  }

  async query(options: DataQueryRequest<CogniteQuery>): Promise<DataQueryResponse> {
    const results = await Promise.all(
      options.targets.map((target) => {
        return this.runQuery({ refId: target.refId, ...target.templateQuery }, options.scopedVars);
      })
    );

    const dataframes = results.flatMap((res) => {
      const { dataPath } = res.query;
      const { groupBy, datapointsPath, refId } = res.query;
      const datapointsPathArray = TemplatesDatasource.fromMultiStringToArray(datapointsPath);
      const groupByArray = TemplatesDatasource.fromMultiStringToArray(groupBy);

      const items: any[] = TemplatesDatasource.getItems(res.results.data, dataPath.trim());

      const dataFrameMap = new Map<string, MutableDataFrame>();
      items.forEach((item) => {
        const groupByValues = groupByArray.map((groupByKey) => [
          groupByKey,
          TemplatesDatasource.getDataFromPathInObject(item, groupByKey),
        ]);
        const groupByPrefix = TemplatesDatasource.formatGroupByIdentifiers(groupByValues);

        datapointsPathArray.forEach((datapointsPath) => {
          const groupString =
            datapointsPathArray.length > 1 ? `${groupByPrefix}:${datapointsPath}` : groupByPrefix;
          let dataFrame = dataFrameMap.get(groupString);
          if (!dataFrame) {
            dataFrame = TemplatesDatasource.createDatapointsDataFrame(refId, groupString);
            dataFrameMap.set(groupString, dataFrame);
          }

          const datapoints =
            TemplatesDatasource.getDataFromPathInObject(item, datapointsPath) ?? [];
          datapoints.forEach((datapoint) => dataFrame.add(datapoint));
        });
      });

      return Array.from(dataFrameMap.values());
    });

    return { data: dataframes };
  }

  static getDataFromPathInObject(obj: any, path: string) {
    return path.split('.').reduce((d: any, p: string) => {
      if (!d) {
        return null;
      }
      return d[p];
    }, obj);
  }

  static createDatapointsDataFrame(refId: string, name: string) {
    return new MutableDataFrame({
      refId,
      name,
      fields: [
        {
          name: 'timestamp',
          type: FieldType.time,
        },
        {
          name: 'value',
          type: FieldType.number,
          config: {
            displayName: name,
          },
        },
      ],
    });
  }
}
