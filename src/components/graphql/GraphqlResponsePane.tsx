import React from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { CodeEditor, FieldValidationMessage, useStyles2 } from '@grafana/ui';

const getStyles = (theme: GrafanaTheme2) => ({
  placeholder: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: theme.spacing(2),
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    background: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
  }),
});

import { GraphqlResponseState } from './useGraphqlPreview';

interface GraphqlResponsePaneProps {
  response?: GraphqlResponseState;
  isRunning: boolean;
  height: number;
}

/**
 * The untouched response body, so the shape a query actually returns can be checked
 * against the field being extracted without leaving the editor.
 */
export const GraphqlResponsePane = ({
  response,
  isRunning,
  height,
}: GraphqlResponsePaneProps) => {
  const styles = useStyles2(getStyles);

  if (isRunning) {
    return (
      <div className={styles.placeholder} style={{ height }}>
        Running query…
      </div>
    );
  }

  if (response?.error) {
    return (
      <div style={{ height, overflow: 'auto' }}>
        <FieldValidationMessage>{response.error}</FieldValidationMessage>
      </div>
    );
  }

  if (!response?.body) {
    return (
      <div className={styles.placeholder} style={{ height }}>
        Test the query to inspect the raw response.
      </div>
    );
  }

  return (
    <div>
      <CodeEditor
        language="json"
        value={response.body}
        readOnly
        showMiniMap={false}
        showLineNumbers
        height={height}
        monacoOptions={{ scrollBeyondLastLine: false, folding: true }}
      />
    </div>
  );
};
