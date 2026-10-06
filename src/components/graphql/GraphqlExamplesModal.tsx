import React, { useState } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Button, Modal, useStyles2 } from '@grafana/ui';

const getStyles = (theme: GrafanaTheme2) => ({
  modal: css({
    width: '80%',
    maxWidth: 780,
  }),
  section: css({
    marginBottom: theme.spacing(3),
  }),
  lead: css({
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing(1),
  }),
  code: css({
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.bodySmall.fontSize,
    background: theme.colors.background.secondary,
    padding: theme.spacing(1.5),
    borderRadius: theme.shape.radius.default,
    margin: 0,
    overflowX: 'auto',
  }),
});

export interface GraphqlExample {
  title: string;
  lead: React.ReactNode;
  code: string;
}

interface GraphqlExamplesModalProps {
  title: string;
  examples: GraphqlExample[];
}

/** An Examples button and the dialog of worked examples it opens. */
export const GraphqlExamplesModal = ({ title, examples }: GraphqlExamplesModalProps) => {
  const styles = useStyles2(getStyles);
  const [isOpen, setIsOpen] = useState(false);
  const toggle = () => setIsOpen((open) => !open);

  return (
    <>
      <Button variant="secondary" size="sm" icon="question-circle" onClick={toggle}>
        Examples
      </Button>
      <Modal title={title} className={styles.modal} isOpen={isOpen} onDismiss={toggle}>
        <div>
          {examples.map((example) => (
            <div key={example.title} className={styles.section}>
              <h5>{example.title}</h5>
              <div className={styles.lead}>{example.lead}</div>
              <pre className={styles.code}>{example.code}</pre>
            </div>
          ))}
          <a
            className="query-keyword"
            href="https://docs.cognite.com/cdf/dashboards/guides/grafana/getting_started"
            target="_blank"
            rel="noreferrer"
          >
            Cognite Data Source documentation
          </a>
        </div>
        <Modal.ButtonRow>
          <Button variant="primary" onClick={toggle}>
            Close
          </Button>
        </Modal.ButtonRow>
      </Modal>
    </>
  );
};
