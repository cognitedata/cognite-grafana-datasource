import React, { useEffect, useRef, useState } from 'react';
import { css, cx } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { AccessoryButton } from '@grafana/plugin-ui';
import {
  Badge,
  FieldValidationMessage,
  Icon,
  RadioButtonGroup,
  Select,
  Stack,
  Tooltip,
  useStyles2,
  type Monaco,
  type monacoTypes,
} from '@grafana/ui';
import { SyntheticVariable, SyntheticVariableMode } from '../../types';
import { CogniteUnit, ViewRef } from '../../types/dms';
import { UnitSystem } from '../../types/records';
import { Connector } from '../../connector';
import { getTimeSeriesProperties } from '../../cdf/client';
import { validateVariableName } from '../../parser/dms/variables';
import {
  countVariableMatches,
  incompleteLocalFilterMessage,
  MAX_SYNTHETIC_FANOUT,
  validateFilter,
} from '../../parser/dms';
import { targetUnitApplies } from '../../cdf/units';
import { encodeInstanceRef, InstancePicker, PickedInstance } from '../common/InstancePicker';
import { BlurInput } from '../records/BlurInput';
import { getTypeBadgeColor } from '../cogniteTimeSeriesSearchTab';
import { OneLineCodeEditor } from './OneLineCodeEditor';
import { UnitSelect } from './UnitSelect';
import { ensureSyntheticLanguages } from './monacoLanguage';
import { SYNTHETIC_FILTER_LANG_ID } from './languageIds';
import {
  SyntheticPropertyMeta,
  clearSyntheticModelContext,
  setSyntheticModelContext,
} from './completions';
import { computeFilterMarkers } from './diagnostics';
import { wireDiagnostics } from '../common/monacoDiagnostics';
import { errorMessageOf } from '../../queryMessages';

const MODE_OPTIONS: Array<{
  label: string;
  value: SyntheticVariableMode;
  description: string;
}> = [
  { label: 'Fixed', value: 'instance', description: 'One time series, picked by name' },
  { label: 'Filter', value: 'filter', description: 'All time series that match a filter' },
];

/** The aggregates synthetic time series accept, with descriptions short enough for the column. */
const AGGREGATE_OPTIONS: Array<{ label: string; value: string; description: string }> = [
  { label: 'Average', value: 'average', description: 'Time-weighted average of each interval' },
  {
    label: 'Interpolation',
    value: 'interpolation',
    description: 'Value at the start of each interval',
  },
  {
    label: 'Step Interpolation',
    value: 'stepInterpolation',
    description: 'Last value before each interval starts',
  },
];

export const FILTER_PLACEHOLDER = "name^='PT_', type='numeric'";

/**
 * Column tracks of the wide layout, shared by the header and the rows so the
 * columns line up. The name, mode and remove button keep their size; the rest
 * grow with the space, from a minimum that keeps their content readable.
 */
const columnTracks = (datapoints: 'aggregate' | 'raw'): Array<[number, string?]> => [
  [80],
  [168],
  [200, '2fr'],
  ...(datapoints === 'aggregate' ? [[150, '1fr'] as [number, string]] : []),
  [140, '1fr'],
  [32],
];

const COLUMN_GAP_PX = 4;

/** Marker classes on a row's root, which its field wrappers read their layout from. */
const WIDE_ROW_CLASS = 'cdm-variable-wide';
const CARD_ROW_CLASS = 'cdm-variable-card';
const WIDE = `.${WIDE_ROW_CLASS} &`;
const CARD = `.${CARD_ROW_CLASS} &`;

/**
 * The wide layout's tracks. The flexible ones may shrink to nothing: a fixed
 * minimum would make Grafana's editor rows wider than the panel. The list
 * switches to the narrow layout before they get below their minimum.
 */
