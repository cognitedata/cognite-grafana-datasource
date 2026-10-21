import { act, renderHook } from '@testing-library/react';
import { emitEvent, eventBusService, handleWarning } from '../appEventHandler';
import { failedResponseEvent, responseWarningEvent } from '../constants';
import { addMessage, useQueryMessages } from '../components/useQueryMessages';

// EventBusSrv keeps its legacy `on`/`off` listeners on a private emitter.
const listenerCount = (eventName: string): number =>
  (eventBusService as unknown as { emitter: { listenerCount: (name: string) => number } }).emitter.listenerCount(
    eventName
  );

describe('useQueryMessages', () => {
  it('leaves no listeners behind across remounts', () => {
    const errorsBefore = listenerCount(failedResponseEvent.name);
    const warningsBefore = listenerCount(responseWarningEvent.name);

    for (let i = 0; i < 3; i++) {
      const { unmount } = renderHook(() => useQueryMessages('A'));
      expect(listenerCount(failedResponseEvent.name)).toBe(errorsBefore + 1);
      expect(listenerCount(responseWarningEvent.name)).toBe(warningsBefore + 1);
      unmount();
    }

    expect(listenerCount(failedResponseEvent.name)).toBe(errorsBefore);
    expect(listenerCount(responseWarningEvent.name)).toBe(warningsBefore);
  });

  it('keeps a single subscription across re-renders', () => {
    const warningsBefore = listenerCount(responseWarningEvent.name);
    const { rerender, unmount } = renderHook(({ refId }) => useQueryMessages(refId), {
      initialProps: { refId: 'A' },
    });
    rerender({ refId: 'A' });
    rerender({ refId: 'B' });
    expect(listenerCount(responseWarningEvent.name)).toBe(warningsBefore + 1);
    unmount();
    expect(listenerCount(responseWarningEvent.name)).toBe(warningsBefore);
  });

  it('shows messages for its own refId and follows a refId change', () => {
    const { result, rerender, unmount } = renderHook(({ refId }) => useQueryMessages(refId), {
      initialProps: { refId: 'A' },
    });

    act(() => {
      handleWarning('other row', 'B');
      emitEvent(failedResponseEvent, { refId: 'A', error: 'boom' });
    });
    expect(result.current.warningMessage).toBe('');
    expect(result.current.errorMessage).toBe('boom');

    rerender({ refId: 'B' });
    act(() => handleWarning('now mine', 'B'));
    expect(result.current.warningMessage).toBe('now mine');

    act(() => result.current.clearMessages());
    expect(result.current).toMatchObject({ errorMessage: '', warningMessage: '' });
    unmount();
  });

  it('shows GraphQL series messages on the row they came from, adding up errors and warnings', () => {
    const { result, unmount } = renderHook(() => useQueryMessages('A'));

    act(() => {
      emitEvent(failedResponseEvent, { refId: 'A_fdm_2', error: 'series 2 failed' });
      emitEvent(failedResponseEvent, { refId: 'A_fdm_3', error: 'series 3 failed' });
      handleWarning('series 0 is empty', 'A_fdm_0');
      handleWarning('series 1 is empty', 'A_fdm_1');
      handleWarning('series 1 is empty', 'A_fdm_1');
      handleWarning('not this row', 'AB_fdm_0');
    });
    expect(result.current.errorMessage).toBe('series 2 failed\n\nseries 3 failed');
    expect(result.current.warningMessage).toBe('series 0 is empty\n\nseries 1 is empty');

    // The empty messages sent before each run clear what had added up.
    act(() => {
      emitEvent(failedResponseEvent, { refId: 'A', error: '' });
      handleWarning('', 'A');
    });
    expect(result.current).toMatchObject({ errorMessage: '', warningMessage: '' });
    unmount();
  });

  it('adds a message once, matching whole messages only', () => {
    expect(addMessage('', 'a')).toBe('a');
    expect(addMessage('a', '')).toBe('');
    expect(addMessage('Limit reached', 'Limit reached')).toBe('Limit reached');
    // Text contained in an earlier message is still a message of its own.
    expect(addMessage('Series A failed: timeout', 'timeout')).toBe('Series A failed: timeout\n\ntimeout');
  });
});
