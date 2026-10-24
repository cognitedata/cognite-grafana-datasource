import { useMemo } from 'react';
import { PanelData } from '@grafana/data';
import { warningsForRow } from '../queryMessages';

const MESSAGE_SEPARATOR = '\n\n';

/**
 * The latest run's warnings for one query row, read from the notices on the row's
 * frames in the panel data Grafana hands the editor. Errors are left to Grafana,
 * which shows them under the query row itself.
 */
export const useQueryWarnings = (data: PanelData | undefined, refId: string): string =>
  useMemo(() => warningsForRow(data?.series, refId).join(MESSAGE_SEPARATOR), [data, refId]);
