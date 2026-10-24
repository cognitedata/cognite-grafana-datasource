import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { css, cx } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { CodeEditor, useStyles2, type Monaco, type monacoTypes } from '@grafana/ui';

export interface OneLineCodeEditorHandle {
  getValue: () => string;
  /** Replaces the text in place; Grafana's CodeEditor does not re-sync `value` after mount. */
  setValue: (value: string) => void;
}

interface OneLineCodeEditorProps {
  value: string;
  language: string;
  /** Width in theme spacing units, like Input's `width`, or "fill" for the parent's width. */
  width?: number | 'fill';
  placeholder?: string;
  invalid?: boolean;
  /** Wrap long text onto more lines and grow with it, instead of scrolling sideways. */
  wrap?: boolean;
  testId?: string;
  onCommit: (value: string) => void;
  onEditorDidMount?: (editor: monacoTypes.editor.IStandaloneCodeEditor, monaco: Monaco) => void;
}

const EDITOR_HEIGHT = 20;
/** Long text wraps onto more lines, up to this many; past it the editor scrolls. */
const MAX_LINES = 6;

const getStyles = (theme: GrafanaTheme2) => ({
  box: css({
    position: 'relative',
    minHeight: theme.spacing(4),
    padding: theme.spacing(0.75, 1),
    border: `1px solid ${theme.components.input.borderColor}`,
    borderRadius: theme.shape.radius.default,
    background: theme.components.input.background,
    '&:focus-within': {
      outline: `2px solid ${theme.colors.primary.main}`,
      outlineOffset: -2,
    },
  }),
  invalid: css({
    borderColor: theme.colors.error.border,
  }),
  placeholder: css({
    position: 'absolute',
    // Above Monaco's own layers, which are positioned and come later in the DOM.
    zIndex: 1,
    top: theme.spacing(0.75),
    left: theme.spacing(1.75),
    color: theme.colors.text.disabled,
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: 14,
    lineHeight: `${EDITOR_HEIGHT}px`,
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    right: theme.spacing(1),
  }),
});

const MONACO_OPTIONS = {
  // Follows its cell when the row's width changes.
  automaticLayout: true,
  lineNumbers: 'off',
  glyphMargin: false,
  folding: false,
  lineDecorationsWidth: 4,
  lineNumbersMinChars: 0,
  renderLineHighlight: 'none',
  overviewRulerLanes: 0,
  overviewRulerBorder: false,
  hideCursorInOverviewRuler: true,
  scrollbar: { vertical: 'hidden', horizontal: 'hidden', alwaysConsumeMouseWheel: false },
  scrollBeyondLastLine: false,
  scrollBeyondLastColumn: 2,
  wordWrap: 'off',
  contextmenu: false,
  fixedOverflowWidgets: true,
  fontSize: 14,
  lineHeight: EDITOR_HEIGHT,
  padding: { top: 0, bottom: 0 },
} as const;

/** Wraps instead of scrolling sideways, and grows a line at a time (see handleMount). */
const WRAPPING_OPTIONS = {
  ...MONACO_OPTIONS,
  wordWrap: 'on',
  scrollbar: { ...MONACO_OPTIONS.scrollbar, vertical: 'auto' },
} as const;

/**
 * A Monaco editor dressed as a single-line input: Enter commits instead of
 * inserting a newline (unless a completion is being picked), pasted newlines
 * collapse to spaces, and the text commits on blur like a BlurInput. With `wrap`,
 * text too long for the width wraps and the editor grows with it, as Grafana's
 * Prometheus and Loki query fields do; without it the text scrolls, like an input.
 */
export const OneLineCodeEditor = forwardRef<OneLineCodeEditorHandle, OneLineCodeEditorProps>(
  (
    { value, language, width = 40, placeholder, invalid, wrap, testId, onCommit, onEditorDidMount },
    ref
  ) => {
    const styles = useStyles2(getStyles);
    const [empty, setEmpty] = useState(!value);
    const [height, setHeight] = useState(EDITOR_HEIGHT);
    const editorRef = useRef<monacoTypes.editor.IStandaloneCodeEditor | null>(null);
    // Read at commit time, so the Monaco command registered on mount sees the latest callback.
    const commitRef = useRef(onCommit);
    commitRef.current = onCommit;

    useImperativeHandle(ref, () => ({
      getValue: () => editorRef.current?.getValue() ?? value,
      setValue: (next: string) => {
        editorRef.current?.setValue(next);
        setEmpty(!next);
      },
    }));

    const handleMount = (editor: monacoTypes.editor.IStandaloneCodeEditor, monaco: Monaco) => {
      editorRef.current = editor;
      if (monaco) {
        const commit = () => commitRef.current(editor.getValue());
        editor.addCommand(monaco.KeyCode.Enter, commit, '!suggestWidgetVisible');
        editor.addCommand(
          monaco.KeyMod.Shift | monaco.KeyCode.Enter,
          commit,
          '!suggestWidgetVisible'
        );
        // Cmd/Ctrl+F would open Monaco's find bar inside a one-line field.
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => {});
        if (wrap) {
          editor.onDidContentSizeChange(({ contentHeight }) =>
            setHeight(Math.min(MAX_LINES * EDITOR_HEIGHT, Math.max(EDITOR_HEIGHT, contentHeight)))
          );
        }
        const model = editor.getModel();
        model?.onDidChangeContent(() => {
          if (model.getLineCount() > 1) {
            editor.executeEdits('single-line', [
              { range: model.getFullModelRange(), text: model.getValue().replace(/[\r\n]+/g, ' ') },
            ]);
          }
        });
      }
      onEditorDidMount?.(editor, monaco);
    };

    return (
      <div
        className={cx(styles.box, invalid && styles.invalid)}
        style={width === 'fill' ? { flex: '1 1 auto', minWidth: 0 } : { width: `${width * 8}px` }}
        data-testid={testId}
      >
        {empty && placeholder && <span className={styles.placeholder}>{placeholder}</span>}
        <CodeEditor
          value={value}
          language={language}
          height={height}
          showMiniMap={false}
          showLineNumbers={false}
          monacoOptions={(wrap ? WRAPPING_OPTIONS : MONACO_OPTIONS) as any}
          onChange={(text) => setEmpty(!text)}
          onBlur={(text) => commitRef.current(text)}
          onSave={(text) => commitRef.current(text)}
          onEditorDidMount={handleMount}
        />
      </div>
    );
  }
);
OneLineCodeEditor.displayName = 'OneLineCodeEditor';
