import React, { useState, useRef, useEffect, useCallback } from 'react';
import CodeMirror from 'codemirror';
import 'codemirror/lib/codemirror.css';
import '../css/dracula.css';
import 'codemirror/addon/hint/show-hint';
import 'codemirror/addon/lint/lint';
import { EventQuery } from '../types';

export const AdvancedEventFilter = (props) => {
  const { query, onQueryChange } = props;
  const textAreaRef = useRef(null);
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
        mode: { name: 'javascript', json: true },
        theme: 'dracula',
        /* lint: {
          schema: myGraphQLSchema,
          validationRules: [ExampleRule],
        },
        hintOptions: {
          schema: myGraphQLSchema,
        }, */
      });
      setEditor(editor);
      editor.getDoc().setValue(query.eventQuery.eventQuery);
    }
  }, [textAreaRef]);

  useEffect(() => {
    if (editor != null) {
      const handleChange = () => {
        patchEventQuery({ eventQuery: editor.getDoc().getValue() });
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
    <div className="gf-form gf-form--grow">
      <span className="gf-form-label query-keyword fix-query-keyword width-10">Query</span>
      <textarea ref={textAreaRef} name="eventQuery" />
    </div>
  );
};
