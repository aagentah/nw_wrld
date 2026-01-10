import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ModalFooter } from '../../components/ModalFooter';

describe('ModalFooter', () => {
  it('should render children', () => {
    render(
      <ModalFooter>
        <button>Cancel</button>
        <button>Save</button>
      </ModalFooter>
    );

    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Save')).toBeInTheDocument();
  });

  it('should justify-end when single child', () => {
    const { container } = render(
      <ModalFooter>
        <button>Save</button>
      </ModalFooter>
    );

    const footer = container.querySelector('.justify-end');
    expect(footer).toBeInTheDocument();
  });

  it('should justify-between when multiple children', () => {
    const { container } = render(
      <ModalFooter>
        <button>Cancel</button>
        <button>Save</button>
      </ModalFooter>
    );

    const footer = container.querySelector('.justify-between');
    expect(footer).toBeInTheDocument();
  });

  it('should render with border top', () => {
    const { container } = render(
      <ModalFooter>
        <button>Save</button>
      </ModalFooter>
    );

    const footer = container.querySelector('.border-t');
    expect(footer).toBeInTheDocument();
  });

  it('should apply bottom-aligned padding when isBottomAligned is true', () => {
    const { container } = render(
      <ModalFooter isBottomAligned={true}>
        <button>Save</button>
      </ModalFooter>
    );

    const footerContainer = container.querySelector('.px-6');
    expect(footerContainer).toBeInTheDocument();
  });

  it('should not apply bottom-aligned padding by default', () => {
    const { container } = render(
      <ModalFooter>
        <button>Save</button>
      </ModalFooter>
    );

    const footerContainer = container.querySelector('.px-6');
    expect(footerContainer).toBeNull();
  });

  it('should render with flex layout', () => {
    const { container } = render(
      <ModalFooter>
        <button>Save</button>
      </ModalFooter>
    );

    const footer = container.querySelector('.flex');
    expect(footer).toBeInTheDocument();
  });

  it('should render with gap between items', () => {
    const { container } = render(
      <ModalFooter>
        <button>Cancel</button>
        <button>Save</button>
      </ModalFooter>
    );

    const footer = container.querySelector('.gap-2');
    expect(footer).toBeInTheDocument();
  });

  it('should have displayName for Modal component detection', () => {
    expect(ModalFooter.displayName).toBe('ModalFooter');
  });
});
