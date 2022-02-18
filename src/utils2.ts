import { MutableDataFrame, FieldType, ArrayVector } from '@grafana/data';
import { NodeGraphDataFrameFieldNames } from '@grafana/ui';
import { map } from 'lodash';

export function nodesFrame(iterer) {
  const fields: any = {
    [NodeGraphDataFrameFieldNames.id]: {
      values: new ArrayVector(),
      type: FieldType.string,
    },
    [NodeGraphDataFrameFieldNames.title]: {
      values: new ArrayVector(),
      type: FieldType.string,
    },
    [NodeGraphDataFrameFieldNames.mainStat]: {
      values: new ArrayVector(),
      type: FieldType.string,
    },
    ...map(iterer, (key) => ({
      [`${NodeGraphDataFrameFieldNames.detail}${key}`]: {
        values: new ArrayVector(),
        type: FieldType.other,
      },
      config: {
        displayName: key,
      },
    })),
  };

  return new MutableDataFrame({
    name: 'nodes',
    fields: Object.keys(fields).map((key) => ({
      ...fields[key],
      name: key,
    })),
  });
}

export function edgesFrame() {
  const fields: any = {
    [NodeGraphDataFrameFieldNames.id]: {
      values: new ArrayVector(),
      type: FieldType.string,
    },
    [NodeGraphDataFrameFieldNames.source]: {
      values: new ArrayVector(),
      type: FieldType.string,
    },
    [NodeGraphDataFrameFieldNames.target]: {
      values: new ArrayVector(),
      type: FieldType.string,
    },
    [NodeGraphDataFrameFieldNames.mainStat]: {
      values: new ArrayVector(),
      type: FieldType.string,
    },
  };

  return new MutableDataFrame({
    name: 'edges',
    fields: Object.keys(fields).map((key) => ({
      ...fields[key],
      name: key,
    })),
  });
}
