import { DataQueryRequest, TableData, TimeSeries, DataQueryResponse } from '@grafana/data';
import _, { Many } from 'lodash';
import { getIntrospectionQuery, IntrospectionQuery } from 'graphql';
import { CogniteQuery, FDMQueryResponse, FlexibleDataModellingQuery, HttpMethod } from '../types';
import { DMSInstanceId } from '../types/dms';
import { Connector } from '../connector';
import { handleError, handleWarning } from '../appEventHandler';
import { TimeseriesDatasource } from './TimeseriesDatasource';
import { convertItemsToTable, getTimeSeriesPropertiesBatch, instanceKey } from '../cdf/client';
import { isTimeSeriesKind, TimeSeriesKind } from '../cdf/aggregates';
import { graphqlEndpointPath } from '../cdf/graphqlEndpoint';
import { readGraphqlRows } from '../cdf/graphqlRows';
import { readScalarPath } from '../cdf/instanceRef';
import { interpolateGraphqlLabel } from '../cdf/graphqlLabel';
import { graphqlSeriesRefId, TIME_SERIES_ROOT_KEY } from '../cdf/graphqlTimeSeries';
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
    td.push(fixedItemProps);
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

/**
 * Represents a time series item with its identifier and label
 */
interface TimeseriesItem {
  type: 'target' | 'instanceId';
  value: string | { space: string; externalId: string };
  label: string;
  /** The series' type, when the query selects `type`. */
  kind?: TimeSeriesKind;
  /** A state series' state set: from the row when the query selects `stateSet`, else looked up; null when it has none. */
  stateSet?: DMSInstanceId | null;
}

/** A series' type, or `unknown` when a lookup found no time series for the row. */
type SeriesKind = TimeSeriesKind | 'unknown';

const idOf = (item: TimeseriesItem) => item.value as DMSInstanceId;

/** A row's `stateSet` field: the reference, null when the row has none, undefined when not selected. */
const stateSetOf = (value: any): DMSInstanceId | null | undefined => {
  const field = value?.stateSet;
  if (field === undefined) {
    return undefined;
  }
  return typeof field?.space === 'string' && typeof field?.externalId === 'string'
    ? { space: field.space, externalId: field.externalId }
    : null;
};

/** Names the series skipped for not being of the panel's series type, at most a few of them. */
function skippedSeriesWarning(skipped: Array<{ label: string; kind: SeriesKind }>, selected: TimeSeriesKind): string {
  const shown = 5;
  const names = skipped
    .slice(0, shown)
    .map(({ label, kind }) => `${label || '(unnamed)'} (${kind === 'unknown' ? 'unknown type' : kind})`);
  const more = skipped.length > shown ? ` and ${skipped.length - shown} more` : '';
  return (
    `Skipped ${skipped.length} time series that ${skipped.length === 1 ? 'is' : 'are'} not ${selected}: ` +
    `${names.join(', ')}${more}. Pick their type under Query type, in a query of their own, to plot them.`
  );
}

export class FlexibleDataModellingDatasource {
  constructor(private connector: Connector, private timeseriesDatasource: TimeseriesDatasource) {}

