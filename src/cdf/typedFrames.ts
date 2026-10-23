import { DataFrame, FieldType } from '@grafana/data';

/**
 * Frames for series whose values are not numbers. The numeric path keeps returning
 * legacy `TimeSeries`, which Grafana always reads as numbers; text values need a
 * frame with a string field so the table and state timeline panels show them.
 *
 * Built as plain objects (arrays as field values) so they work on every Grafana
 * version the plugin supports.
 */
export function stringSeriesFrame(
  name: string,
  points: Array<{ timestamp: number; value: string | null }>
): DataFrame {
  return {
    name,
    length: points.length,
    fields: [
      { name: 'Time', type: FieldType.time, config: {}, values: points.map((p) => p.timestamp) },
      {
        // Named after the series: Explore's table merges frames that are not time
        // series by field name, so text fields all called "Value" were stacked into
        // one column.
        name,
        type: FieldType.string,
        config: { displayNameFromDS: name },
        values: points.map((p) => p.value),
      },
    ],
  };
}
