import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SortableWrapper } from '../../shared/SortableWrapper';

// Mock @dnd-kit/sortable
const mockTransform = { x: 0, y: 0, scaleX: 1, scaleY: 1 };
vi.mock('@dnd-kit/sortable', () => ({
  useSortable: ({ id, disabled }: { id: string; disabled: boolean }) => ({
    attributes: { 'data-id': id },
    listeners: { onClick: vi.fn() },
    setNodeRef: vi.fn(),
    transform: disabled ? null : mockTransform,
    transition: disabled ? null : 'transform 200ms',
    isDragging: false,
  }),
}));

describe('SortableWrapper', () => {
  it('should render children as function', () => {
    const renderProp = vi.fn(({ dragHandleProps, isDragging }) => (
      <div data-dragging={isDragging} {...dragHandleProps}>
        Drag me
      </div>
    ));

    render(<SortableWrapper id="test-id">{renderProp}</SortableWrapper>);

    expect(renderProp).toHaveBeenCalledWith(
      expect.objectContaining({
        dragHandleProps: expect.objectContaining({
          'data-id': 'test-id',
        }),
        isDragging: false,
      })
    );
    expect(screen.getByText('Drag me')).toBeInTheDocument();
  });

  it('should pass drag handle props to children', () => {
    const renderProp = ({ dragHandleProps }: any) => (
      <div {...dragHandleProps}>Item</div>
    );

    const { container } = render(
      <SortableWrapper id="item-1">{renderProp}</SortableWrapper>
    );

    const item = container.querySelector('[data-id="item-1"]');
    expect(item).toBeInTheDocument();
  });

  it('should pass isDragging state to children', () => {
    const renderProp = ({ isDragging }: any) => (
      <div data-dragging={isDragging}>Item</div>
    );

    const { container } = render(
      <SortableWrapper id="item-1">{renderProp}</SortableWrapper>
    );

    const item = container.querySelector('[data-dragging="false"]');
    expect(item).toBeInTheDocument();
  });

  it('should render with custom id', () => {
    const renderProp = ({ dragHandleProps }: any) => (
      <div {...dragHandleProps}>Item</div>
    );

    const { container } = render(
      <SortableWrapper id="custom-id">{renderProp}</SortableWrapper>
    );

    expect(container.querySelector('[data-id="custom-id"]')).toBeInTheDocument();
  });

  it('should handle disabled state', () => {
    const renderProp = ({ dragHandleProps, isDragging }: any) => (
      <div {...dragHandleProps} data-disabled={isDragging}>
        Disabled Item
      </div>
    );

    render(
      <SortableWrapper id="item-1" disabled={true}>
        {renderProp}
      </SortableWrapper>
    );

    expect(screen.getByText('Disabled Item')).toBeInTheDocument();
  });
});