  /**
   * Extracts time series identifiers from FDM response items.
   *
   * A row, or an object field of one, is a time series when the editor's schema
   * lookup vouched for it in `schemaTsKeys` (TIME_SERIES_ROOT_KEY for the rows
   * themselves, the field name for a nested one), or when its `type` names a time
   * series type (numeric, string or state). Legacy `tsKeys` still name
   * `__typename === 'TimeSeries'` objects; they never vouch on their own, since
   * `typeNameList` accepts any type.
   */
  private extractTimeseriesItems(dataItems: any[], query: FlexibleDataModellingQuery): TimeseriesItem[] {
    const items: TimeseriesItem[] = [];
    const tsKeys = query.tsKeys ?? [];
    const schemaTsKeys = query.schemaTsKeys ?? [];
    // An unset label falls back to the name, so a series is never unnamed. A
    // mistyped field renders as `:field` (see renderLabelToken), same as the
    // Time series tab, so the typo shows instead of a silent fallback.
    const labelFor = (series: unknown, row?: unknown) =>
      interpolateGraphqlLabel(query.label ?? '', series, row) ||
      readScalarPath(series, 'name') ||
      '';

    /**
     * Whether the datapoints API can serve this object. When the query selects
     * `type` and it is populated, it must be a time series type, whatever vouched
     * for the object; otherwise the schema's word is needed.
     */
    const isPlottable = (value: any, vouchedFor: boolean): boolean => {
      if (!_.isObject(value) || (value as any).space == null || (value as any).externalId == null) {
        return false;
      }
      const type = (value as any).type;
      return type == null ? vouchedFor : isTimeSeriesKind(type);
    };
    const kindOf = (value: any): TimeSeriesKind | undefined =>
      isTimeSeriesKind(value?.type) ? value.type : undefined;

    _.forEach(dataItems, (item) => {
      if (isPlottable(item, schemaTsKeys.includes(TIME_SERIES_ROOT_KEY))) {
        items.push({
          type: 'instanceId',
          value: { space: item.space, externalId: item.externalId },
          label: labelFor(item),
          kind: kindOf(item),
          stateSet: stateSetOf(item),
        });
      }

      _.forEach(item, (field, key) => {
        // A to-many relation arrives as a connection (`{ items }` / `{ edges }`) or a
        // plain list, so every object it holds is considered, not the wrapper.
        const candidates = readGraphqlRows(field)?.rows ?? [field];
        candidates.forEach((value) => {
          if (
            tsKeys.includes(key) &&
            _.isObject(value) &&
            (value as any).__typename === 'TimeSeries' &&
            (value as any).externalId
          ) {
            items.push({
              type: 'target',
              value: (value as any).externalId,
              label: labelFor(value, item),
            });
          } else if (isPlottable(value, schemaTsKeys.includes(key))) {
            items.push({
              type: 'instanceId',
              value: { space: (value as any).space, externalId: (value as any).externalId },
              label: labelFor(value, item),
              kind: kindOf(value),
              stateSet: stateSetOf(value),
            });
          }
        });
      });
    });

    return items;
  }

  /**
   * Queries time series datapoints, one request per time series.
   * Each time series gets its own request to ensure sufficient datapoints
   * and unique refIds to prevent request cancellation.
   */
  private async queryTimeseriesItems(
    items: TimeseriesItem[],
    query: FlexibleDataModellingQuery,
    options: any,
    target: any
  ): Promise<any[]> {
    // Instances: the rows alone, already returned as a table, without data points.
    if (items.length === 0 || query.queryType === 'instances') {
      return [];
    }

    // The panel plots one type of series, so its aggregation is valid for every
    // series it plots. Rows of other types are skipped and named in a warning.
    const selected = query.queryType ?? 'numeric';
    const typed = await this.withKinds(items, selected);
    const skipped = typed.filter(({ kind }) => kind !== selected);
    const plotted = typed.filter((item): item is (typeof typed)[number] & { kind: TimeSeriesKind } => item.kind === selected);
    if (skipped.length) {
      handleWarning(skippedSeriesWarning(skipped, selected), target.refId);
    }

    // Query each time series individually with unique refIds
    const queryPromises = plotted.map((item, index) => {
      const targets = item.type === 'target' ? [item.value as string] : [];
      const instanceIds = item.type === 'instanceId' ? [idOf(item)] : [];

      return this.timeseriesDatasource.query({
        ...options,
        targets: [
          {
            ...target,
            refId: graphqlSeriesRefId(target.refId, index),
            flexibleDataModellingQuery: {
              ...query,
              targets,
              instanceIds,
              labels: [item.label],
              instanceKinds: [item.kind],
              instanceStateSets: [item.kind === 'state' ? item.stateSet : undefined],
            },
          },
        ],
      });
    });

    const results = await Promise.all(queryPromises);
    return _.flatten(results.map((r) => r.data));
  }

  /**
   * Each series with its type: the one the query selected, or else the one stored
   * on the instance. Legacy series are numeric. A numeric panel takes rows without
   * a type as numeric, as it always did, without a lookup. On a state panel, state
   * rows whose query did not select `stateSet` are looked up too, for their state
   * sets. All lookups go out as one cached batch, and a failed one fails the query
   * rather than guessing numeric. A row the lookup finds no time series for is of
   * an unknown type.
   */
  private async withKinds(
    items: TimeseriesItem[],
    selected: TimeSeriesKind
  ): Promise<Array<Omit<TimeseriesItem, 'kind'> & { kind: SeriesKind }>> {
    const lookups = items.filter(
      (item) =>
        item.type === 'instanceId' &&
        selected !== 'numeric' &&
        (!item.kind || (selected === 'state' && item.kind === 'state' && item.stateSet === undefined))
    );
    if (!lookups.length) {
      return items.map((item) => ({ ...item, kind: item.kind ?? 'numeric' }));
    }
    const properties = await getTimeSeriesPropertiesBatch(this.connector, lookups.map(idOf));
    const looked = new Set(lookups);

    return items.map((item) => {
      if (!looked.has(item)) {
        return { ...item, kind: item.kind ?? 'numeric' };
      }
      const stored = properties.get(instanceKey(idOf(item)));
      const kind = item.kind ?? (isTimeSeriesKind(stored?.type) ? stored.type : 'unknown');
      return { ...item, kind, stateSet: stored?.stateSet ?? null };
    });
  }

