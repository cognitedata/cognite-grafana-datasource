import React from 'react';
import { css, cx } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

// Grafana 12 dropped the legacy global classes (query-keyword, gf-formatted-*) these
// replace, so the styles come from the theme instead.
const getStyles = (theme: GrafanaTheme2) => ({
  keyword: css({
    color: theme.colors.primary.text,
    fontWeight: theme.typography.fontWeightMedium,
  }),
  message: css({
    background: 'transparent',
    border: 'none',
    paddingBottom: 0,
  }),
  error: css({
    color: theme.colors.error.text,
  }),
  warning: css({
    color: theme.colors.warning.text,
  }),
});

/** A query keyword or snippet in help text. */
export const Keyword = ({ children }: { children: React.ReactNode }) => {
  const styles = useStyles2(getStyles);
  return <code className={styles.keyword}>{children}</code>;
};

interface FormattedMessageProps {
  severity: 'error' | 'warning';
  /** Render as a span within running text instead of a preformatted block. */
  inline?: boolean;
  children: React.ReactNode;
}

/** An error or warning shown under an editor, keeping the message's line breaks. */
export const FormattedMessage = ({ severity, inline = false, children }: FormattedMessageProps) => {
  const styles = useStyles2(getStyles);
  const Element = inline ? 'span' : 'pre';
  return <Element className={cx(!inline && styles.message, styles[severity])}>{children}</Element>;
};
