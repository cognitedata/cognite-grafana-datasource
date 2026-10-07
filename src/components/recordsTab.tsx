import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { EditorRow, EditorRows, FlexItem } from '@grafana/plugin-ui';
import { Stack } from '@grafana/ui';
import { SelectableValue, TimeRange } from '@grafana/data';
import {
  RecordsFilterRow,
  RecordsQuery,
  RecordsSortRow,
  RecordsTimeFilterMode,
  SelectedProps,
  defaultRecordsQuery,
} from '../types';
import { RecordViewDefinition, StreamDefinition } from '../types/records';
import {
  buildRequestPreviewParts,
  computeAutoInterval,
  fetchRecordViews,
  fetchStream,
  isTopLevelProperty,
  parseIsoDurationMs,
} from '../cdf/records';
import { Connector } from '../connector';
import { encodeViewRef } from './common/ViewPicker';
import { propertyOptions, propertyTypeOf, viewLabel } from './records/shared';
import { RecordsQueryHeader } from './records/RecordsQueryHeader';
import { TimeWindowEditor } from './records/TimeWindowEditor';
import { FilterList } from './records/FilterList';
import { SortEditor } from './records/SortEditor';
import { ListOptionsEditor } from './records/ListOptionsEditor';
import { BucketList } from './records/BucketList';
import { MetricList } from './records/MetricList';
import { ResultShapeBadge } from './records/ResultShapeBadge';
import { RequestPreview } from './records/RequestPreview';

interface RecordsTabProps extends SelectedProps {
  connector: Connector;
  range?: TimeRange;
  /**
   * Fills in dashboard variables as the datasource does, so the request preview is
   * the body sent to CDF.
   */
  interpolate?: (query: RecordsQuery) => RecordsQuery;
  /** Panel resolution target, used to resolve the "auto" bucket interval. */
  maxDataPoints?: number;
}

