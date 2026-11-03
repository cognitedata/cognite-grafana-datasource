import React, { useLayoutEffect, useRef, useState } from 'react';
import { Button, Stack, useStyles2 } from '@grafana/ui';
import { SyntheticVariable } from '../../types';
import { CogniteUnit, ViewRef } from '../../types/dms';
import { UnitSystem } from '../../types/records';
import { Connector } from '../../connector';
import { nextVariableName, validateVariableName } from '../../parser/dms/variables';
import { GraphqlExamplesModal } from '../graphql/GraphqlExamplesModal';
import { SyntheticPropertyMeta } from './completions';
import { SYNTHETIC_FILTER_EXAMPLES } from './examples';
import {
  getVariableGridStyles,
  wideLayoutMinWidth,
  VariableColumnHeader,
  variableColumnHeaders,
  variableColumns,
  VariableRename,
  VariableRow,
} from './VariableRow';

export const MAX_VARIABLES = 10;

export const VARIABLES_TOOLTIP =
  'Name time series here and use the names in the expression. See Filter syntax for how to write a filter.';

interface VariablesListProps {
  refId: string;
  variables: SyntheticVariable[];
  view: ViewRef;
  connector: Connector;
  properties: SyntheticPropertyMeta[];
  datapoints: 'aggregate' | 'raw';
  unitIndex: Map<string, CogniteUnit>;
  unitSystems: UnitSystem[];
  onChange: (variables: SyntheticVariable[], rename?: VariableRename) => void;
  onPreview: (index: number) => void;
  /** Dashboard variables in a filter, replaced as the query replaces them. */
  interpolateFilter: (filter: string) => string;
}

/** The variable rows under a header of column labels, with the name checks and the Add button. */
export const VariablesList = ({
  refId,
  variables,
  onChange,
  onPreview,
  ...rowProps
}: VariablesListProps) => {
  const styles = useStyles2(getVariableGridStyles);
  const { datapoints } = rowProps;
  // The layout follows the list's measured width rather than a CSS container query:
  // size containment hides the list's width from Grafana's editor rows, which then
  // size the Variables row as if it were zero wide, leaving a large empty area.
  const listRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null);
  useLayoutEffect(() => {
    const element = listRef.current;
    if (!element) {
      return;
    }
    // Measured once now, so the first paint already has the right layout.
    setWidth(element.getBoundingClientRect().width);
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  // Unmeasured (as in tests), the wide layout applies.
  const withFilters = variables.some((variable) => variable.mode === 'filter');
  const wide =
    width === null || width === 0 || width >= wideLayoutMinWidth(datapoints, withFilters);
  return (
    <div ref={listRef} className={styles.list}>
      <Stack direction="column" gap={0.5} alignItems="stretch">
        <div
          className={styles.header}
          style={{ '--cdm-variable-columns': variableColumns(datapoints) } as React.CSSProperties}
        >
          <span className={styles.sectionLabel}>
            <VariableColumnHeader label="Variables" tooltip={VARIABLES_TOOLTIP} />
          </span>
          {/* Narrow: each card labels its own fields. */}
          {wide &&
            variables.length > 0 &&
            variableColumnHeaders(datapoints).map((column) => (
              <VariableColumnHeader key={column.label} {...column} />
            ))}
        </div>
        {variables.map((row, index) => {
          const otherNames = variables.filter((_, i) => i !== index).map((v) => v.name.trim());
          return (
            <VariableRow
              key={index}
              refId={refId}
              index={index}
              row={row}
              nameError={validateVariableName(row.name, otherNames)}
              otherNames={otherNames}
              onChange={(next, rename) =>
                onChange(
                  variables.map((v, i) => (i === index ? next : v)),
                  rename
                )
              }
              onRemove={() => onChange(variables.filter((_, i) => i !== index))}
              onPreview={() => onPreview(index)}
              wide={wide}
              {...rowProps}
            />
          );
        })}
        <Stack gap={1}>
          {variables.length < MAX_VARIABLES && (
            <Button
              variant="secondary"
              size="sm"
              icon="plus"
              data-testid={`variable-add-${refId}`}
              onClick={() =>
                onChange([
                  ...variables,
                  {
                    name: nextVariableName(variables.map((v) => v.name)),
                    mode: 'instance',
                    aggregate: 'average',
                  },
                ])
              }
            >
              Add variable
            </Button>
          )}
          <GraphqlExamplesModal
            title="Filter syntax"
            buttonLabel="Filter syntax"
            examples={SYNTHETIC_FILTER_EXAMPLES}
          />
        </Stack>
      </Stack>
    </div>
  );
};
