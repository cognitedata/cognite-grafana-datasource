import { TOP_LEVEL_PROPERTIES } from './records/schema';

/**
 * Properties every data modelling instance carries at the top level, outside any
 * view: offered after a view's own properties, marked as instance properties. The
 * same four a record carries, so taken from the records' list.
 */
export const INSTANCE_PROPERTIES: Array<{ name: string; type: string }> = TOP_LEVEL_PROPERTIES.map(
  ({ name, type }) => ({ name, type })
);
