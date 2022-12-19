import { AppEvent, EventBusSrv } from '@grafana/data';
import { getCalculationWarnings, getLimitsWarnings, stringifyError } from './cdf/client';
import { failedResponseEvent, responseWarningEvent } from './constants';
import { SuccessResponse } from './types';

export const eventBusService = new EventBusSrv();

export async function emitEvent<T>(event: AppEvent<T>, payload: T): Promise<void> {
  return eventBusService.emit(event, payload);
}

export function handleError(error: any, refId: string) {
  const errMessage = stringifyError(error);
  emitEvent(failedResponseEvent, { refId, error: errMessage });
}
export function handleWarning(warningMessage: string, refId: string) {
  emitEvent(responseWarningEvent, { refId, warning: warningMessage });
}
export function showWarnings(responses: SuccessResponse[]) {
  responses.forEach(({ result, metadata }) => {
    const { items } = result.data;
    const { limit } = result.config.data;
    const { refId } = metadata.target;
    const warning = [getLimitsWarnings(items, limit), getCalculationWarnings(items)]
      .filter(Boolean)
      .join('\n\n');

    if (warning) {
      emitEvent(responseWarningEvent, { refId, warning });
    }
  });
}
