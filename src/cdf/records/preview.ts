/** The request preview, built by the same steps the datasource runs. */
import { RecordsQuery, Tuple } from '../../types';
import { StreamDefinition } from '../../types/records';
import { buildRecordsAggregateRequest } from './aggregate';
import {
  RecordsBuildOptions,
  applyStreamConstraints,
  buildRecordsFilterRequest,
  streamBuildOptions,
} from './request';

/**
 * The request the datasource sends for a query, rendered for the editor's read-only
 * preview so it can be copied and replayed as is. The query must arrive interpolated,
 * as the datasource interpolates it. Kept here so it can be tested directly.
 */
export interface RecordsRequestPreviewParts {
  /** e.g. "POST /api/v1/projects/my-project/streams/my-stream/records/filter" */
  path: string;
  /** Pretty-printed JSON request body; empty when the builder failed */
  body: string;
  error?: string;
}

/** Structured preview so the editor can style the path and body separately. */
export function buildRequestPreviewParts(
  query: RecordsQuery,
  range: Tuple<number> | null,
  options: RecordsBuildOptions = {},
  stream: StreamDefinition | null = null
): RecordsRequestPreviewParts | null {
  const { view, mode } = query;
  if (!view?.streamId) {
    return null;
  }
  const endpoint = mode === 'aggregate' ? 'aggregate' : 'filter';
  const project = options.project?.trim() || '{project}';
  const path = `POST /api/v1/projects/${project}/streams/${view.streamId}/records/${endpoint}`;
  // The datasource's own steps, in its order: the query arrives interpolated, the
  // stream's options and rules apply, then the same builder runs.
  const buildOptions = streamBuildOptions(stream, options);
  const effective = range ? applyStreamConstraints(query, stream, range, buildOptions).query : query;
  try {
    const body =
      mode === 'aggregate'
        ? buildRecordsAggregateRequest(effective, range, buildOptions).request
        : buildRecordsFilterRequest(effective, range, buildOptions);
    return { path, body: JSON.stringify(body, null, 2) };
  } catch (error) {
    return { path, body: '', error: String(error) };
  }
}
