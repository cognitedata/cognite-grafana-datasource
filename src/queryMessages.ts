import { DataFrame, DataQueryError, DataQueryResponse, QueryResultMetaNotice } from '@grafana/data';

/**
 * The query row a message belongs to. The GraphQL tab fetches each of a row's series
 * under its own refId (`A_fdm_0`, `A_fdm_1`, …); those messages are the row's.
 */
export const rowRefIdOf = (refId: string | undefined): string =>
  (refId ?? '').replace(/_fdm_\d+$/, '');

/**
 * The most specific message an error carries, plain: CDF's own message, and the
 * items it could not find. Grafana shows the status apart, so it is not repeated.
 */
export const errorMessageOf = (error: any): string => {
  const message = error?.data?.error?.message ?? error?.data?.error ?? error?.message;
  const missing = error?.data?.error?.missing?.map((item: unknown) => JSON.stringify(item));
  const text =
    typeof message === 'string' && message
      ? message
      : typeof error === 'string' && error
        ? error
        : 'Unknown error';
  return missing?.length ? `${text} Missing: ${missing.join(', ')}` : text;
};

const isCancelled = (error: unknown) =>
  !!error && typeof error === 'object' && (error as { cancelled?: boolean }).cancelled === true;

type Message = { text: string; status?: number };

const add = (messages: Map<string, Message[]>, refId: string | undefined, message: Message) => {
  if (!message.text) {
    return;
  }
  const row = rowRefIdOf(refId);
  const current = messages.get(row) ?? [];
  if (!current.some(({ text }) => text === message.text)) {
    messages.set(row, [...current, message]);
  }
};

type Frame = DataFrame | { refId?: string; meta?: DataFrame['meta'] };

/**
 * What one run of the datasource has to say about its queries. Created per request,
 * so two panels both querying "A" never mix their messages up. Errors go to the
 * response's `errors`, which Grafana shows on the query row, the panel and Explore;
 * warnings become notices on the query's frames, which the panel shows as a warning.
 */
export class QueryMessages {
  private readonly errors = new Map<string, Message[]>();
  private readonly warnings = new Map<string, Message[]>();

  /** A query failed. A request cancelled by a newer one is not a failure. */
  error(error: unknown, refId: string) {
    if (!isCancelled(error)) {
      const status = (error as { status?: unknown } | undefined)?.status;
      add(this.errors, refId, {
        text: errorMessageOf(error),
        ...(typeof status === 'number' ? { status } : {}),
      });
    }
  }

  /** A query ran, but the user should know something about its result. */
  warning(message: string | undefined, refId: string) {
    add(this.warnings, refId, { text: message ?? '' });
  }

  /** The response with this run's messages in it. */
  attachTo(response: DataQueryResponse): DataQueryResponse {
    const data: Frame[] = [...(response.data ?? [])];
    this.warnings.forEach((messages, refId) => {
      const notices: QueryResultMetaNotice[] = messages.map(({ text }) => ({
        severity: 'warning',
        text,
      }));
      const index = data.findIndex((frame) => frame.refId && rowRefIdOf(frame.refId) === refId);
      if (index === -1) {
        // Nothing came back to hang the warning on: an empty frame carries it.
        data.push({ refId, name: '', fields: [], length: 0, meta: { notices } } as DataFrame);
        return;
      }
      const frame = data[index];
      data[index] = {
        ...frame,
        meta: { ...frame.meta, notices: [...(frame.meta?.notices ?? []), ...notices] },
      };
    });
    const errors: DataQueryError[] = [...(response.errors ?? [])];
    this.errors.forEach((messages, refId) =>
      messages.forEach(({ text, status }) =>
        // An error with no row of its own is the panel's.
        errors.push({
          ...(refId ? { refId } : {}),
          message: text,
          ...(status !== undefined ? { status } : {}),
        })
      )
    );
    return { ...response, data, ...(errors.length ? { errors } : {}) };
  }
}

/** The warnings a run left on a query row's frames, for the query editor to show. */
export const warningsForRow = (series: Frame[] | undefined, refId: string): string[] =>
  (series ?? [])
    .filter((frame) => frame.refId && rowRefIdOf(frame.refId) === refId)
    .flatMap((frame) => frame.meta?.notices ?? [])
    .filter(({ severity }) => severity === 'warning')
    .map(({ text }) => text)
    .filter((text, i, all) => all.indexOf(text) === i);
