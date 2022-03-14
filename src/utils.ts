import { isNil, omitBy, get, map, assign, isEmpty } from 'lodash';
import { stringify } from 'query-string';
import ms from 'ms';
import { MutableDataFrame, FieldType } from '@grafana/data';
import { CogniteRelationshipResponse } from './cdf/types';
import { QueryOptions, QueryTarget } from './types';
import { FilterTypes, ParsedFilter } from './parser/types';

export function getQueryString(obj: any) {
  return stringify(omitBy(obj, isNil));
}

export function toGranularityWithLowerBound(milliseconds: number, lowerBound = 1000): string {
  return ms(Math.max(milliseconds, lowerBound));
}

// used for generating the options.requestId
export function getRequestId(options: QueryOptions, target: QueryTarget) {
  return `${options.dashboardId}_${options.panelId}_${target.refId}`;
}

export const applyFilters = <T>(objs: T[], filters: ParsedFilter[]): T[] => {
  if (!filters.length) {
    return objs;
  }

  return objs.filter((obj) => filters.every((filter) => checkFilter(obj, filter)));
};

export const checkFilter = <T>(obj: T, { path, filter, value }: ParsedFilter): boolean => {
  const valueToFilter = get(obj, path, null);
  const regex = new RegExp(`^${value}$`);

  switch (filter) {
    case FilterTypes.RegexEquals:
      return regex.test(valueToFilter);
    case FilterTypes.RegexNotEquals:
      return !regex.test(valueToFilter);
    case FilterTypes.NotEquals:
      return value !== valueToFilter;
    default:
      return false;
  }
};

const getMetaKeys = (list) => {
  const metas = [];
  const setMeta = (object) => {
    Object.keys(object).map((key) => {
      if (!metas.includes(key)) {
        metas.push(key);
      }
      return key;
    });
  };
  const getItemMeta = (item) => {
    if (item.source) {
      setMeta(item.source);
    } else if (item.target) {
      setMeta(item.target);
    }
  };
  list.map(getItemMeta);
  return metas;
};
const nodesFrame = (iterer, refId) => {
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

  const extendedFields = iterer.reduce((previousValue, currentValue) => {
    return {
      ...previousValue,
      [['detail__', currentValue.split(' ')].join('')]: {
        type: FieldType.string,
        config: {
          displayName: currentValue,
        },
      },
    };
  }, fields);
  return new MutableDataFrame({
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
};
const edgesFrame = (refId) => {
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
    refId,
  });
};
const metaFieldsValues = (source, target, iterrer) => {
  const sourceMeta = {};
  const targetMeta = {};
  map(iterrer, (key) => {
    const selector = ['detail__', key.split(' ')].join('');
    assign(sourceMeta, {
      [selector]: get(source, `metadata.${key}`),
    });
    assign(targetMeta, {
      [selector]: get(target, `metadata.${key}`),
    });
  });
  return { sourceMeta, targetMeta };
};
export const generateNodesAndEdges = (
  realtionshipsList: CogniteRelationshipResponse[],
  refId: any
) => {
  const iterrer = getMetaKeys(realtionshipsList);
  const nodes = nodesFrame(iterrer, refId);
  const edges = edgesFrame(refId);
  map(
    realtionshipsList,
    ({ externalId, labels, sourceExternalId, targetExternalId, source, target }) => {
      const { sourceMeta, targetMeta } = metaFieldsValues(source, target, iterrer);
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
        mainStat: map(labels, 'externalId').join(' ').trim(),
      });
    }
  );

  return [nodes, edges];
};
export const relationshipsFilters = (labels, datasets) => {
  if (!isEmpty(labels.containsAll) || !isEmpty(datasets)) {
    if (isEmpty(labels.containsAll)) {
      return {
        datasets,
      };
    }
    if (isEmpty(datasets)) {
      return {
        labels,
      };
    }
    return {
      labels,
      datasets,
    };
  }
  return {};
};
