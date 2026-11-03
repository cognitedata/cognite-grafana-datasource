import React from 'react';
import { RecordsSortRow } from '../../types';
import { RecordViewDefinition } from '../../types/records';
import { propertyOptions } from './shared';
import { PropertySortEditor } from '../common/PropertySortEditor';

interface SortEditorProps {
  sort: RecordsSortRow[];
  viewDef: RecordViewDefinition | null;
  onChange: (sort: RecordsSortRow[]) => void;
}

export const SortEditor = ({ sort, viewDef, onChange }: SortEditorProps) => {
  /**
   * Sorting goes through the container property. The
   * mapping is captured here so the request builder stays pure.
   */
  const withContainer = (property: string, direction: 'asc' | 'desc'): RecordsSortRow => {
    const mapped = viewDef?.properties?.[property];
    return {
      property,
      direction,
      containerSpace: mapped?.container?.space,
      containerExternalId: mapped?.container?.externalId,
      containerPropertyIdentifier: mapped?.containerPropertyIdentifier,
    };
  };

  return (
    <PropertySortEditor
      rows={sort}
      options={propertyOptions(viewDef)}
      max={5}
      testIdPrefix="records"
      newRow={withContainer('', 'desc')}
      // Only the row whose property is picked is re-mapped; the others keep theirs.
      withProperty={(row, property) => withContainer(property, row.direction)}
      tooltip="Select one or more properties to sort the results by."
      onChange={onChange}
    />
  );
};