export const variableColumns = (datapoints: 'aggregate' | 'raw'): string =>
  columnTracks(datapoints)
    .map(([min, grow]) => (grow ? `minmax(0, ${grow})` : `${min}px`))
    .join(' ');

/** Room a filter row's match chip takes in its time series cell, such as "100+ time series". */
const MATCH_CHIP_WIDTH_PX = 116;

/**
 * Below the width the grid needs at its minimum, each variable becomes a card
 * of labelled fields. With a filter row, the time series cell also holds its
 * match chip, so the grid needs that much more before the filter is readable.
 */
export const wideLayoutMinWidth = (
  datapoints: 'aggregate' | 'raw',
  withFilters: boolean
): number => {
  const tracks = columnTracks(datapoints);
  return (
    tracks.reduce((sum, [min]) => sum + min, 0) +
    COLUMN_GAP_PX * (tracks.length - 1) +
    (withFilters ? MATCH_CHIP_WIDTH_PX : 0)
  );
};

export interface VariableColumn {
  label: string;
  tooltip: string;
}

/** The headed columns, in order, after the unheaded name and mode. */
export const variableColumnHeaders = (datapoints: 'aggregate' | 'raw'): VariableColumn[] => [
  {
    label: 'Time series',
    tooltip: 'Pick one time series, or write a filter. {} shows the request the filter sends.',
  },
  ...(datapoints === 'aggregate'
    ? [{ label: 'Aggregate', tooltip: 'How each interval is computed from the data points.' }]
    : []),
  { label: 'Unit', tooltip: 'Optional. Converts the values to another unit or to a unit system.' },
];

export const getVariableGridStyles = (theme: GrafanaTheme2) => ({
  list: css({
    width: '100%',
  }),
  row: css({
    display: 'grid',
    gridTemplateColumns: 'var(--cdm-variable-columns)',
    columnGap: theme.spacing(0.5),
    rowGap: theme.spacing(0.25),
    alignItems: 'center',
  }),
  header: css({
    display: 'grid',
    gridTemplateColumns: 'var(--cdm-variable-columns)',
    columnGap: theme.spacing(0.5),
    alignItems: 'end',
  }),
  headerLabel: css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    color: theme.colors.text.primary,
  }),
  // The section label sits over the name and mode columns, on the header line.
  sectionLabel: css({
    gridColumn: '1 / span 2',
  }),
  icon: css({
    color: theme.colors.text.secondary,
  }),
  cell: css({ minWidth: 0 }),
  // Narrow layout: one card per variable, every field labelled.
  card: css({
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    gap: theme.spacing(1),
    padding: theme.spacing(1),
    background: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
  }),
  // Wide: dissolves into the grid. Card: a label above its control(s).
  field: css({
    [WIDE]: { display: 'contents' },
    [CARD]: {
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.5),
      minWidth: 0,
      maxWidth: '100%',
    },
  }),
  fieldLabel: css({
    [WIDE]: { display: 'none' },
    [CARD]: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing(1),
      // As tall as the remove button, so the labels of one line align.
      minHeight: theme.spacing(4),
    },
  }),
  labelEnd: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
  }),
  nameAndMode: css({
    [WIDE]: { display: 'contents' },
    [CARD]: { display: 'flex', flexWrap: 'wrap', gap: theme.spacing(0.5) },
  }),
  nameCell: css({ minWidth: 0, [CARD]: { flex: '0 0 80px' } }),
  modeCell: css({ minWidth: 0, [CARD]: { width: 168, flex: '0 1 auto', minWidth: 136 } }),
  // Card: keeps the name and mode on one line unless the card is narrower than them.
  variableField: css({ [CARD]: { flex: '0 0 auto' } }),
  sourceField: css({ [CARD]: { flex: '1 1 240px' } }),
  sourceLine: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    minWidth: 0,
  }),
  sourceControl: css({ flex: '1 1 auto', minWidth: 0 }),
  optionField: css({ [CARD]: { flex: '1 1 160px' } }),
  // Card: starts the line of options.
  lineBreak: css({
    [WIDE]: { display: 'none' },
    [CARD]: { flexBasis: '100%', height: 0 },
  }),
  message: css({
    [WIDE]: { gridColumn: '1 / -1' },
    [CARD]: { flexBasis: '100%' },
  }),
});