  async listFlexibleDataModelling(refId: string): Promise<
    FDMQueryResponse<{
      space: string;
      externalId: string;
      version: string;
      name: string;
      description: string;
      graphQlDml: string;
    }>
  > {
    try {
      // Use REST API instead of GraphQL to support includeGlobal parameter
      // https://api-docs.cognite.com/20230101/tag/Data-models/operation/listDataModels
      const items = await this.connector.fetchItems<{
        space: string;
        externalId: string;
        version: string;
        name: string;
        description: string;
        isGlobal?: boolean;
      }>({
        path: '/models/datamodels',
        method: HttpMethod.GET,
        data: undefined,
        params: { limit: 1000, includeGlobal: true },
      });
      
      // Map to expected format (graphQlDml will be fetched separately when needed)
      const mappedItems = items.map((item) => ({
        space: item.space,
        externalId: item.externalId,
        version: item.version,
        name: item.name || item.externalId,
        description: item.description || '',
        graphQlDml: '', // Will be fetched when a specific model is selected
      }));
      
      return {
        listGraphQlDmlVersions: {
          items: mappedItems,
        },
      };
    } catch (error) {
      handleError(error, refId);
      return {
        listGraphQlDmlVersions: {
          items: [],
        },
      };
    }
  }
  async listVersionByExternalIdAndSpace(
    refId: string,
    space: string,
    externalId: string
  ): Promise<
    FDMQueryResponse<{
      space: string;
      externalId: string;
      version: string;
      name: string;
      description: string;
      graphQlDml: string;
    }>
  > {
    try {
      const { data } = await this.connector.fetchQuery<{
        space: string;
        externalId: string;
        version: string;
        name: string;
        description: string;
        graphQlDml: string;
      }>({
        path: '/dml/graphql',
        method: HttpMethod.POST,
        data: JSON.stringify({
          query: `
                query getDataModelVersionsById($space:String!, $externalId:String!) {
                  graphQlDmlVersionsById(space: $space, externalId: $externalId) {
                    items {
                      
              space
              externalId
              version
              name
              description
              graphQlDml
              createdTime
              lastUpdatedTime
              
                    }
                  }
                }
             `,
          variables: { space, externalId },
        }),
      });
      return data;
    } catch (error) {
      handleError(error, refId);
      return {
        graphQlDmlVersionsById: {
          items: [],
        },
      };
    }
  }
  async postQueryEdges(edges, query, options, target): Promise<Many<TimeSeries | TableData>> {
    try {
      const res = getEdgesTableData(edges);
      const nodes = _.map(edges, 'node');
      const tsItems = this.extractTimeseriesItems(nodes, query);
      const tsData = await this.queryTimeseriesItems(tsItems, target.flexibleDataModellingQuery, options, target);
      return _.concat(res, tsData);
    } catch (error) {
      handleError(error, target.refId);
      return [];
    }
  }

  async postQueryItems(items, query, options, target) {
    try {
      const res = getItemsTableData(items);
      const tsItems = this.extractTimeseriesItems(items, query);
      const tsData = await this.queryTimeseriesItems(tsItems, target.flexibleDataModellingQuery, options, target);
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
    try {
      const { data, errors } = await this.connector.fetchQuery({
        path: graphqlEndpointPath(query),
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
        const envelope = readGraphqlRows(firstResponse);
        if (envelope?.kind === 'edges') {
          return this.postQueryEdges(envelope.raw, query, options, target);
        }
        if (envelope?.kind === 'items') {
          return this.postQueryItems(envelope.raw, query, options, target);
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
  async runIntrospectionQuery(
    query: Omit<FlexibleDataModellingQuery, 'tsKeys' | 'graphQlQuery'>,
    target
  ): Promise<IntrospectionQuery | undefined> {
    try {
      const { data, errors } = await this.connector.fetchQuery({
        path: graphqlEndpointPath(query),
        method: HttpMethod.POST,
        data: JSON.stringify({ query: getIntrospectionQuery() }),
      });
      if (errors) {
        handleError(_.head(errors), target.refId);
        return undefined;
      }
      return data as unknown as IntrospectionQuery;
    } catch (error) {
      handleError(error, target.refId);
      return undefined;
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
