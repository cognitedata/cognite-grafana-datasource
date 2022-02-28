import { MutableDataFrame, FieldType } from '@grafana/data';
import { assignIn, map, split, join } from 'lodash';

export function nodesFrame(iterer) {
  const fields: any = {
    id: {
      type: FieldType.string,
    },
    title: {
      type: FieldType.string,
    },
    mainStat: {
      type: FieldType.string,
    },
  };
  map(iterer, (key) => {
    assignIn(fields, {
      [join(['detail__', split(key, ' ')], '')]: {
        type: FieldType.string,
        config: {
          displayName: key,
        },
      },
    });
  });

  return new MutableDataFrame({
    name: 'nodes',
    fields: Object.keys(fields).map((key) => ({
      ...fields[key],
      name: key,
    })),
    meta: {
      preferredVisualisationType: 'nodeGraph',
    },
  });
}

export function edgesFrame() {
  const fields: any = {
    id: {
      type: FieldType.string,
    },
    source: {
      type: FieldType.string,
    },
    target: {
      type: FieldType.string,
    },
    mainStat: {
      type: FieldType.string,
    },
  };

  return new MutableDataFrame({
    name: 'edges',
    fields: Object.keys(fields).map((key) => ({
      ...fields[key],
      name: key,
    })),
    meta: {
      preferredVisualisationType: 'nodeGraph',
    },
  });
}
