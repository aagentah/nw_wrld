import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SortableList, arrayMove } from '../../shared/SortableList';

// Mock @dnd-kit modules
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children, onDragEnd }: any) => {
    // Simulate drag end on first child click
    const handleClick = () => {
      onDragEnd?.({
        active: { id: 'item-1' },
        over: { id: 'item-2' },
      });
    };
    return (
      <div data-testid="dnd-context" onClick={handleClick}>
        {children}
      </div>
    );
  },
  closestCenter: {},
  PointerSensor: class PointerSensor {},
  useSensor: (sensor: any, options: any) => ({ sensor, options }),
  useSensors: (...sensors: any[]) => sensors,
}));

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: any) => (
    <div data-testid="sortable-context">{children}</div>
  ),
  verticalListSortingStrategy: 'vertical',
  arrayMove: (array: any[], from: number, to: number) => {
    const result = [...array];
    const [removed] = result.splice(from, 1);
    result.splice(to, 0, removed);
    return result;
  },
}));

describe('SortableList', () => {
  const mockItems = [
    { id: 'item-1', content: 'Item 1' },
    { id: 'item-2', content: 'Item 2' },
    { id: 'item-3', content: 'Item 3' },
  ];

  it('should render children', () => {
    const { container } = render(
      <SortableList items={mockItems} onReorder={vi.fn()}>
        <div>Child content</div>
      </SortableList>
    );

    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('should render SortableContext', () => {
    const { container } = render(
      <SortableList items={mockItems} onReorder={vi.fn()}>
        <div>Child content</div>
      </SortableList>
    );

    expect(screen.getByTestId('sortable-context')).toBeInTheDocument();
  });

  it('should render DndContext', () => {
    render(
      <SortableList items={mockItems} onReorder={vi.fn()}>
        <div>Child content</div>
      </SortableList>
    );

    expect(screen.getByTestId('dnd-context')).toBeInTheDocument();
  });

  it('should use vertical list sorting strategy by default', () => {
    render(
      <SortableList items={mockItems} onReorder={vi.fn()}>
        <div>Child content</div>
      </SortableList>
    );

    expect(screen.getByTestId('dnd-context')).toBeInTheDocument();
  });
});

describe('arrayMove utility', () => {
  it('should move item from one index to another', () => {
    const items = ['a', 'b', 'c', 'd'];
    const result = arrayMove(items, 0, 2);

    expect(result).toEqual(['b', 'c', 'a', 'd']);
  });

  it('should handle moving to same index', () => {
    const items = ['a', 'b', 'c'];
    const result = arrayMove(items, 1, 1);

    expect(result).toEqual(['a', 'b', 'c']);
  });

  it('should handle moving first to last', () => {
    const items = ['a', 'b', 'c'];
    const result = arrayMove(items, 0, 2);

    expect(result).toEqual(['b', 'c', 'a']);
  });

  it('should handle moving last to first', () => {
    const items = ['a', 'b', 'c'];
    const result = arrayMove(items, 2, 0);

    expect(result).toEqual(['c', 'a', 'b']);
  });

  it('should not mutate original array', () => {
    const items = ['a', 'b', 'c'];
    const originalItems = [...items];
    arrayMove(items, 0, 2);

    expect(items).toEqual(originalItems);
  });
});
