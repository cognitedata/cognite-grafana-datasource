import React from 'react';
import { css, cx } from '@emotion/css';
import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Stack, useStyles2 } from '@grafana/ui';
import { isTopLevelProperty } from '../../cdf/records';
import { PropertyOption } from './shared';

type TypeTokenKind = 'enum' | 'numeric' | 'textTime' | 'direct' | 'boolean' | 'other';

const TOKEN_LABELS: Record<string, { label: string; kind: TypeTokenKind }> = {
  enum: { label: 'ENUM', kind: 'enum' },
  float32: { label: 'F32', kind: 'numeric' },
  float64: { label: 'F64', kind: 'numeric' },
  int32: { label: 'I32', kind: 'numeric' },
  int64: { label: 'I64', kind: 'numeric' },
  text: { label: 'TEXT', kind: 'textTime' },
  timestamp: { label: 'TIME', kind: 'textTime' },
  date: { label: 'DATE', kind: 'textTime' },
  direct: { label: 'REL', kind: 'direct' },
  boolean: { label: 'BOOL', kind: 'boolean' },
  json: { label: 'JSON', kind: 'other' },
};

export function propertyTypeToken(
  type?: string,
  isList?: boolean
): { label: string; kind: TypeTokenKind } | null {
  if (!type) {
    return null;
  }
  const token = TOKEN_LABELS[type] ?? { label: type.slice(0, 4).toUpperCase(), kind: 'other' as const };
  return isList ? { ...token, label: `${token.label}[]` } : token;
}

const getStyles = (theme: GrafanaTheme2) => {
  const base = css({
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: 10,
    fontWeight: theme.typography.fontWeightMedium,
    letterSpacing: '0.04em',
    padding: theme.spacing(0, 0.5),
    borderRadius: theme.shape.radius.default,
    background: theme.colors.background.secondary,
    lineHeight: 1.6,
  });
  return {
    enum: cx(base, css({ color: theme.colors.warning.text })),
    numeric: cx(base, css({ color: theme.colors.success.text })),
    textTime: cx(base, css({ color: theme.colors.info.text })),
    direct: cx(base, css({ color: theme.colors.primary.text })),
    boolean: cx(base, css({ color: theme.visualization.getColorByName('purple') })),
    other: cx(base, css({ color: theme.colors.text.secondary })),
    recordMarker: css({
      fontFamily: theme.typography.fontFamilyMonospace,
      fontSize: 10,
      color: theme.colors.text.disabled,
    }),
  };
};

export const TypeToken = ({ type, isList }: { type?: string; isList?: boolean }) => {
  const styles = useStyles2(getStyles);
  const token = propertyTypeToken(type, isList);
  if (!token) {
    return null;
  }
  return <span className={styles[token.kind]}>{token.label}</span>;
};

interface PropertyOptionMeta {
  type?: string;
  isList?: boolean;
}

/**
 * Renders a colored type token before the property name in Select menus and on the
 * selected value. `propertyOptions()` attaches the type structurally; the
 * description string it also sets is for the reader, not for this.
 */
function optionMeta(option: PropertyOption): PropertyOptionMeta {
  const { type, isList } = option.propertyType ?? { isList: false };
  return { type: type || undefined, isList };
}

export const PropertyOptionLabel = ({ option }: { option: PropertyOption }) => {
  const styles = useStyles2(getStyles);
  const { type, isList } = optionMeta(option);
  return (
    <Stack gap={1} alignItems="center" wrap={false}>
      <TypeToken type={type} isList={isList} />
      <span>{option.label}</span>
      {isTopLevelProperty(option.value) && (
        <span className={styles.recordMarker}>record</span>
      )}
    </Stack>
  );
};

/**
 * formatOptionLabel for property Selects. `menuOnly` keeps MultiSelect chips
 * clean by rendering the badge only inside the dropdown menu.
 */
export const formatPropertyOptionLabel = (menuOnly = false) => (
  option: PropertyOption,
  meta: { context: string }
) => {
  if (menuOnly && meta.context !== 'menu') {
    return <>{option.label}</>;
  }
  return <PropertyOptionLabel option={option} />;
};