/** A column header with its info tooltip, like an EditorField label. */
export const VariableColumnHeader = ({ label, tooltip }: VariableColumn) => {
  const styles = useStyles2(getVariableGridStyles);
  return (
    <span className={styles.headerLabel}>
      {label}
      <Tooltip content={tooltip} placement="top">
        <Icon name="info-circle" size="sm" className={styles.icon} />
      </Tooltip>
    </span>
  );
};

/** What a filter row currently matches, for its counter chip. */
export type VariableMatchState =
  | { status: 'loading' }
  | { status: 'done'; count: number; truncated: boolean; checkedAfterwards: boolean }
  | { status: 'error'; message: string };

const MatchChip = ({
  name,
  state,
  testId,
}: {
  name: string;
  state: VariableMatchState;
  testId: string;
}) => {
  if (state.status === 'loading') {
    return <Badge text="…" color="darkgrey" tooltip="Counting matches" data-testid={testId} />;
  }
  if (state.status === 'error') {
    return (
      <Badge
        text="error"
        color="red"
        icon="exclamation-triangle"
        tooltip={state.message}
        data-testid={testId}
      />
    );
  }
  const { count, truncated, checkedAfterwards } = state;
  return (
    <Badge
      text={`${count}${truncated ? '+' : ''} time series`}
      color={
        count === 0 || (truncated && checkedAfterwards) ? 'red' : truncated ? 'orange' : 'blue'
      }
      tooltip={
        !truncated
          ? 'Time series this filter matches now.'
          : checkedAfterwards
            ? incompleteLocalFilterMessage(name)
            : `Only the first ${MAX_SYNTHETIC_FANOUT} time series are used. Narrow the filter.`
      }
      data-testid={testId}
    />
  );
};

export interface VariableRename {
  from: string;
  to: string;
}

interface VariableRowProps {
  refId: string;
  index: number;
  row: SyntheticVariable;
  nameError: string | null;
  /** The other rows' names, to check a new name before the expression is rewritten to it. */
  otherNames: string[];
  view: ViewRef;
  connector: Connector;
  /** The view's properties, for the filter editor's completions and warnings. */
  properties: SyntheticPropertyMeta[];
  /** Set by the list from its measured width: a grid row when wide, a card when narrow. */
  wide: boolean;
  /** Raw hides the aggregate: none is sent for any time series. */
  datapoints: 'aggregate' | 'raw';
  /** Dashboard variables in a filter, replaced as the query replaces them. */
  interpolateFilter: (filter: string) => string;
  unitIndex: Map<string, CogniteUnit>;
  unitSystems: UnitSystem[];
  onChange: (row: SyntheticVariable, rename?: VariableRename) => void;
  onRemove: () => void;
  onPreview: () => void;
}

/**
 * One variable, laid out on the shared column grid: its name, how it is
 * resolved (a fixed series or a filter), and the options its references are
 * sent with.
 */
