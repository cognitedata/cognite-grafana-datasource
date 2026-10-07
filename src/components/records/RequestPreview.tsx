import React from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import {
  Button,
  ClipboardButton,
  CodeEditor,
  FieldValidationMessage,
  Modal,
  useStyles2,
} from '@grafana/ui';
import { RecordsRequestPreviewParts } from '../../cdf/records';

const getStyles = (theme: GrafanaTheme2) => ({
  monoPath: css({
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing(1),
    wordBreak: 'break-all',
  }),
  modal: css({
    width: '80%',
    maxWidth: 900,
  }),
});

interface RequestPreviewProps {
  parts: RecordsRequestPreviewParts;
  isOpen: boolean;
  onToggle: () => void;
}

export const RequestPreview = ({ parts, isOpen, onToggle }: RequestPreviewProps) => {
  const styles = useStyles2(getStyles);

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        icon="brackets-curly"
        onClick={onToggle}
        data-testid="records-open-request-preview"
      >
        Request preview
      </Button>
      <Modal
        title="Request preview"
        className={styles.modal}
        isOpen={isOpen}
        onDismiss={onToggle}
      >
        <div data-testid="records-request-preview">
          <div className={styles.monoPath}>{parts.path}</div>
          {parts.error ? (
            <FieldValidationMessage>{parts.error}</FieldValidationMessage>
          ) : (
            <CodeEditor
              language="json"
              value={parts.body}
              readOnly
              showMiniMap={false}
              showLineNumbers
              height={420}
              monacoOptions={{ scrollBeyondLastLine: false, folding: true }}
            />
          )}
        </div>
        <Modal.ButtonRow>
          <ClipboardButton
            variant="secondary"
            icon="copy"
            getText={() => `${parts.path}\n\n${parts.body}`}
          >
            Copy
          </ClipboardButton>
          <Button variant="primary" onClick={onToggle}>
            Close
          </Button>
        </Modal.ButtonRow>
      </Modal>
    </>
  );
};
