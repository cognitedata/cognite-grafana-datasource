import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getDefaultTimeRange, ScopedVars, TimeRange } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { Button, Stack, type Monaco, type monacoTypes } from '@grafana/ui';
import { EditorField, EditorFieldGroup, EditorRow, EditorRows } from '@grafana/plugin-ui';
import { Connector } from '../connector';
import { getRange } from '../utils';
import { CdmSyntheticQuery, SyntheticVariable, SelectedProps } from '../types';
import { CogniteUnit, DMSViewWithProperties, InvolvedView } from '../types/dms';
import { UnitSystem } from '../types/records';
import { fetchDMSView, getCogniteUnitIndex } from '../cdf/client';
import { fetchUnitSystems } from '../cdf/records/api';
import { datapointsModeOf } from '../cdf/aggregates';
import { resolveDatapointsGranularity } from '../cdf/granularity';
import { interpolateCdmSyntheticQuery, normalizeCdmSyntheticQuery } from '../cdf/syntheticTimeSeries';
import { interpolateFilterVariables, filterPropertiesOf } from '../cdf/filterVariables';
import { parseExpression, renameVariableInExpression, variableNamesIn } from '../parser/dms';
import { encodeViewRef, ViewPicker } from './common/ViewPicker';
import { DatapointsFields } from './common/DatapointsFields';
import { cdmLabelTooltip, LabelField } from './common/LabelField';
import { GraphqlExamplesModal } from './graphql/GraphqlExamplesModal';
import { instancePropertyOptions, viewPropertyOptions } from './records/shared';
import { ensureSyntheticLanguages } from './syntheticTimeSeries/monacoLanguage';
import { SYNTHETIC_EXPRESSION_LANG_ID } from './syntheticTimeSeries/languageIds';
import {
  SyntheticPropertyMeta,
  clearSyntheticModelContext,
  setSyntheticModelContext,
} from './syntheticTimeSeries/completions';
import { computeExpressionMarkers, wireDiagnostics } from './syntheticTimeSeries/diagnostics';
import { OneLineCodeEditor, OneLineCodeEditorHandle } from './syntheticTimeSeries/OneLineCodeEditor';
import { SyntheticRequestPreview } from './syntheticTimeSeries/RequestPreview';
import {
  buildExpressionPreview,
  buildVariableLookupPreview,
  SyntheticRequestPreviewParts,
  SYNTHETIC_PATH,
} from './syntheticTimeSeries/preview';
import { VariablesList } from './syntheticTimeSeries/VariablesList';
import { VariableRename } from './syntheticTimeSeries/VariableRow';
import { SYNTHETIC_EXPRESSION_EXAMPLES } from './syntheticTimeSeries/examples';

const VIEW_TOOLTIP = 'The view to pick and filter time series from.';
const EXPRESSION_TOOLTIP =
  'Combines the variables, for example A * 2 or avg(B) - A. See Expression syntax.';
const DATAPOINTS_TOOLTIP =
  "Aggregate: one value per interval, using each variable's aggregate. Raw: the data points as stored.";
const GRANULARITY_TOOLTIP =
  'The width of each interval. Auto follows the time range. Fixed takes s, m, h or d, for example 12h.';
/** Tokens name the variable first: {{A.name}} is a property of variable A's time series. */
const LABEL_TOOLTIP = cdmLabelTooltip("{{A.name}} for the name of variable A's time series");

type Datapoints = 'aggregate' | 'raw';

const SYNTHETIC_DATAPOINTS_MODES: Datapoints[] = ['aggregate', 'raw'];

interface PreviewState {
  title: string;
  parts: SyntheticRequestPreviewParts | null;
}

interface SyntheticTimeSeriesTabProps extends SelectedProps {
  connector: Connector;
  intervalMs?: number;
  /** The panel's time range and the time zone of its last request, for the request preview. */
  range?: TimeRange;
  timezone?: string;
  /** The last request's scoped variables, so $__interval and the like resolve as the query has them. */
  scopedVars?: ScopedVars;
}

