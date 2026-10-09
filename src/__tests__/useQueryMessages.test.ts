import { act, renderHook } from '@testing-library/react';
import { emitEvent, eventBusService, handleWarning } from '../appEventHandler';
import { failedResponseEvent, responseWarningEvent } from '../constants';
import { useQueryMessages } from '../components/useQueryMessages';

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

  it('shows a GraphQL series message on the row it came from, and adds up warnings', () => {
    const { result, unmount } = renderHook(() => useQueryMessages('A'));

    act(() => {
      emitEvent(failedResponseEvent, { refId: 'A_fdm_2', error: 'series 2 failed' });
      handleWarning('series 0 is empty', 'A_fdm_0');
      handleWarning('series 1 is empty', 'A_fdm_1');
      handleWarning('series 1 is empty', 'A_fdm_1');
      handleWarning('not this row', 'AB_fdm_0');
    });
    expect(result.current.errorMessage).toBe('series 2 failed');
    expect(result.current.warningMessage).toBe('series 0 is empty\n\nseries 1 is empty');

    // The empty warning sent before each run clears what had added up.
    act(() => handleWarning('', 'A'));
    expect(result.current.warningMessage).toBe('');
    unmount();
  });
});
