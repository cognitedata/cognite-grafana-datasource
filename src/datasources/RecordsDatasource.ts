import { DataFrame, DataQueryError, DataQueryRequest, DataQueryResponse } from '@grafana/data';
import {
  CogniteQuery,
  defaultRecordsQuery,
  HttpMethod,
  RecordsQuery,
  Tuple,
} from '../types';
import {
  RecordsFilterResponse,
  StreamDefinition,
} from '../types/records';
import { Connector } from '../connector';
import { getRange } from '../utils';
import {
  buildRecordsFilterRequest,
  fetchStream,
  parseIsoDurationMs,
  unmappedSortRows,
  RecordsBuildOptions,
  recordsToDataFrame,
} from '../cdf/records';
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

const IMMUTABLE_TIME_RANGE_WARNING =
  `This stream is immutable, so the CDF requires a time range. ` +
  `The dashboard time range was applied to lastUpdatedTime.`;

export class RecordsDatasource {
  constructor(private connector: Connector) {}

  async query(options: DataQueryRequest<CogniteQuery>): Promise<DataQueryResponse> {
    const range = getRange(options.range);
    const results = await Promise.all(
      options.targets.map((target) => this.handleTarget(target, range))
    );
    const data = results.flatMap((result) => result.frames);
    const errors = results
      .map((result) => result.error)
      .filter((error): error is DataQueryError => !!error);

    return errors.length ? { data, errors } : { data };
  }

  private async handleTarget(
    target: CogniteQuery,
    range: Tuple<number>
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
      const buildOptions: RecordsBuildOptions = {
        maxFilteringIntervalMs:
          parseIsoDurationMs(stream?.settings?.limits?.maxFilteringInterval) ??
          undefined,
      };
      const effectiveQuery = this.applyStreamConstraints(
        recordsQuery,
        stream,
        range,
        buildOptions,
        warnings
      );

      const frames = await this.queryList(effectiveQuery, range, refId, warnings);
      return { frames };
    } catch (e) {
      return { frames: [], error: { refId, message: describeError(e) } };
    } finally {
      warnAll(warnings, refId);
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

  private applyStreamConstraints(
    query: RecordsQuery,
    stream: StreamDefinition | null,
    range: Tuple<number>,
    options: RecordsBuildOptions,
    warnings: string[]
  ): RecordsQuery {
    if (!stream) {
      return query;
    }

    let effective = query;
    const immutable = stream.type === 'Immutable';
    if (immutable && query.timeFilterMode === 'none') {
      warnings.push(IMMUTABLE_TIME_RANGE_WARNING);
      effective = { ...query, timeFilterMode: 'dashboard' };
    }

    if (effective.timeFilterMode !== 'none') {
      const maxInterval = options.maxFilteringIntervalMs ?? null;
      const span = range[1] - range[0];
      if (maxInterval && span > maxInterval) {
        const days = (ms: number) => Math.round(ms / (24 * 60 * 60 * 1000));
        warnings.push(
          `The dashboard time range spans ${days(span)} days, but stream "${stream.externalId}" ` +
            `accepts at most ${days(maxInterval)} days per request. Shorten the time range.`
        );
      }
    }

    return effective;
  }

  private async queryList(
    query: RecordsQuery,
    range: Tuple<number>,
    refId: string,
    warnings: string[]
  ): Promise<DataFrame[]> {
    // Silently unsorted results look like the API ignoring the request; say so.
    const unmapped = unmappedSortRows(query.sort);
    if (unmapped.length) {
      warnings.push(
        `Sorting by ${unmapped.join(', ')} was skipped: the property is no longer ` +
          `mapped by this view. Re-select it under "Sort by".`
      );
    }
    const request = buildRecordsFilterRequest(query, range);
    const { data } = await this.connector.fetchData<{ data: RecordsFilterResponse }>({
      method: HttpMethod.POST,
      path: `/streams/${encodeURIComponent(query.view!.streamId)}/records/filter`,
      data: request
    });

    const items = data?.items ?? [];
    if (items.length >= request.limit) {
      warnings.push(RECORDS_LIMIT_WARNING);
    }
    return [recordsToDataFrame(items, data?.typing, query, refId)];
  }
}
