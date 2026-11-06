/**
 * Debounced Monaco markers for the plugin's code editors: a function from the text
 * to markers, wired to an editor so they follow every edit.
 */
import type { Monaco, monacoTypes } from '@grafana/ui';

const DEBOUNCE_MS = 300;

/** Removes the markers and stops checking; `refresh` checks the text again now. */
export type DiagnosticsHandle = (() => void) & { refresh: () => void };

/** A problem in the text, located by character offsets. */
export interface CodeMarker {
  severity: 'error' | 'warning' | 'info' | 'hint';
  message: string;
  startOffset: number;
  endOffset: number;
}

const MONACO_SEVERITY: Record<CodeMarker['severity'], (monaco: Monaco) => number> = {
  error: (monaco) => monaco.MarkerSeverity.Error,
  warning: (monaco) => monaco.MarkerSeverity.Warning,
  info: (monaco) => monaco.MarkerSeverity.Info,
  hint: (monaco) => monaco.MarkerSeverity.Hint,
};

const toMonacoMarkers = (
  monaco: Monaco,
  model: monacoTypes.editor.ITextModel,
  markers: CodeMarker[]
): monacoTypes.editor.IMarkerData[] =>
  markers.map(({ severity, message, startOffset, endOffset }) => {
    const start = model.getPositionAt(startOffset);
    const end = model.getPositionAt(endOffset);
    return {
      severity: MONACO_SEVERITY[severity](monaco),
      message,
      startLineNumber: start.lineNumber,
      startColumn: start.column,
      endLineNumber: end.lineNumber,
      endColumn: end.column,
    };
  });

/**
 * Attaches debounced validation to an editor. Returns a disposer; call it when
 * the editor unmounts. Its `refresh` re-checks at once, for a change outside the text. `compute` is called with the current text, so markers
 * follow view or variable changes without rewiring.
 */
export const wireDiagnostics = (
  editor: monacoTypes.editor.IStandaloneCodeEditor,
  monaco: Monaco,
  compute: (text: string) => CodeMarker[],
  owner: string
): DiagnosticsHandle => {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const validate = () => {
    const model = editor.getModel();
    if (!model) {
      return;
    }
    monaco.editor.setModelMarkers(
      model,
      owner,
      toMonacoMarkers(monaco, model, compute(model.getValue()))
    );
  };
  const subscription = editor.onDidChangeModelContent(() => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(validate, DEBOUNCE_MS);
  });
  validate();
  const dispose = () => {
    if (timeout) {
      clearTimeout(timeout);
    }
    subscription.dispose();
    const model = editor.getModel();
    if (model) {
      monaco.editor.setModelMarkers(model, owner, []);
    }
  };
  return Object.assign(dispose, { refresh: validate });
};
