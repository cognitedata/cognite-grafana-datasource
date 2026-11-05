import React, { useState } from 'react';
import { Button, Stack } from '@grafana/ui';
import { moveItem } from '../records/shared';

interface RowListProps<T> {
  items: T[];
  onChange: (items: T[]) => void;
  /**
   * One row, as plugin-ui's EditorList renders it: the item, a setter for it and a
   * remover, plus its index for ids and labels and a mover for rows that reorder.
   */
  renderItem: (
    item: T,
    onChangeItem: (next: T) => void,
    onDeleteItem: () => void,
    index: number,
    onMoveItem: (delta: -1 | 1) => void
  ) => React.ReactNode;
  /** The row the add button appends, already filled with the row's defaults. */
  newItem: () => T;
  /** The add button's text, e.g. "Add filter". */
  addLabel: string;
  /** The most rows; the add button goes away once they are all there. */
  max?: number;
  /** False hides the add button below the maximum too, e.g. when nothing is left to add. */
  canAdd?: boolean;
  addTestId?: string;
}

let lastKey = 0;
const freshKey = () => ++lastKey;

/**
 * A column of add and remove rows in the shape of plugin-ui's EditorList, which these
 * tabs can't use as it is: it has no maximum, its add button has no label, and a new
 * row starts as `{}` instead of on its defaults. Rows also stack instead of wrapping.
 */
export const RowList = <T,>({
  items,
  onChange,
  renderItem,
  newItem,
  addLabel,
  max = Infinity,
  canAdd = true,
  addTestId,
}: RowListProps<T>) => {
  // One key per row that follows it through adds, removes and moves, so a removed
  // row's state (a search, an open menu) doesn't pass to the row taking its place.
  // Rows that arrive from outside, such as a loaded query, get new keys.
  const [keys, setKeys] = useState(() => items.map(freshKey));
  let rowKeys = keys;
  if (keys.length !== items.length) {
    rowKeys = items.map(freshKey);
    setKeys(rowKeys);
  }
  const update = (nextItems: T[], nextKeys: number[]) => {
    setKeys(nextKeys);
    onChange(nextItems);
  };
  return (
    <Stack direction="column" gap={0.5} alignItems="flex-start">
      {items.map((item, index) => (
        <React.Fragment key={rowKeys[index]}>
          {renderItem(
            item,
            (next) => onChange(items.map((old, i) => (i === index ? next : old))),
            () =>
              update(
                items.filter((_, i) => i !== index),
                rowKeys.filter((_, i) => i !== index)
              ),
            index,
            (delta) => update(moveItem(items, index, delta), moveItem(rowKeys, index, delta))
          )}
        </React.Fragment>
      ))}
      {canAdd && items.length < max && (
        <Button
          variant="secondary"
          size="sm"
          icon="plus"
          data-testid={addTestId}
          onClick={() => update([...items, newItem()], [...rowKeys, freshKey()])}
        >
          {addLabel}
        </Button>
      )}
    </Stack>
  );
};