/**
 * Named variables pick time series instances (one, or every match of a filter
 * on the view's properties); a synthetic expression over them is computed by
 * CDF. The rows follow the Time series tab: the source, the variables, the
 * expression, then how the data points come back and how series are labelled.
 */
export const SyntheticTimeSeriesTab = ({
  query,
  onQueryChange,
  connector,
  intervalMs,
  range,
  timezone,
  scopedVars,
}: SyntheticTimeSeriesTabProps) => {
  const { refId } = query;
  const cdmSyntheticQuery = normalizeCdmSyntheticQuery(query.cdmSyntheticQuery);
  const { view, variables, expression } = cdmSyntheticQuery;
  const viewKey = encodeViewRef(view);
  const datapoints: Datapoints = datapointsModeOf(query) === 'raw' ? 'raw' : 'aggregate';
  const names = useMemo(() => variables.map((v) => v.name.trim()).filter(Boolean), [variables]);

  // Kept with the view it was read for, so a view change never reads the previous view's definition.
  const [loadedView, setLoadedView] = useState<{
    key: string;
    def: DMSViewWithProperties | null;
  } | null>(null);
  const viewDef = loadedView?.key === viewKey ? loadedView.def : null;
  const [unitIndex, setUnitIndex] = useState<Map<string, CogniteUnit>>(new Map());
  const [unitSystems, setUnitSystems] = useState<UnitSystem[]>([]);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const previewGeneration = useRef(0);

  const editorRef = useRef<OneLineCodeEditorHandle>(null);
  const monacoEditorRef = useRef<monacoTypes.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const disposeDiagnosticsRef = useRef<(() => void) | null>(null);
  const namesRef = useRef(names);
  useEffect(() => {
    namesRef.current = names;
  }, [names]);

  useEffect(() => {
    let cancelled = false;
    fetchDMSView(connector, view).then((def) => !cancelled && setLoadedView({ key: viewKey, def }));
    return () => {
      cancelled = true;
    };
    // The view's three fields are what viewKey encodes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connector, viewKey]);

  useEffect(() => {
    let cancelled = false;
    getCogniteUnitIndex(connector).then((index) => !cancelled && setUnitIndex(index));
    fetchUnitSystems(connector).then((systems) => !cancelled && setUnitSystems(systems));
    return () => {
      cancelled = true;
    };
  }, [connector]);

  // Empty until the view is read, so the filter editors don't warn about properties meanwhile.
  const properties: SyntheticPropertyMeta[] = useMemo(() => {
    const options = viewDef ? [...viewPropertyOptions(viewDef), ...instancePropertyOptions()] : [];
    return options.map((option) => ({
      name: option.value ?? '',
      type: option.propertyType?.isList
        ? `${option.propertyType.type}[]`
        : option.propertyType?.type,
      description: option.origin === 'instance' ? 'Instance property' : undefined,
    }));
  }, [viewDef]);
  // Kept apart from the editor: a disposed editor no longer gives its model.
  const expressionModelUriRef = useRef<string | null>(null);
  const releaseExpressionEditor = () => {
    disposeDiagnosticsRef.current?.();
    disposeDiagnosticsRef.current = null;
    if (expressionModelUriRef.current) {
      clearSyntheticModelContext(expressionModelUriRef.current);
      expressionModelUriRef.current = null;
    }
  };

  const syncExpressionContext = useCallback(() => {
    const model = monacoEditorRef.current?.getModel();
    if (model) {
      setSyntheticModelContext(model.uri.toString(), { variables: names });
    }
  }, [names]);
  useEffect(syncExpressionContext, [syncExpressionContext]);
  useEffect(() => () => releaseExpressionEditor(), []);

  // Wired again when the variables change, so a variable added after the expression clears its error.
  const wireExpressionDiagnostics = () => {
    const editor = monacoEditorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) {
      return;
    }
    disposeDiagnosticsRef.current?.();
    disposeDiagnosticsRef.current = wireDiagnostics(
      editor,
      monaco,
      (text) => computeExpressionMarkers(text, new Set(namesRef.current)),
      SYNTHETIC_EXPRESSION_LANG_ID
    );
  };
  // The names, not the array: it is rebuilt whenever any part of any row changes.
  const namesKey = names.join(',');
  useEffect(wireExpressionDiagnostics, [namesKey]);

  const onExpressionEditorMount = (
    editor: monacoTypes.editor.IStandaloneCodeEditor,
    monaco: Monaco
  ) => {
    releaseExpressionEditor();
    monacoEditorRef.current = editor;
    expressionModelUriRef.current = editor.getModel()?.uri.toString() ?? null;
    if (!monaco) {
      return;
    }
    ensureSyntheticLanguages(monaco);
    monacoRef.current = monaco;
    wireExpressionDiagnostics();
    syncExpressionContext();
  };

  const patch = (partial: Partial<CdmSyntheticQuery>) =>
    onQueryChange({ cdmSyntheticQuery: { ...cdmSyntheticQuery, ...partial } });

  const onViewChange = (next: InvolvedView | null) => {
    if (next) {
      patch({ view: { space: next.space, externalId: next.externalId, version: next.version } });
    }
  };

  const currentExpression = () => editorRef.current?.getValue() ?? expression;

  const commitExpression = (value: string) => {
    if (value !== expression) {
      patch({ expression: value });
    }
  };

  const onVariablesChange = (next: SyntheticVariable[], rename?: VariableRename) => {
    const current = currentExpression();
    const rewritten = rename
      ? renameVariableInExpression(current, rename.from, rename.to)
      : current;
    if (rewritten !== current) {
      editorRef.current?.setValue(rewritten);
    }
    patch({ variables: next, expression: rewritten });
  };

  // The same two-step interpolation the query runs with, so the previews show what is sent.
  const interpolateFilter = (filter: string) => {
    const templateSrv = getTemplateSrv();
    return templateSrv.replace(
      interpolateFilterVariables(filter, templateSrv, scopedVars),
      scopedVars
    );
  };
  const interpolated = (): CdmSyntheticQuery =>
    interpolateCdmSyntheticQuery(
      { ...cdmSyntheticQuery, expression: currentExpression() },
      (value) => getTemplateSrv().replace(value, scopedVars),
      interpolateFilter
    );

  const openExpressionPreview = async () => {
    const generation = (previewGeneration.current += 1);
    setPreview({
      title: 'Request preview',
      parts: { path: SYNTHETIC_PATH, note: 'Finding the time series…' },
    });
    const parts = await buildExpressionPreview(
      interpolated(),
      {
        datapoints,
        granularity: resolveDatapointsGranularity(query.granularity, intervalMs ?? 60_000),
      },
      connector,
      { range: getRange(range ?? getDefaultTimeRange()), timezone }
    );
    if (generation === previewGeneration.current) {
      setPreview({ title: 'Request preview', parts });
    }
  };

  const openVariablePreview = async (index: number) => {
    const { view: interpolatedView, variables: interpolatedVariables } = interpolated();
    const row = interpolatedVariables[index];
    const title = `Request preview: variable ${row.name}`;
    const generation = (previewGeneration.current += 1);
    const previewWith = (def: DMSViewWithProperties | null) =>
      buildVariableLookupPreview(interpolatedView, row, filterPropertiesOf(def));
    const first = previewWith(viewDef);
    if (!first.bodies) {
      setPreview({ title, parts: first });
      return;
    }
    // A filter compiles against the view, so read it as the query does; the read is cached.
    setPreview({ title, parts: { path: first.path, note: 'Reading the view…' } });
    let parts: SyntheticRequestPreviewParts;
    try {
      parts = previewWith(await fetchDMSView(connector, interpolatedView));
    } catch (error: any) {
      const reason = error?.data?.error?.message ?? error?.message ?? String(error);
      parts = { path: first.path, error: `Couldn't read the view's properties: ${reason}` };
    }
    if (generation === previewGeneration.current) {
      setPreview({ title, parts });
    }
  };

  // The expression's own variable set, for the Add button's next name and the unknown-variable markers.
  const expressionParses = useMemo(() => {
    try {
      variableNamesIn(parseExpression(expression));
      return true;
    } catch {
      return false;
    }
  }, [expression]);

  return (
    <>
      <EditorRows>
        <EditorRow>
          <EditorFieldGroup>
            <EditorField label="View" tooltip={VIEW_TOOLTIP} htmlFor={`view-${refId}`}>
              <ViewPicker
                connector={connector}
                container="CogniteTimeSeries"
                value={view}
                onChange={onViewChange}
                width={44}
                inputId={`view-${refId}`}
              />
            </EditorField>
          </EditorFieldGroup>
        </EditorRow>
        <EditorRow>
          <VariablesList
            refId={refId}
            variables={variables}
            view={view}
            connector={connector}
            properties={properties}
            datapoints={datapoints}
            unitIndex={unitIndex}
            unitSystems={unitSystems}
            onChange={onVariablesChange}
            onPreview={openVariablePreview}
            interpolateFilter={interpolateFilter}
          />
        </EditorRow>
        <EditorRow>
          <EditorField label="Expression" tooltip={EXPRESSION_TOOLTIP} width="100%">
            <Stack gap={1} alignItems="center" wrap="wrap">
              <div style={{ display: 'flex', flex: '1 1 320px', maxWidth: 640 }}>
                <OneLineCodeEditor
                  ref={editorRef}
                  value={expression}
                  language={SYNTHETIC_EXPRESSION_LANG_ID}
                  width="fill"
                  placeholder={
                    names.length > 1 ? `${names[0]} - ${names[1]}` : `${names[0] ?? 'A'} * 2`
                  }
                  invalid={!!expression && !expressionParses}
                  wrap
                  testId="expression-editor"
                  onCommit={commitExpression}
                  onEditorDidMount={onExpressionEditorMount}
                />
              </div>
              <Button
                variant="secondary"
                size="sm"
                icon="brackets-curly"
                title="Show the request sent to CDF"
                onClick={openExpressionPreview}
                data-testid="expression-open-request-preview"
              >
                Request preview
              </Button>
              <GraphqlExamplesModal
                title="Expression syntax"
                buttonLabel="Expression syntax"
                examples={SYNTHETIC_EXPRESSION_EXAMPLES}
              />
            </Stack>
          </EditorField>
        </EditorRow>
        <EditorRow>
          {/* The synthetic API has no latest value and no gap filling, and each variable has its own aggregate. */}
          <DatapointsFields
            query={query}
            intervalMs={intervalMs}
            onQueryChange={onQueryChange}
            modes={SYNTHETIC_DATAPOINTS_MODES}
            withAggregation={false}
            withGapFill={false}
            modeTooltip={DATAPOINTS_TOOLTIP}
            granularityTooltip={GRANULARITY_TOOLTIP}
          />
          {/* Beside the data points when there is room; the row wraps it below otherwise. */}
          <EditorFieldGroup>
            <LabelField
              id={`label-${refId}`}
              value={query.label}
              tooltip={LABEL_TOOLTIP}
              placeholder={`{{${names[0] ?? 'A'}.name}}`}
              onCommit={(label) => onQueryChange({ label })}
            />
          </EditorFieldGroup>
        </EditorRow>
      </EditorRows>
      <SyntheticRequestPreview
        title={preview?.title ?? 'Request preview'}
        parts={preview?.parts ?? null}
        isOpen={!!preview}
        onDismiss={() => setPreview(null)}
      />
    </>
  );
};
