import { css, cx } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import React from 'react';

const getTabSuffixLabelStyles = (theme: GrafanaTheme2) => ({
  base: css({
    alignSelf: 'center',
    background: '#ffdc7f',
    borderRadius: theme.shape.radius.default,
    color: '#262626',
    marginTop: 0,
    marginLeft: 5,
    marginBottom: 0,
    padding: '1px 5px',
    textAlign: 'center',
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
  }),
  deprecated: css({
    background: '#ff9830',
  }),
  disabled: css({
    color: theme.colors.error.text,
  }),
});

export type TabSuffixLabelVariant = 'default' | 'deprecated' | 'disabled';

export const TabSuffixLabel = ({
  children,
  variant = 'default',
}: {
  children: React.ReactNode;
  variant?: TabSuffixLabelVariant;
}) => {
  const styles = useStyles2(getTabSuffixLabelStyles);
  return (
    <p
      className={cx(
        styles.base,
        variant === 'deprecated' && styles.deprecated,
        variant === 'disabled' && styles.disabled
      )}
    >
      {children}
    </p>
  );
};

/** Help alerts in queryEditor / queryHelp — mirrors the old `.help-panel` and `pre code` spacing. */
export const queryHelpPanelClassName = css({
  lineHeight: 2,
  '& code': {
    lineHeight: 2,
  },
  '& pre': {
    lineHeight: 2,
  },
  '& pre code': {
    lineHeight: 2,
  },
});

const getEventsTabInputStyles = (theme: GrafanaTheme2) => ({
  monospaceInput: css({
    '& input': {
      fontFamily: theme.typography.fontFamilyMonospace,
    },
  }),
  marginRight4: css({
    marginRight: 4,
  }),
});

export const getEventsTabStyles = (theme: GrafanaTheme2) => getEventsTabInputStyles(theme);

export const relationshipsTabStyles = {
  row: css({
    width: '100%',
    marginTop: 4,
    display: 'flex',
  }),
  item: css({
    margin: 6,
  }),
  select: css({
    width: '38.5em',
    margin: 6,
  }),
};
