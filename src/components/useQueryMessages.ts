import { useCallback, useEffect, useRef, useState } from 'react';
import { eventBusService } from '../appEventHandler';
import { failedResponseEvent, responseWarningEvent } from '../constants';
import { QueryRequestError, QueryWarning } from '../types';
import { isMessageForRow } from '../cdf/graphqlTimeSeries';

interface UseQueryMessages {
  errorMessage: string;
  warningMessage: string;
  clearMessages: () => void;
}

const MESSAGE_SEPARATOR = '\n\n';

/**
 * A row's message after `next` arrives. A row can get several errors or warnings in
 * one run (the GraphQL tab fetches each series on its own), so they add up, each
 * shown once; the empty message sent before each run clears them.
 */
export const addMessage = (current: string, next: string): string =>
  !next || !current
    ? next
    : current.split(MESSAGE_SEPARATOR).includes(next)
      ? current
      : `${current}${MESSAGE_SEPARATOR}${next}`;

/**
 * Keeps the latest error and warning the datasource emitted for one query row.
 * The handlers are created once per mount, so the exact references passed to
 * `on` are the ones passed to `off` on unmount, and nothing outlives the editor.
 */
export const useQueryMessages = (refId: string): UseQueryMessages => {
  const [errorMessage, setErrorMessage] = useState('');
  const [warningMessage, setWarningMessage] = useState('');
  const refIdRef = useRef(refId);
  refIdRef.current = refId;

  useEffect(() => {
    const handleError = ({ refId, error }: QueryRequestError) => {
      if (isMessageForRow(refId, refIdRef.current)) {
        setErrorMessage((current) => addMessage(current, error));
      }
    };
    const handleWarning = ({ refId, warning }: QueryWarning) => {
      if (isMessageForRow(refId, refIdRef.current)) {
        setWarningMessage((current) => addMessage(current, warning));
      }
    };
    eventBusService.on(failedResponseEvent, handleError);
    eventBusService.on(responseWarningEvent, handleWarning);
    return () => {
      eventBusService.off(failedResponseEvent, handleError);
      eventBusService.off(responseWarningEvent, handleWarning);
    };
  }, []);

  const clearMessages = useCallback(() => {
    setErrorMessage('');
    setWarningMessage('');
  }, []);

  return { errorMessage, warningMessage, clearMessages };
};
