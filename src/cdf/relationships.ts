import { MutableDataFrame, FieldType } from '@grafana/data';
import { get, reduce, uniq } from 'lodash';
import { nodeField, edgeField } from '../constants';

export const createRelationshipsNode = (relationshipsList, refId): Promise<MutableDataFrame[]> => {
  const generateDetailKey = (key: string): string => ['detail__', key.trim().split(' ')].join('');

  const allMetaKeysFromSourceAndTarget = reduce(
    relationshipsList,
    (previousValue, currentValue) => {
      if (currentValue.source?.metadata) {
        Object.keys(currentValue.source.metadata).map((key) => previousValue.push(key));
      }
      if (currentValue.target?.metadata) {
        Object.keys(currentValue.target.metadata).map((key) => previousValue.push(key));
      }
      return uniq(previousValue);
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
  return relationshipsList.map(
    ({ externalId, labels, sourceExternalId, targetExternalId, source, target }) => {
      const { sourceMeta, targetMeta } = allMetaKeysFromSourceAndTarget.reduce((a, key) => {
        const selector = generateDetailKey(key);
        return {
          sourceMeta: {
            ...a.sourceMeta,
            [selector]: get(source, `metadata.${key}`),
          },
          targetMeta: {
            ...a.targetMeta,
            [selector]: get(target, `metadata.${key}`),
          },
        };
      }, {});
      nodes.add({
        id: sourceExternalId,
        title: get(source, 'description'),
        mainStat: get(source, 'name'),
        ...sourceMeta,
      });
      nodes.add({
        id: targetExternalId,
        title: get(target, 'description'),
        mainStat: get(target, 'name'),
        ...targetMeta,
      });
      edges.add({
        id: externalId,
        source: sourceExternalId,
        target: targetExternalId,
        mainStat: labels
          .map(({ externalId }) => externalId)
          .join(', ')
          .trim(),
      });
      return [nodes, edges];
    }
  )[relationshipsList.length - 1];
};
