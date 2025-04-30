import { DataQueryRequest, DataQueryResponse, FieldType, toDataFrame, DataFrame } from '@grafana/data';
import _ from 'lodash';
import { Connector } from '../connector';
import { TemplateQuery, CogniteQuery, HttpMethod } from '../types';
import { handleError } from '../appEventHandler';
import { addValuesToDataFrameObj } from '../utils';

type QueryResult = { query: TemplateQuery & { refId: string }; results: any };

export class TemplatesDatasource {
  constructor(private connector: Connector) {}

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

  private postQuery(query: Partial<TemplateQuery & { refId: string }>, payload: string) {
    const { groupExternalId, version } = query;
    return this.connector
      .fetchData({
        path: `/templategroups/${encodeURIComponent(groupExternalId)}/versions/${version}/graphql`,
        cacheTime: '1s',
        method: HttpMethod.POST,
        data: {
          query: payload,
        },
      })
      .then((results: any) => {
        return { query, results };
      })
      .catch((err: any) => {
        handleError(err, query.refId);
        return [];
      });
  }

  private runQuery(query: TemplateQuery & { refId: string }) {
    return this.postQuery(query, query.graphQlQuery) as Promise<QueryResult>;
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
        return this.runQuery({ refId: target.refId, ...target.templateQuery });
      })
    );

    const dataframes = results.flatMap((res) => {
      const { dataPath } = res.query;
      const { groupBy, datapointsPath, refId } = res.query;
      const datapointsPathArray = TemplatesDatasource.fromMultiStringToArray(datapointsPath);
      const groupByArray = TemplatesDatasource.fromMultiStringToArray(groupBy);

      const items: any[] = TemplatesDatasource.getItems(res.results.data, dataPath.trim());

      const dataFrameMap = new Map<string, Partial<DataFrame>>();
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
            dataFrame = TemplatesDatasource.createDatapointsDataFrameObj(refId, groupString);
            dataFrameMap.set(groupString, dataFrame);
          }

          const datapoints =
            TemplatesDatasource.getDataFromPathInObject(item, datapointsPath) ?? [];
          datapoints.forEach((datapoint) => addValuesToDataFrameObj(dataFrame, datapoint));
        });
      });

      return Array.from(dataFrameMap.values()).map(toDataFrame);
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

  static createDatapointsDataFrameObj(refId: string, name: string): Partial<DataFrame> {
    return {
      refId,
      name,
      fields: [
        {
          name: 'timestamp',
          type: FieldType.time,
          config: {},
          values: [],
        },
        {
          name: 'value',
          type: FieldType.number,
          config: {
            displayName: name,
          },
          values: [],
        },
      ],
    };
  }
}
