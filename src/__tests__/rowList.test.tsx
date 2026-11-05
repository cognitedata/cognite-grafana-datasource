import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { RowList } from '../components/common/RowList';

const renderList = (items: string[], max?: number) => {
  const onChange = jest.fn();
  render(
    <RowList
      items={items}
      onChange={onChange}
      newItem={() => 'new'}
      addLabel="Add row"
      max={max}
      renderItem={(item, onChangeItem, onDelete, index) => (
        <span>
          <span>{item}</span>
          <button onClick={() => onChangeItem(`${item}!`)}>change {index}</button>
          <button onClick={onDelete}>remove {index}</button>
        </span>
      )}
    />
  );
  return onChange;
};

describe('RowList', () => {
  it('appends a row on its defaults', () => {
    const onChange = renderList(['a']);
    fireEvent.click(screen.getByText('Add row'));
    expect(onChange).toHaveBeenCalledWith(['a', 'new']);
  });

  it('changes and removes one row, leaving the others', () => {
    const onChange = renderList(['a', 'b']);
    fireEvent.click(screen.getByText('change 1'));
    expect(onChange).toHaveBeenLastCalledWith(['a', 'b!']);
    fireEvent.click(screen.getByText('remove 0'));
    expect(onChange).toHaveBeenLastCalledWith(['b']);
  });

  it('stops offering rows at the maximum', () => {
    renderList(['a', 'b'], 2);
    expect(screen.queryByText('Add row')).toBeNull();
  });

  it('offers rows without a maximum, under its test id, until canAdd is false', () => {
    const props = {
      onChange: jest.fn(),
      newItem: () => 'new',
      addLabel: 'Add row',
      addTestId: 'add-row',
    };
    const { rerender } = render(<RowList {...props} items={['a']} renderItem={(item) => item} />);
    expect(screen.getByTestId('add-row')).toHaveTextContent('Add row');
    rerender(<RowList {...props} items={['a']} canAdd={false} renderItem={(item) => item} />);
    expect(screen.queryByTestId('add-row')).toBeNull();
  });

  it("keeps each row's own state when an earlier row is removed or rows move", () => {
    // A row with local state, like a picker's search text.
    const Row = ({ item }: { item: string }) => {
      const [draft] = useState(item);
      return <span data-testid="row">{`${item}:${draft}`}</span>;
    };
    const Harness = () => {
      const [items, setItems] = useState(['a', 'b', 'c']);
      return (
        <RowList
          items={items}
          onChange={setItems}
          newItem={() => 'new'}
          addLabel="Add row"
          renderItem={(item, _change, onDelete, index, onMove) => (
            <span>
              <Row item={item} />
              <button onClick={onDelete}>remove {index}</button>
              <button onClick={() => onMove(1)}>down {index}</button>
            </span>
          )}
        />
      );
    };
    render(<Harness />);
    const rows = () => screen.getAllByTestId('row').map((row) => row.textContent);
    fireEvent.click(screen.getByText('remove 0'));
    expect(rows()).toEqual(['b:b', 'c:c']);
    fireEvent.click(screen.getByText('down 0'));
    expect(rows()).toEqual(['c:c', 'b:b']);
  });
});
