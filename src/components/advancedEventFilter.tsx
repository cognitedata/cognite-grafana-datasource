import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button, Tooltip } from '@grafana/ui';
import CodeMirror from 'codemirror';
import jsonlint from 'jsonlint-mod';
import 'codemirror/addon/hint/show-hint';
import 'codemirror/addon/lint/lint';
import 'codemirror/addon/lint/json-lint';
import 'codemirror/addon/lint/javascript-lint';
import 'codemirror/mode/javascript/javascript';
import 'codemirror/addon/hint/javascript-hint';
import 'codemirror/addon/edit/closebrackets';
import { EventQuery } from '../types';
import 'codemirror/lib/codemirror.css';
import 'codemirror/addon/lint/lint.css';
import '../css/dracula.css';
import { EventAdvancedFilterHelp } from './queryHelp';

// eslint-disable-next-line @typescript-eslint/dot-notation
window['jsonlint'] = jsonlint;

export const AdvancedEventFilter = (props) => {
  const { query, onQueryChange } = props;
  const textAreaRef = useRef(null);
  const [showHelp, setShowHelp] = useState(false);
  const [editor, setEditor] = useState<CodeMirror.EditorFromTextArea | null>(null);

  const [eventQuery, setEventQuery] = useState(query.eventQuery);
  const patchEventQuery = useCallback(
    (eventQueryPatch: Partial<EventQuery>) => {
      setEventQuery({ ...eventQuery, ...eventQueryPatch });
    },
    [eventQuery]
  );

  const triggerQuery = useCallback(() => {
    onQueryChange({
      eventQuery,
    });
  }, [eventQuery, onQueryChange]);
  useEffect(() => {
    if (textAreaRef.current) {
      const editor = CodeMirror.fromTextArea(textAreaRef.current, {
        mode: 'application/json',
        theme: 'dracula',
        lineNumbers: true,
        lineWrapping: true,
        autoCloseBrackets: true,
        gutters: ['CodeMirror-lint-markers'],
        lint: true,
      });
      setEditor(editor);
      editor.getDoc().setValue(query.eventQuery.advancedFilter);
    }
  }, [textAreaRef]);

  useEffect(() => {
    if (editor != null) {
      editor.setOption('lint', editor.getValue().trim());
      const handleChange = () => {
        patchEventQuery({ advancedFilter: editor.getDoc().getValue() });
      };

      const handleBlur = () => {
        triggerQuery();
      };

      editor.getDoc().on('change', handleChange);
      editor.on('blur', handleBlur);
      return () => {
        editor.getDoc().off('change', handleChange);
        editor.off('blur', handleBlur);
      };
    }

    return undefined;
  }, [editor, patchEventQuery, triggerQuery]);

  return (
    <>
      <div className="gf-form gf-form--grow">
        <Tooltip content="click here for more information">
          <Button
            variant="secondary"
            icon="question-circle"
            onClick={() => setShowHelp(!showHelp)}
          />
        </Tooltip>
        <span className="gf-form-label query-keyword fix-query-keyword width-8">
          Advanced Query
        </span>
        <textarea ref={textAreaRef} name="eventQuery" />
      </div>
      {showHelp && <EventAdvancedFilterHelp onDismiss={() => setShowHelp(false)} />}
    </>
  );
};
