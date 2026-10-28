import React from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Button, Toggletip, useStyles2 } from '@grafana/ui';
import { StateSetEntry } from '../../cdf/typedFrames';

interface StateSetPreviewProps {
  refId: string;
  stateSet: { space: string; externalId: string };
  states: StateSetEntry[];
}

/**
 * A button that opens the state set of the selected state series: each state's
 * code, label and description. The codes are what raw values and value mappings
 * carry, so this is where a code seen in a panel can be looked up.
 */
export const StateSetPreview = ({ refId, stateSet, states }: StateSetPreviewProps) => {
  const styles = useStyles2(getStyles);
  const withDescriptions = states.some(({ description }) => description);
  return (
    <Toggletip
      closeButton={false}
      placement="bottom-start"
      title={`State set ${stateSet.externalId} (${stateSet.space})`}
      content={
        <div className={styles.scroll}>
          <table className={styles.table} data-testid={`state-set-table-${refId}`}>
            <thead>
              <tr>
                <th>Code</th>
                <th>State</th>
                {withDescriptions && <th>Description</th>}
              </tr>
            </thead>
            <tbody>
              {states.map(({ numericValue, stringValue, description }) => (
                <tr key={numericValue}>
                  <td className={styles.code}>{numericValue}</td>
                  <td>{stringValue}</td>
                  {withDescriptions && <td className={styles.description}>{description}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      }
    >
      <Button variant="secondary" size="sm" icon="list-ul" aria-label="Show the state set">
        {`State set · ${states.length}`}
      </Button>
    </Toggletip>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  scroll: css({ maxHeight: 320, overflowY: 'auto' }),
  table: css({
    borderCollapse: 'collapse',
    fontSize: theme.typography.bodySmall.fontSize,
    'th, td': { padding: theme.spacing(0.5, 2, 0.5, 0), textAlign: 'left', verticalAlign: 'top' },
    th: { color: theme.colors.text.secondary, fontWeight: theme.typography.fontWeightMedium },
  }),
  code: css({ fontVariantNumeric: 'tabular-nums', color: theme.colors.text.secondary }),
  description: css({ color: theme.colors.text.secondary, maxWidth: 360 }),
});
