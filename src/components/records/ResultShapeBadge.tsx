import React from 'react';
import { Badge } from '@grafana/ui';
import { RecordsBucket } from '../../types';
import { deriveResultShape } from '../../cdf/records';

export const ResultShapeBadge = ({ buckets }: { buckets: RecordsBucket[] }) => {
  const shape = deriveResultShape(buckets);
  if (shape.kind === 'timeseries') {
    return (
      <Badge
        color="green"
        icon="chart-line"
        text={
          'Time series' +
          (shape.seriesBy.length ? ` · one series per ${shape.seriesBy.join(' · ')}` : '')
        }
        tooltip="Derived from the Group by buckets: a time bucket produces a time field."
      />
    );
  }
  if (shape.kind === 'table') {
    return (
      <Badge
        color="purple"
        icon="table"
        text={`Table · grouped by ${shape.groupBy.join(' · ')}`}
        tooltip="No time bucket: the result renders as a table, one row per group."
      />
    );
  }
  return (
    <Badge
      color="darkgrey"
      icon="calculator-alt"
      text="Single row"
      tooltip="No buckets: the metrics collapse to a single row of totals."
    />
  );
};
