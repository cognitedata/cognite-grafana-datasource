import {
  DataQueryRequest,
  DataQueryResponse,
  FieldType,
  SelectableValue,
  DataFrame,
  toDataFrame,
  Field,
} from '@grafana/data';
import _ from 'lodash';
import { fetchRelationships } from '../cdf/client';
import { Connector } from '../connector';
import { CogniteQuery, HttpMethod, RelationshipsQuery } from '../types';
import { nodeField, edgeField } from '../constants';
import { handleError, handleWarning } from '../appEventHandler';
import { CogniteRelationshipResponse } from '../cdf/types';
import { getRange, addValuesToDataFrameObj } from '../utils';

type RelationshipsNodeGrap = {
  nodes: DataFrame;
  edges: DataFrame;
};
const getDifferedIds = (sourceList, targetList) =>
  _.difference(_.map(sourceList, 'targetExternalId'), targetList);

export const createRelationshipsNode = (relationshipsList, refId): RelationshipsNodeGrap => {
  const generateDetailKey = (key: string): string => ['detail__', key.trim().split(' ')].join('');

  const allMetaKeysFromSourceAndTarget = _.reduce(
    relationshipsList,
    (previousValue, currentValue) => {
      if (currentValue.source?.metadata) {
        Object.keys(currentValue.source.metadata).map((key) => previousValue.push(key));
      }
      if (currentValue.target?.metadata) {
        Object.keys(currentValue.target.metadata).map((key) => previousValue.push(key));
      }
      return _.uniq(previousValue);
    },
    []
  );
  const extendedFields = allMetaKeysFromSourceAndTarget.reduce((previousValue, currentValue) => {
    return {
      ...previousValue,
      [generateDetailKey(currentValue)]: {
        type: FieldType.string,
        config: {
          displayName: currentValue,
        },
      },
    };
  }, nodeField);
  const edges: Partial<DataFrame> = {
    name: 'edges',
    fields: Object.keys(edgeField).map((key) => ({
      ...edgeField[key],
      name: key,
      values: []
    })),
    meta: {
      preferredVisualisationType: 'nodeGraph',
    },
    refId,
  };
  const nodes: Partial<DataFrame> = {
    name: 'nodes',
    fields: Object.keys(extendedFields).map((key) => ({
      ...extendedFields[key],
      name: key,
      values: []
    })),
    meta: {
      preferredVisualisationType: 'nodeGraph',
    },
    refId,
  };
  function addValuesToFields(options) {
    const { externalId, labels, sourceExternalId, targetExternalId, source, target } = options;
    const { sourceMeta, targetMeta } = allMetaKeysFromSourceAndTarget.reduce((a, key) => {
      const selector = generateDetailKey(key);
      return {
        sourceMeta: {
          ...a.sourceMeta,
          [selector]: _.get(source, `metadata.${key}`),
        },
        targetMeta: {
          ...a.targetMeta,
          [selector]: _.get(target, `metadata.${key}`),
        },
      };
    }, {});
    addValuesToDataFrameObj(nodes, {
      id: sourceExternalId,
      title: _.get(source, 'description'),
      mainStat: _.get(source, 'name'),
      ...sourceMeta,
    });
    addValuesToDataFrameObj(nodes, {
      id: targetExternalId,
      title: _.get(target, 'description'),
      mainStat: _.get(target, 'name'),
      ...targetMeta,
    });
    addValuesToDataFrameObj(edges, {
      id: externalId,
      source: sourceExternalId,
      target: targetExternalId,
      mainStat: _.map(labels, ({ externalId }) => externalId)
        .join(', ')
        .trim(),
    });
  }
  _.map(relationshipsList, addValuesToFields);
  return {
    nodes: toDataFrame(nodes),
    edges: toDataFrame(edges),
  };
};
export class RelationshipsDatasource {
  constructor(private connector: Connector) {}

  private getRelationships(
    query: RelationshipsQuery & { refId: string },
    timeFrame
  ): Promise<CogniteRelationshipResponse[]> {
    return fetchRelationships(query, this.connector, timeFrame).catch((err: any) => {
      handleError(err, query.refId);
      return [];
    });
  }
  private async depthRelationships(
    query: RelationshipsQuery & { refId: string },
    relationshipsList: CogniteRelationshipResponse[],
    depth: number,
    sourceExternalIds: string[],
    timeFrame
  ) {
    const targetExternalIds: string[] = getDifferedIds(relationshipsList, sourceExternalIds);
    try {
      const list = await this.getRelationships(
        {
          ...query,
          sourceExternalIds: targetExternalIds,
        },
        timeFrame
      );
      if (!targetExternalIds.length) {
        handleWarning('Maximum of depth reached', query.refId);
        return relationshipsList;
      }
      if (depth > 2 && targetExternalIds.length) {
        const relist = await this.depthRelationships(
          query,
          list,
          depth - 1,
          _.concat(sourceExternalIds, targetExternalIds),
          timeFrame
        );
        return [...relationshipsList, ...list, ...relist];
      }
      return [...relationshipsList, ...list];
    } catch (error) {
      handleError(error, query.refId);
      return [];
    }
  }
  private async postQuery(query: RelationshipsQuery & { refId: string } & { timeFrame: any }) {
    const { sourceExternalIds, depth, timeFrame } = query;
    try {
      let list;
      const relationshipsList = await this.getRelationships(query, timeFrame);
      list = relationshipsList;
      if (depth > 1 && sourceExternalIds.length) {
        const relationships = await this.depthRelationships(
          query,
          relationshipsList,
          depth,
          sourceExternalIds,
          timeFrame
        );
        list = _.uniqBy(relationships, 'externalId');
      }
      return [_.map(createRelationshipsNode(list, query.refId)), [list]];
    } catch (error) {
      handleError(error, query.refId);
      return [];
    }
  }
  async query(options: DataQueryRequest<CogniteQuery>): Promise<DataQueryResponse> {
    const data = await Promise.all(
      _.map(options.targets, (target) => {
        const [min, max] = getRange(options.range);
        const timeFrame = target?.assetQuery?.relationshipsQuery?.isActiveAtTime && {
          activeAtTime: { max, min },
        };
        return this.postQuery({
          refId: target.refId,
          ...target.relationshipsQuery,
          timeFrame,
        });
      })
    );
    return {
      data: _.flattenDepth(data, 2),
    };
  }
  async getRelationshipsDropdowns(selector): Promise<SelectableValue[]> {
    const settings = {
      method: HttpMethod.POST,
      data: {
        filter: {},
        limit: 1000,
      },
    };
    try {
      const response = await this.connector.fetchItems<CogniteRelationshipResponse>({
        ...settings,
        path: `/${selector.type}/list`,
      });
      return _.sortBy(
        _.map(response, ({ name, ...rest }) => ({
          value: rest[selector.keyPropName],
          label: name.trim(),
        })),
        ['label']
      );
    } catch (error) {
      return [];
    }
  }
  getSourceExternalIds(query: RelationshipsQuery & { refId: string }): Promise<SelectableValue[]> {
    return this.getRelationships({ ...query, sourceExternalIds: [] }, []);
  }
}
