import { renderHook } from '@testing-library/react';
import { PanelData } from '@grafana/data';
import { QueryMessages, rowRefIdOf } from '../queryMessages';
import { useQueryWarnings } from '../components/useQueryMessages';

describe('QueryMessages', () => {
  it('puts errors in the response, once each, under the query row', () => {
    const messages = new QueryMessages();
    messages.error(new Error('boom'), 'A');
    messages.error(new Error('boom'), 'A');
    messages.error({ status: 400, data: { error: { message: 'bad series' } } }, 'B_fdm_2');
    const { errors } = messages.attachTo({ data: [] });
    expect(errors).toEqual([
      { refId: 'A', message: 'boom' },
      { refId: 'B', message: 'bad series', status: 400 },
    ]);
  });

  it('gives an error with no row of its own to the panel', () => {
    const messages = new QueryMessages();
    messages.error(new Error('stream closed'), '');
    expect(messages.attachTo({ data: [] }).errors).toEqual([{ message: 'stream closed' }]);
  });

  it('does not treat a request a newer one cancelled as a failure', () => {
    const messages = new QueryMessages();
    messages.error({ cancelled: true }, 'A');
    expect(messages.attachTo({ data: [] }).errors).toBeUndefined();
  });

  it("hangs warnings on the query's frame, or on an empty one when nothing came back", () => {
    const messages = new QueryMessages();
    messages.warning('capped', 'A');
    messages.warning('skipped some', 'B');
    messages.warning('', 'B');
    const { data } = messages.attachTo({ data: [{ refId: 'A', fields: [], length: 0 }] });
    expect(data[0].meta.notices).toEqual([{ severity: 'warning', text: 'capped' }]);
    expect(data[1]).toMatchObject({
      refId: 'B',
      fields: [],
      meta: { notices: [{ severity: 'warning', text: 'skipped some' }] },
    });
  });

  it('keeps the errors the response already has', () => {
    const messages = new QueryMessages();
    messages.error(new Error('mine'), 'A');
    const { errors } = messages.attachTo({
      data: [],
      errors: [{ refId: 'B', message: 'records' }],
    });
    expect(errors).toHaveLength(2);
  });

  it("reads a GraphQL series' refId as its row's", () => {
    expect(rowRefIdOf('A_fdm_12')).toBe('A');
    expect(rowRefIdOf('A')).toBe('A');
  });
});

describe('useQueryWarnings', () => {
  const data = {
    series: [
      {
        refId: 'A_fdm_0',
        fields: [],
        length: 0,
        meta: { notices: [{ severity: 'warning', text: 'capped' }] },
      },
      {
        refId: 'B',
        fields: [],
        length: 0,
        meta: { notices: [{ severity: 'warning', text: 'not mine' }] },
      },
    ],
    errors: [
      { refId: 'A_fdm_1', message: 'bad series' },
      { refId: 'A', message: 'bad series' },
      { refId: 'B', message: 'not mine' },
      { message: 'the whole panel' },
    ],
  } as unknown as PanelData;

  it("shows the latest run's warnings for its own row only", () => {
    const { result, rerender } = renderHook(({ refId }) => useQueryWarnings(data, refId), {
      initialProps: { refId: 'A' },
    });
    expect(result.current).toBe('capped');
    rerender({ refId: 'C' });
    expect(result.current).toBe('');
  });
});