export const VariableRow = ({
  refId,
  index,
  row,
  nameError,
  otherNames,
  view,
  connector,
  properties,
  datapoints,
  wide,
  interpolateFilter,
  unitIndex,
  unitSystems,
  onChange,
  onRemove,
  onPreview,
}: VariableRowProps) => {
  const styles = useStyles2(getVariableGridStyles);
  // The picked series' storage unit: from the pick itself, else looked up.
  const [storageUnit, setStorageUnit] = useState<string | undefined>(undefined);
  const [propertiesError, setPropertiesError] = useState<string | null>(null);
  const instanceKey = row.instance ? `${row.instance.space}:${row.instance.externalId}` : '';

  useEffect(() => {
    if (!row.instance) {
      return;
    }
    let cancelled = false;
    getTimeSeriesProperties(connector, row.instance)
      .then(({ unit }) => {
        if (!cancelled) {
          setStorageUnit(unit);
          setPropertiesError(null);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setPropertiesError(
            `Couldn't read the unit of ${row.name}'s time series, so only unit systems are offered: ${errorMessageOf(error)}`
          );
        }
      });
    return () => {
      cancelled = true;
    };
    // The instance's two id fields are what instanceKey encodes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connector, instanceKey]);

  // The counter chip: one lookup per change of the filter as the query would send it.
  const lookupFilter = row.mode === 'filter' ? interpolateFilter(row.filter ?? '').trim() : '';
  const viewKey = `${view.space}:${view.externalId}:${view.version}`;
  const lookupKey = lookupFilter ? `${viewKey}|${lookupFilter}` : '';
  // Each result is stored with the lookup it answers, so a newer filter reads as loading.
  const [counted, setCounted] = useState<{ key: string; state: VariableMatchState | null } | null>(
    null
  );
  useEffect(() => {
    if (!lookupKey) {
      return;
    }
    let cancelled = false;
    const settle = (state: VariableMatchState | null) =>
      !cancelled && setCounted({ key: lookupKey, state });
    countVariableMatches({ name: row.name, mode: 'filter', filter: lookupFilter }, view, connector)
      .then((result) => settle(result ? { status: 'done', ...result } : null))
      .catch((err) => settle({ status: 'error', message: err?.message ?? String(err) }));
    return () => {
      cancelled = true;
    };
    // lookupKey encodes the view's ids and the filter; the name only labels errors.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookupKey, connector]);
  const matches: VariableMatchState | null = !lookupKey
    ? null
    : counted?.key === lookupKey
      ? counted.state
      : { status: 'loading' };

  // Diagnostics and completions read the view schema through refs, so the Monaco
  // wiring done on mount follows view changes without re-mounting the editor.
  const propertiesRef = useRef(properties);
  useEffect(() => {
    propertiesRef.current = properties;
  }, [properties]);
  const filterEditorRef = useRef<monacoTypes.editor.IStandaloneCodeEditor | null>(null);
  const filterMonacoRef = useRef<Monaco | null>(null);
  const disposeDiagnosticsRef = useRef<(() => void) | null>(null);
  // Kept apart from the editor: a disposed editor no longer gives its model.
  const filterModelUriRef = useRef<string | null>(null);

  /** Undoes the wiring of the last filter editor mounted, which may already be gone. */
  const releaseFilterEditor = () => {
    disposeDiagnosticsRef.current?.();
    disposeDiagnosticsRef.current = null;
    if (filterModelUriRef.current) {
      clearSyntheticModelContext(filterModelUriRef.current);
      filterModelUriRef.current = null;
    }
  };

  const syncFilterContext = () => {
    const model = filterEditorRef.current?.getModel();
    if (model) {
      setSyntheticModelContext(model.uri.toString(), { properties: propertiesRef.current });
    }
  };
  useEffect(syncFilterContext, [properties]);
  useEffect(() => () => releaseFilterEditor(), []);

  // Wired again when the view's properties arrive or change, so the warnings follow them.
  const wireFilterDiagnostics = () => {
    const editor = filterEditorRef.current;
    const monaco = filterMonacoRef.current;
    if (!editor || !monaco) {
      return;
    }
    disposeDiagnosticsRef.current?.();
    disposeDiagnosticsRef.current = wireDiagnostics(
      editor,
      monaco,
      (text) =>
        computeFilterMarkers(
          text,
          // No properties yet: the view is loading or can't be read, so nothing is unknown.
          propertiesRef.current.length
            ? new Set(propertiesRef.current.map(({ name }) => name))
            : undefined
        ),
      `${SYNTHETIC_FILTER_LANG_ID}-${refId}-${index}`
    );
  };
  useEffect(wireFilterDiagnostics, [properties, refId, index]);

  const onFilterEditorMount = (
    editor: monacoTypes.editor.IStandaloneCodeEditor,
    monaco: Monaco
  ) => {
    releaseFilterEditor();
    filterEditorRef.current = editor;
    filterModelUriRef.current = editor.getModel()?.uri.toString() ?? null;
    if (!monaco) {
      return;
    }
    ensureSyntheticLanguages(monaco);
    filterMonacoRef.current = monaco;
    wireFilterDiagnostics();
    syncFilterContext();
  };

  const patch = (partial: Partial<SyntheticVariable>) => onChange({ ...row, ...partial });

  const commitName = (name: string) => {
    const trimmed = name.trim();
    if (trimmed === row.name) {
      return;
    }
    // Only a usable new name rewrites the expression; an invalid one just shows its message.
    const rename =
      row.name && !validateVariableName(trimmed, otherNames)
        ? { from: row.name, to: trimmed }
        : undefined;
    onChange({ ...row, name: trimmed }, rename);
  };

  const changeMode = (mode: SyntheticVariableMode) => {
    if (mode === row.mode) {
      return;
    }
    // A unit converts a fixed series only; everything else is kept so flipping back restores it.
    patch(mode === 'filter' ? { mode, targetUnit: undefined } : { mode });
  };

  const pickInstance = ([selected]: PickedInstance[]) => {
    if (!selected?.space || !selected.externalId) {
      patch({ instance: undefined });
      setStorageUnit(undefined);
      return;
    }
    const unit = selected.props?.unit?.externalId;
    setStorageUnit(unit);
    patch({
      instance: {
        space: selected.space,
        externalId: selected.externalId,
        ...(selected.name ? { name: selected.name } : {}),
      },
      // Kept only when the new series measures the same quantity.
      targetUnit: targetUnitApplies(row.targetUnit, unit, unitIndex) ? row.targetUnit : undefined,
    });
  };

  const instanceValue: PickedInstance[] = row.instance
    ? [{ value: encodeInstanceRef(row.instance), ...row.instance }]
    : [];

  const nameInput = (
    <BlurInput
      invalid={!!nameError}
      value={row.name}
      aria-label="Variable name"
      data-testid={`variable-name-${refId}-${index}`}
      onCommit={commitName}
    />
  );
  const modeSwitch = (
    <RadioButtonGroup
      // Unique per row: the group's radio inputs are named after it, and
      // same-named radios across rows would uncheck each other.
      id={`variable-mode-${refId}-${index}`}
      options={MODE_OPTIONS}
      value={row.mode}
      onChange={changeMode}
      fullWidth
      aria-label={`Mode of variable ${row.name}`}
    />
  );
  const source =
    row.mode === 'instance' ? (
      <InstancePicker
        connector={connector}
        view={view}
        value={instanceValue}
        onChange={pickInstance}
        placeholder="Search time series by name or description"
        inputId={`variable-instance-${refId}-${index}`}
        badgeOf={(props) =>
          props.type ? { text: props.type, color: getTypeBadgeColor(props.type) } : undefined
        }
      />
    ) : (
      <Stack gap={0} alignItems="center">
        <OneLineCodeEditor
          value={row.filter ?? ''}
          language={SYNTHETIC_FILTER_LANG_ID}
          width="fill"
          placeholder={FILTER_PLACEHOLDER}
          invalid={validateFilter(row.filter ?? '') !== null}
          testId={`variable-filter-editor-${refId}-${index}`}
          onCommit={(filter) => filter !== (row.filter ?? '') && patch({ filter })}
          onEditorDidMount={onFilterEditorMount}
        />
        <AccessoryButton
          icon="brackets-curly"
          variant="secondary"
          title="Show the request this filter sends"
          aria-label={`Request preview for variable ${row.name}`}
          data-testid={`variable-preview-${refId}-${index}`}
          onClick={onPreview}
        />
      </Stack>
    );
  const aggregateSelect =
    datapoints === 'aggregate' ? (
      <Select
        inputId={`variable-aggregate-${refId}-${index}`}
        options={AGGREGATE_OPTIONS}
        value={row.aggregate ?? 'average'}
        menuPosition="fixed"
        aria-label={`Aggregate of variable ${row.name}`}
        onChange={({ value }) => patch({ aggregate: value })}
      />
    ) : null;
  const unitSelect = (
    <UnitSelect
      row={row}
      storageUnit={storageUnit}
      unitIndex={unitIndex}
      unitSystems={unitSystems}
      inputId={`variable-unit-${refId}-${index}`}
      onChange={(unitPatch) => patch(unitPatch)}
    />
  );
  const removeButton = (
    <AccessoryButton
      icon="times"
      variant="secondary"
      aria-label={`Remove variable ${row.name}`}
      data-testid={`variable-remove-${refId}-${index}`}
      onClick={onRemove}
    />
  );
  const chip =
    row.mode === 'filter' && matches ? (
      <MatchChip name={row.name} state={matches} testId={`variable-matches-${refId}-${index}`} />
    ) : null;
  const nameMessage = nameError && <FieldValidationMessage>{nameError}</FieldValidationMessage>;

  const headers = variableColumnHeaders(datapoints);
  const fieldLabel = (label: string) => {
    const column = headers.find((candidate) => candidate.label === label);
    return column ? <VariableColumnHeader {...column} /> : null;
  };
  // One tree for both layouts, so resizing or a chip appearing never remounts the
  // controls (a filter being typed would lose its text and focus). Wide: the field
  // wrappers dissolve into grid cells and their labels hide. Narrow: they are the
  // labelled fields of a card, and the chip and remove button sit on the label line.
  return (
    <div
      className={wide ? cx(styles.row, WIDE_ROW_CLASS) : cx(styles.card, CARD_ROW_CLASS)}
      style={{ '--cdm-variable-columns': variableColumns(datapoints) } as React.CSSProperties}
      data-testid={wide ? undefined : `variable-card-${refId}-${index}`}
    >
      <div className={cx(styles.field, styles.variableField)}>
        <div className={styles.fieldLabel}>
          <span className={styles.headerLabel}>Variable</span>
        </div>
        <div className={styles.nameAndMode}>
          <div className={styles.nameCell}>{nameInput}</div>
          <div className={styles.modeCell}>{modeSwitch}</div>
        </div>
      </div>
      <div className={cx(styles.field, styles.sourceField)}>
        <div className={styles.fieldLabel}>
          {fieldLabel('Time series')}
          {!wide && (
            <span className={styles.labelEnd}>
              {chip}
              {removeButton}
            </span>
          )}
        </div>
        <div className={styles.sourceLine}>
          <div className={styles.sourceControl}>{source}</div>
          {wide && chip}
        </div>
      </div>
      <div className={styles.lineBreak} />
      {aggregateSelect && (
        <div className={cx(styles.field, styles.optionField)}>
          <div className={styles.fieldLabel}>{fieldLabel('Aggregate')}</div>
          <div className={styles.cell}>{aggregateSelect}</div>
        </div>
      )}
      <div className={cx(styles.field, styles.optionField)}>
        <div className={styles.fieldLabel}>{fieldLabel('Unit')}</div>
        <div className={styles.cell}>{unitSelect}</div>
      </div>
      {wide && <div>{removeButton}</div>}
      {nameMessage && <div className={styles.message}>{nameMessage}</div>}
      {propertiesError && (
        <div className={styles.message}>
          <FieldValidationMessage>{propertiesError}</FieldValidationMessage>
        </div>
      )}
    </div>
  );
};
