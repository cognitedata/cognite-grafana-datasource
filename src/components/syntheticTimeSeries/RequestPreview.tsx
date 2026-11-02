import React, { useState } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import {
  Button,
  ClipboardButton,
  CodeEditor,
  Collapse,
  FieldValidationMessage,
  Modal,
  useStyles2,
} from '@grafana/ui';
import { SyntheticRequestPreviewParts } from './preview';

const getStyles = (theme: GrafanaTheme2) => ({
  monoPath: css({
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing(1),
    wordBreak: 'break-all',
  }),
  note: css({
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing(1),
  }),
  modal: css({
    width: '80%',
    maxWidth: 900,
  }),
});

interface SyntheticRequestPreviewProps {
  title: string;
  parts: SyntheticRequestPreviewParts | null;
  isOpen: boolean;
  onDismiss: () => void;
}

/** The dialog both previews open: a request path, an optional note, and each JSON body or an error. */
export const SyntheticRequestPreview = ({
  title,
  parts,
  isOpen,
  onDismiss,
}: SyntheticRequestPreviewProps) => {
  const styles = useStyles2(getStyles);
  const bodies = parts?.error ? [] : (parts?.bodies ?? []);
  // One request open at a time, the first to start with, so the dialog stays short.
  // Kept with the preview it was chosen in, so a new preview opens on its first request.
  const [open, setOpen] = useState<{ parts: typeof parts; index: number | null }>({
    parts,
    index: 0,
  });
  const openIndex = open.parts === parts ? open.index : 0;
  const setOpenIndex = (index: number | null) => setOpen({ parts, index });
  const editor = (body: string) => (
    <CodeEditor
      language="json"
      value={body}
      readOnly
      showMiniMap={false}
      showLineNumbers
      // Expressions are long single lines: wrapped, they read without scrolling sideways.
      wordWrap
      height={420}
      monacoOptions={{ scrollBeyondLastLine: false, folding: true }}
    />
  );
  return (
    <Modal title={title} className={styles.modal} isOpen={isOpen} onDismiss={onDismiss}>
      <div data-testid="expression-request-preview">
        {parts && <div className={styles.monoPath}>POST {parts.path}</div>}
        {parts?.note && (
          <div className={styles.note} data-testid="expression-request-preview-note">
            {parts.note}
          </div>
        )}
        {parts?.error && <FieldValidationMessage>{parts.error}</FieldValidationMessage>}
        {bodies.length === 1 && (
          <div data-testid="expression-request-preview-body-0">{editor(bodies[0])}</div>
        )}
        {bodies.length > 1 &&
          bodies.map((body, index) => (
            <div key={index} data-testid={`expression-request-preview-body-${index}`}>
              <Collapse
                collapsible
                label={`Request ${index + 1} of ${bodies.length}`}
                isOpen={openIndex === index}
                onToggle={() => setOpenIndex(openIndex === index ? null : index)}
              >
                {editor(body)}
              </Collapse>
            </div>
          ))}
      </div>
      <Modal.ButtonRow>
        {parts && bodies.length > 0 && (
          <ClipboardButton
            variant="secondary"
            icon="copy"
            getText={() => bodies.map((body) => `POST ${parts.path}\n\n${body}`).join('\n\n')}
          >
            Copy
          </ClipboardButton>
        )}
        <Button variant="primary" onClick={onDismiss}>
          Close
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
};