export const RecordsTab: React.FC<RecordsTabProps> = ({
  query,
  onQueryChange,
  connector,
  range,
  interpolate = (recordsQuery) => recordsQuery,
  maxDataPoints,
}) => {
  // `defaults()` in the query editor merges only the top level, so a dashboard
  // saved with a partial recordsQuery would otherwise reach the lists as undefined.
  const recordsQuery: RecordsQuery = useMemo(
    () => ({ ...defaultRecordsQuery, ...query.recordsQuery }),
    [query.recordsQuery]
  );
  const { view, mode } = recordsQuery;

  const [viewDefs, setViewDefs] = useState<RecordViewDefinition[]>([]);
  const [loadingViews, setLoadingViews] = useState(false);
  const [stream, setStream] = useState<StreamDefinition | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingViews(true);
    fetchRecordViews(connector)
      .then((views) => {
        if (!cancelled) {
          setViewDefs(views ?? []);
        }
      })
      .catch((error) => {
        console.warn('Failed to load record views', error);
        if (!cancelled) {
          setViewDefs([]);
        }
      })
      .finally(() => !cancelled && setLoadingViews(false));
    return () => {
      cancelled = true;
    };
  }, [connector]);

  useEffect(() => {
    let cancelled = false;
    if (!view?.streamId) {
      setStream(null);
      return undefined;
    }
    fetchStream(connector, view.streamId)
      .then((result) => !cancelled && setStream(result))
      .catch(() => !cancelled && setStream(null));
    return () => {
      cancelled = true;
    };
  }, [connector, view?.streamId]);

  const viewDef = useMemo(
    () =>
      viewDefs.find(
        (candidate) =>
          candidate.space === view?.space &&
          candidate.externalId === view?.externalId &&
          candidate.version === view?.version
      ) ?? null,
    [viewDefs, view]
  );

  const patchQuery = useCallback(
    (partial: Partial<RecordsQuery>) => {
      onQueryChange({ recordsQuery: { ...recordsQuery, ...partial } });
    },
    [onQueryChange, recordsQuery]
  );

  const viewOptions: Array<SelectableValue<string>> = viewDefs.map((candidate) => ({
    label: viewLabel(candidate),
    value: encodeViewRef(candidate),
    description: candidate.streamId?.[0]
      ? `Stream: ${candidate.streamId[0]}`
      : 'No stream bound to this view',
  }));

  const selectedViewValue = view ? encodeViewRef(view) : null;

  const onViewChange = (value: string) => {
    const next = viewDefs.find((candidate) => encodeViewRef(candidate) === value);
    if (!next) {
      return;
    }
    const viewProperties = new Set(Object.keys(next.properties ?? {}));
    // Drop anything referencing properties the new view does not expose, so the
    // request can never carry a path this view cannot resolve. Top-level record
    // properties are not part of any view, so they always survive the switch.
    const known = (property?: string) =>
      !!property && (viewProperties.has(property) || isTopLevelProperty(property));

    // A surviving row still describes the *old* view. Its cached type and container
    // mapping are re-resolved here: a name that means `enum` in one view and `int64`
    // in another would otherwise be coerced by the stale type, and a sort row would
    // name a container the new view does not map.
    const retype = (row: RecordsFilterRow): RecordsFilterRow => {
      const nextType = propertyTypeOf(next, row.property);
      if (nextType === row.propertyType) {
        return row;
      }
      return {
        ...row,
        propertyType: nextType,
        value: undefined,
        values: undefined,
        gte: undefined,
        lte: undefined,
      };
    };
    const remap = (row: RecordsSortRow): RecordsSortRow => {
      const mapped = next.properties?.[row.property];
      return {
        ...row,
        containerSpace: mapped?.container?.space,
        containerExternalId: mapped?.container?.externalId,
        containerPropertyIdentifier: mapped?.containerPropertyIdentifier,
      };
    };

    patchQuery({
      view: {
        space: next.space,
        externalId: next.externalId,
        version: next.version,
        streamId: next.streamId?.[0] ?? '',
      },
      filters: recordsQuery.filters.filter((row) => known(row.property)).map(retype),
      sort: recordsQuery.sort.filter((row) => known(row.property)).map(remap),
      columns: recordsQuery.columns.filter((column) => known(column)),
      buckets: recordsQuery.buckets.filter((bucket) => known(bucket.property)),
      metrics: recordsQuery.metrics.filter(
        (metric) => !metric.property || known(metric.property)
      ),
    });
  };

  const isImmutable = stream?.type === 'Immutable';
  const maxInterval = stream?.settings?.limits?.maxFilteringInterval;
  const maxFilteringIntervalMs = parseIsoDurationMs(maxInterval) ?? undefined;
  const timeFilterMode = recordsQuery.timeFilterMode ?? 'dashboard';

  // "No filter" is not offered on immutable streams: the API rejects it outright.
  const timeFilterOptions: Array<SelectableValue<RecordsTimeFilterMode>> = [
    { label: 'Dashboard range', value: 'dashboard' },
    ...(isImmutable ? [] : [{ label: 'None', value: 'none' as const }]),
  ];

  const rangeExceedsLimit = useMemo(() => {
    if (!maxFilteringIntervalMs || timeFilterMode === 'none' || !range) {
      return false;
    }
    return range.to.valueOf() - range.from.valueOf() > maxFilteringIntervalMs;
  }, [maxFilteringIntervalMs, timeFilterMode, range]);

  const timeRange: [number, number] | null = useMemo(
    () => (range ? [range.from.valueOf(), range.to.valueOf()] : null),
    [range]
  );

  // Mirrors what the datasource will send, so the editor shows the real value.
  const autoInterval = useMemo(
    () => computeAutoInterval(timeRange ? timeRange[1] - timeRange[0] : 0, maxDataPoints),
    [timeRange, maxDataPoints]
  );

  const previewParts = useMemo(
    () =>
      buildRequestPreviewParts(
        interpolate(recordsQuery),
        timeRange,
        {
          maxDataPoints,
          project: connector.projectName,
        },
        stream
      ),
    [recordsQuery, timeRange, maxDataPoints, connector, stream, interpolate]
  );

  // Top-level record properties are selectable here even though they never reach
  // `sources[].properties` -- the API returns them on every record, so the choice is
  // purely about which fields the frame carries.
  const columnOptions = propertyOptions(viewDef);

  return (
    <EditorRows>
      <EditorRow>
        <RecordsQueryHeader
          mode={mode}
          view={view}
          viewOptions={viewOptions}
          selectedViewValue={selectedViewValue}
          loadingViews={loadingViews}
          stream={stream}
          maxInterval={maxInterval}
          onModeChange={(value) => patchQuery({ mode: value })}
          onViewChange={onViewChange}
          preview={
            previewParts && (
              <RequestPreview
                parts={previewParts}
                isOpen={previewOpen}
                onToggle={() => setPreviewOpen(!previewOpen)}
              />
            )
          }
        />
      </EditorRow>

      <EditorRow>
        <TimeWindowEditor
          timeFilterMode={timeFilterMode}
          timeFilterOptions={timeFilterOptions}
          isImmutable={isImmutable}
          rangeExceedsLimit={rangeExceedsLimit}
          maxInterval={maxInterval}
          onChange={patchQuery}
        />
      </EditorRow>

      <EditorRow>
        <FilterList
          filters={recordsQuery.filters}
          viewDef={viewDef}
          connector={connector}
          onChange={(filters) => patchQuery({ filters })}
        />
      </EditorRow>

      {mode === 'list' ? (
        <EditorRow>
          <SortEditor
            sort={recordsQuery.sort}
            viewDef={viewDef}
            onChange={(sort) => patchQuery({ sort })}
          />
          <ListOptionsEditor
            columns={recordsQuery.columns}
            columnOptions={columnOptions}
            limit={recordsQuery.limit}
            onChange={patchQuery}
          />
        </EditorRow>
      ) : (
        <>
          <EditorRow>
            <BucketList
              buckets={recordsQuery.buckets}
              viewDef={viewDef}
              autoInterval={autoInterval}
              onChange={(buckets) => patchQuery({ buckets })}
            />
          </EditorRow>
          <EditorRow>
            <MetricList
              metrics={recordsQuery.metrics}
              viewDef={viewDef}
              onChange={(metrics) => patchQuery({ metrics })}
            />
            <FlexItem grow={1} />
            <Stack gap={1} alignItems="center">
              <ResultShapeBadge buckets={recordsQuery.buckets} />
            </Stack>
          </EditorRow>
        </>
      )}
    </EditorRows>
  );
};

export default RecordsTab;
