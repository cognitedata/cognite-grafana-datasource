import { useCallback, useEffect, useRef, useState } from 'react';
import { eventBusService } from '../appEventHandler';
import { failedResponseEvent, responseWarningEvent } from '../constants';
import { QueryRequestError, QueryWarning } from '../types';

interface UseQueryMessages {
  errorMessage: string;
  warningMessage: string;
  clearMessages: () => void;
}

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
      if (refIdRef.current === refId) {
        setErrorMessage(error);
      }
    };
    const handleWarning = ({ refId, warning }: QueryWarning) => {
      if (refIdRef.current === refId) {
        setWarningMessage(warning);
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
