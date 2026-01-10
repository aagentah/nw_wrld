import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Modal } from '../../shared/Modal';

// Mock ModalHeader and ModalFooter for testing
vi.mock('../../components/ModalHeader', () => ({
  ModalHeader: ({ title, onClose, isBottomAligned }: any) => (
    <div data-testid="modal-header" data-bottom-aligned={isBottomAligned}>
      <span>{title}</span>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

vi.mock('../../components/ModalFooter', () => ({
  ModalFooter: ({ children, isBottomAligned }: any) => (
    <div data-testid="modal-footer" data-bottom-aligned={isBottomAligned}>
      {children}
    </div>
  ),
}));

describe('Modal', () => {
  it('should not render when isOpen is false', () => {
    const { container } = render(
      <Modal isOpen={false} onClose={vi.fn()}>
        <div>Modal Content</div>
      </Modal>
    );

    expect(container.firstChild).toBe(null);
  });

  it('should render when isOpen is true', () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()}>
        <div>Modal Content</div>
      </Modal>
    );

    expect(screen.getByText('Modal Content')).toBeInTheDocument();
  });

  it('should call onClose when overlay is clicked', () => {
    const handleClose = vi.fn();
    const { container } = render(
      <Modal isOpen={true} onClose={handleClose}>
        <div>Modal Content</div>
      </Modal>
    );

    const overlay = container.firstChild as HTMLElement;
    fireEvent.click(overlay);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('should not call onClose when modal content is clicked', () => {
    const handleClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={handleClose}>
        <div>Modal Content</div>
      </Modal>
    );

    const content = screen.getByText('Modal Content').closest('.bg-\\[\\#101010\\]');
    if (content) {
      fireEvent.click(content);
      expect(handleClose).not.toHaveBeenCalled();
    }
  });

  it('should call onCloseHandler when provided', () => {
    const handleClose = vi.fn();
    const handleCloseHandler = vi.fn();
    const { container } = render(
      <Modal
        isOpen={true}
        onClose={handleClose}
        onCloseHandler={handleCloseHandler}
      >
        <div>Modal Content</div>
      </Modal>
    );

    const overlay = container.firstChild as HTMLElement;
    fireEvent.click(overlay);

    expect(handleClose).not.toHaveBeenCalled();
    expect(handleCloseHandler).toHaveBeenCalledTimes(1);
  });

  it('should render with center position by default', () => {
    const { container } = render(
      <Modal isOpen={true} onClose={vi.fn()}>
        <div>Modal Content</div>
      </Modal>
    );

    const overlay = container.firstChild as HTMLElement;
    expect(overlay.className).toContain('items-center');
    expect(overlay.className).not.toContain('items-end');
  });

  it('should render with bottom position', () => {
    const { container } = render(
      <Modal isOpen={true} onClose={vi.fn()} position="bottom">
        <div>Modal Content</div>
      </Modal>
    );

    const overlay = container.firstChild as HTMLElement;
    expect(overlay.className).toContain('items-end');
    expect(overlay.className).toContain('bottom-[49px]');
  });

  it('should render with medium size by default', () => {
    const { container } = render(
      <Modal isOpen={true} onClose={vi.fn()}>
        <div>Modal Content</div>
      </Modal>
    );

    const modal = container.querySelector('.bg-\\[\\#101010\\]');
    expect(modal?.className).toContain('max-w-[70vw]');
  });

  it('should render with small size', () => {
    const { container } = render(
      <Modal isOpen={true} onClose={vi.fn()} size="small">
        <div>Modal Content</div>
      </Modal>
    );

    const modal = container.querySelector('.bg-\\[\\#101010\\]');
    expect(modal?.className).toContain('max-w-[50vw]');
  });

  it('should render with large size', () => {
    const { container } = render(
      <Modal isOpen={true} onClose={vi.fn()} size="large">
        <div>Modal Content</div>
      </Modal>
    );

    const modal = container.querySelector('.bg-\\[\\#101010\\]');
    expect(modal?.className).toContain('max-w-[90vw]');
  });

  it('should render with full size', () => {
    const { container } = render(
      <Modal isOpen={true} onClose={vi.fn()} size="full">
        <div>Modal Content</div>
      </Modal>
    );

    const modal = container.querySelector('.bg-\\[\\#101010\\]');
    expect(modal?.className).toContain('w-full');
  });

  it('should render children without ModalHeader/ModalFooter', () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()}>
        <div>Child 1</div>
        <div>Child 2</div>
      </Modal>
    );

    expect(screen.getByText('Child 1')).toBeInTheDocument();
    expect(screen.getByText('Child 2')).toBeInTheDocument();
  });

  it('should stop propagation on content click', () => {
    const handleClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={handleClose}>
        <div data-testid="content">Modal Content</div>
      </Modal>
    );

    const content = screen.getByTestId('content');
    fireEvent.click(content);

    expect(handleClose).not.toHaveBeenCalled();
  });
});
