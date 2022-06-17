import { DataQueryRequest, DataQueryResponse, MutableDataFrame, FieldType } from '@grafana/data';
import _ from 'lodash';
import { fetchRelationships } from '../cdf/client';
import { Connector } from '../connector';
import { getRange } from '../datasource';
import {
  CogniteQuery,
  HttpMethod,
  RelationshipsQuery,
  RelationshipsSelectableValue,
} from '../types';
import { nodeField, edgeField } from '../constants';

type RelationshipsNodeGrap = { nodes: MutableDataFrame; edges: MutableDataFrame };
type RelationshipsResponse = {
  [x: string]: any;
};

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
  const edges = new MutableDataFrame({
    name: 'edges',
    fields: Object.keys(edgeField).map((key) => ({
      ...edgeField[key],
      name: key,
    })),
    meta: {
      preferredVisualisationType: 'nodeGraph',
    },
    refId,
  });
  const nodes = new MutableDataFrame({
    name: 'nodes',
    fields: Object.keys(extendedFields).map((key) => ({
      ...extendedFields[key],
      name: key,
    })),
    meta: {
      preferredVisualisationType: 'nodeGraph',
    },
    refId,
  });
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
    nodes.add({
      id: sourceExternalId,
      title: _.get(source, 'description'),
      mainStat: _.get(source, 'name'),
      ...sourceMeta,
    });
    nodes.add({
      id: targetExternalId,
      title: _.get(target, 'description'),
      mainStat: _.get(target, 'name'),
      ...targetMeta,
    });
    edges.add({
      id: externalId,
      source: sourceExternalId,
      target: targetExternalId,
      mainStat: _.map(labels, ({ externalId }) => externalId)
        .join(', ')
        .trim(),
    });
  }
  relationshipsList.map(addValuesToFields);
  return { nodes, edges };
};
export class RelationshipsDatasource {
  public constructor(private connector: Connector) {}

  private postQuery(query: RelationshipsQuery & { refId: string }, [min, max]) {
    const { labels, dataSetIds, isActiveAtTime, limit = 1000, sourceExternalIds } = query;
    const timeFrame = isActiveAtTime && { activeAtTime: { max, min } };
    return fetchRelationships(
      {
        labels,
        dataSetIds,
        sourceExternalIds,
      },
      timeFrame,
      limit,
      this.connector
    )
      .then((relationshipsList) => {
        return [
          _.map(createRelationshipsNode(relationshipsList, query.refId)),
          [relationshipsList],
        ];
      })
      .catch((err: any) => {
        if (err.data && err.data.error) {
          throw {
            message: `Relationships error: ${err.data.error.message}`,
            error: err.data.error,
          };
        }

        throw err;
      });
  }

  async query(options: DataQueryRequest<CogniteQuery>): Promise<DataQueryResponse> {
    const timeRange = getRange(options.range);
    const data = await Promise.all(
      _.map(options.targets, (target) => {
        return this.postQuery(
          {
            refId: target.refId,
            ...target.relationshipsQuery,
          },
          timeRange
        );
      })
    );
    return {
      data: _.flattenDepth(data, 2),
    };
  }

  async getRelationshipsDropdowns(selector): Promise<RelationshipsSelectableValue[]> {
    const settings = {
      method: HttpMethod.POST,
      data: {
        filter: {},
        limit: 1000,
      },
    };
    try {
      const response: RelationshipsResponse[] = await this.connector.fetchItems({
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
}
