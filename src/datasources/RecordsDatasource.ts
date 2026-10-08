import { DataFrame, DataQueryError, DataQueryRequest, DataQueryResponse } from '@grafana/data';
import {
  CogniteQuery,
  defaultRecordsQuery,
  HttpMethod,
  RecordsQuery,
  Tuple,
} from '../types';
import {
  RecordsAggregateResponse,
  RecordsFilterResponse,
  StreamDefinition,
} from '../types/records';
import { Connector } from '../connector';
import { getRange } from '../utils';
import {
  buildRecordsAggregateRequest,
  buildRecordsFilterRequest,
  fetchStream,
  unmappedSortRows,
  RecordsBuildOptions,
  resolveTimeWindow,
  recordsAggregateToDataFrames,
  recordsToDataFrame,
  applyStreamConstraints,
  streamBuildOptions,
} from '../cdf/records';
import { getCogniteUnitIndex } from '../cdf/client';
import { CogniteUnit } from '../types/dms';
import { RECORDS_LIMIT_WARNING } from '../constants';
import { handleWarning } from '../appEventHandler';

/**
 * One event per query. The query editor keeps a single warning per refId, so
 * emitting several would leave only the last one visible.
 */
function warnAll(warnings: string[], refId: string) {
  if (warnings.length) {
    handleWarning(warnings.join('\n\n'), refId);
  }
}

/**
 * The most specific message CDF returned. Records surfaces errors through the query
 * response rather than through `handleError`, so this deliberately stays a bare
 * message -- no status prefix, which would read oddly inside a panel.
 */
function describeError(error: any): string {
  return (
    error?.data?.error?.message ??
    error?.data?.error ??
    error?.message ??
    String(error)
  );
}

export class RecordsDatasource {
  constructor(private connector: Connector) {}

  async query(options: DataQueryRequest<CogniteQuery>): Promise<DataQueryResponse> {
    const range = getRange(options.range);
    const results = await Promise.all(
      options.targets.map((target) =>
        this.handleTarget(target, range, options.maxDataPoints)
      )
    );
    const data = results.flatMap((result) => result.frames);
    const errors = results
      .map((result) => result.error)
      .filter((error): error is DataQueryError => !!error);

    return errors.length ? { data, errors } : { data };
  }

  private async handleTarget(
    target: CogniteQuery,
    range: Tuple<number>,
    maxDataPoints?: number
  ): Promise<{ frames: DataFrame[]; error?: DataQueryError }> {
    const { refId } = target;
    const view = target.recordsQuery?.view;
    if (!view?.streamId) {
      return { frames: [] };
    }
    // Dashboards may carry a partial recordsQuery; fill the gaps before building.
    const recordsQuery: RecordsQuery = {
      ...defaultRecordsQuery,
      ...target.recordsQuery,
    };

    // Collected across every step and emitted once at the end: the editor keeps a
    // single warning per refId, so a second event would replace the first.
    const warnings: string[] = [];
    try {
      const stream = await this.loadStream(view.streamId);
      // One instant for the whole query. `{{now}}` is resolved more than once (the
      // stream checks, the request and its warnings), and reading the clock in each
      // left them describing slightly different moments.
      const now = Date.now();
      const buildOptions = streamBuildOptions(stream, { maxDataPoints, now });
      const { query: effectiveQuery, warnings: streamWarnings } = applyStreamConstraints(
        recordsQuery,
        stream,
        range,
        buildOptions
      );
      warnings.push(...streamWarnings);

      const unitIndex = await this.loadUnitIndex();

      const frames =
        effectiveQuery.mode === 'aggregate'
          ? await this.queryAggregate(effectiveQuery, range, refId, buildOptions, warnings, unitIndex)
          : await this.queryList(effectiveQuery, range, refId, buildOptions, warnings, unitIndex);
      return { frames };
    } catch (e) {
      return { frames: [], error: { refId, message: describeError(e) } };
    } finally {
      warnAll(warnings, refId);
    }
  }

  /**
   * The unit catalog is static reference data behind a long-lived cache, and is
   * only used to prettify field units, so a failure must not fail the query.
   */
  private async loadUnitIndex(): Promise<Map<string, CogniteUnit> | undefined> {
    try {
      return await getCogniteUnitIndex(this.connector);
    } catch {
      return undefined;
    }
  }

  /** Stream metadata is advisory: a failure here must not fail the query itself. */
  private async loadStream(streamId: string): Promise<StreamDefinition | null> {
    try {
      return await fetchStream(this.connector, streamId);
    } catch {
      return null;
    }
  }

  private async queryList(
    query: RecordsQuery,
    range: Tuple<number>,
    refId: string,
    options: RecordsBuildOptions,
    warnings: string[],
    unitIndex?: Map<string, CogniteUnit>
  ): Promise<DataFrame[]> {
    warnings.push(...resolveTimeWindow(query, range, options).warnings);
    // Silently unsorted results look like the API ignoring the request; say so.
    const unmapped = unmappedSortRows(query.sort);
    if (unmapped.length) {
      warnings.push(
        `Sorting by ${unmapped.join(', ')} was skipped: the property is no longer ` +
          `mapped by this view. Re-select it under "Sort by".`
      );
    }
    const request = buildRecordsFilterRequest(query, range, options);
    const { data } = await this.connector.fetchData<{ data: RecordsFilterResponse }>({
      method: HttpMethod.POST,
      path: `/streams/${encodeURIComponent(query.view!.streamId)}/records/filter`,
      data: request
    });

    const items = data?.items ?? [];
    if (items.length >= request.limit) {
      warnings.push(RECORDS_LIMIT_WARNING);
    }
    return [recordsToDataFrame(items, data?.typing, query, refId, unitIndex)];
  }

  private async queryAggregate(
    query: RecordsQuery,
    range: Tuple<number>,
    refId: string,
    options: RecordsBuildOptions,
    warnings: string[],
    unitIndex?: Map<string, CogniteUnit>
  ): Promise<DataFrame[]> {
    const { request, warnings: buildWarnings } = buildRecordsAggregateRequest(query, range, options);
    warnings.push(...buildWarnings);

    const { data } = await this.connector.fetchData<{
      data: RecordsAggregateResponse;
    }>({
      method: HttpMethod.POST,
      path: `/streams/${encodeURIComponent(query.view!.streamId)}/records/aggregate`,
      data: request
    });

    return recordsAggregateToDataFrames(data, query, refId, unitIndex);
  }
}
