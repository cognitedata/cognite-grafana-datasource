import React, { useCallback, useEffect, useState } from 'react';
import { Button, CodeEditor, Tooltip } from '@grafana/ui';
import jsonlint from 'jsonlint-mod';
import { EventQuery } from '../types';
import { EventAdvancedFilterHelp } from './queryHelp';

export const AdvancedEventFilter = (props) => {
  const { query, onQueryChange } = props;
  const [eventQuery, setEventQuery] = useState(query.eventQuery);
  const [showHelp, setShowHelp] = useState(false);
  const patchEventQuery = useCallback(
    (eventQueryPatch: Partial<EventQuery>) => {
      setEventQuery({ ...eventQuery, ...eventQueryPatch });
    },
    [eventQuery]
  );
  useEffect(() => {
    onQueryChange({
      eventQuery,
    });
  }, [eventQuery]);
  const valid = (advancedFilter): boolean => {
    return jsonlint.parse(advancedFilter) ?? false;
  };
  const onChange = (advancedFilter) => {
    if (valid(advancedFilter)) patchEventQuery({ advancedFilter });
  };

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
        <CodeEditor
          value={eventQuery.advancedFilter ?? ''}
          language="json"
          height={200}
          width="80rem"
          showLineNumbers
          showMiniMap
          onBlur={onChange}
          onSave={onChange}
        />
      </div>
      {showHelp && <EventAdvancedFilterHelp onDismiss={() => setShowHelp(false)} />}
    </>
  );
};
