import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ModalHeader } from '../../components/ModalHeader';

// Mock Button component
vi.mock('../../components/Button', () => ({
  Button: ({ onClick, children, type }: any) => (
    <button onClick={onClick} data-type={type}>
      {children}
    </button>
  ),
}));

describe('ModalHeader', () => {
  it('should render title', () => {
    render(<ModalHeader title="Modal Title" onClose={vi.fn()} />);

    expect(screen.getByText('Modal Title')).toBeInTheDocument();
  });

  it('should render close button by default', () => {
    render(<ModalHeader title="Title" onClose={vi.fn()} />);

    expect(screen.getByText('CLOSE')).toBeInTheDocument();
  });

  it('should not render close button when showClose is false', () => {
    render(
      <ModalHeader title="Title" onClose={vi.fn()} showClose={false} />
    );

    expect(screen.queryByText('CLOSE')).toBeNull();
  });

  it('should call onClose when close button is clicked', () => {
    const handleClose = vi.fn();
    render(<ModalHeader title="Title" onClose={handleClose} />);

    const closeButton = screen.getByText('CLOSE');
    fireEvent.click(closeButton);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('should render with correct base classes', () => {
    const { container } = render(
      <ModalHeader title="Title" onClose={vi.fn()} />
    );

    const header = container.querySelector('.mb-4');
    expect(header).toBeInTheDocument();
  });

  it('should render with border bottom', () => {
    const { container } = render(
      <ModalHeader title="Title" onClose={vi.fn()} />
    );

    const header = container.querySelector('.border-b');
    expect(header).toBeInTheDocument();
  });

  it('should apply bottom-aligned padding when isBottomAligned is true', () => {
    const { container } = render(
      <ModalHeader title="Title" onClose={vi.fn()} isBottomAligned={true} />
    );

    const headerContainer = container.querySelector('.px-6');
    expect(headerContainer).toBeInTheDocument();
  });

  it('should not apply bottom-aligned padding by default', () => {
    const { container } = render(
      <ModalHeader title="Title" onClose={vi.fn()} />
    );

    const headerContainer = container.querySelector('.px-6');
    expect(headerContainer).toBeNull();
  });

  it('should render title with correct styling', () => {
    const { container } = render(
      <ModalHeader title="Title" onClose={vi.fn()} />
    );

    const title = container.querySelector('.uppercase');
    expect(title).toBeInTheDocument();
  });

  it('should have displayName for Modal component detection', () => {
    expect(ModalHeader.displayName).toBe('ModalHeader');
  });
});
