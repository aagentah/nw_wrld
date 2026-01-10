import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TerminalProgressBar } from '../../shared/ProgressBar';

describe('TerminalProgressBar', () => {
  it('should render progress bar with default values', () => {
    render(<TerminalProgressBar value={50} />);

    const percentage = screen.getByText('50%');
    expect(percentage).toBeInTheDocument();
  });

  it('should render with label', () => {
    render(<TerminalProgressBar value={30} label="Loading" />);

    expect(screen.getByText('Loading:')).toBeInTheDocument();
    expect(screen.getByText('30%')).toBeInTheDocument();
  });

  it('should calculate percentage correctly', () => {
    const { container } = render(
      <TerminalProgressBar value={75} max={100} />
    );

    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('should cap percentage at 100%', () => {
    render(<TerminalProgressBar value={150} max={100} />);

    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('should handle zero value', () => {
    render(<TerminalProgressBar value={0} max={100} />);

    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('should handle custom max value', () => {
    render(<TerminalProgressBar value={5} max={10} />);

    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('should render with custom width', () => {
    const { container } = render(
      <TerminalProgressBar value={50} width={200} />
    );

    const progressBar = container.querySelector('.bg-\\[\\#101010\\]');
    expect(progressBar).toHaveStyle({ width: '200px' });
  });

  it('should render progress bar with filled portion', () => {
    const { container } = render(
      <TerminalProgressBar value={25} max={100} width={100} />
    );

    const filledBar = container.querySelector('.bg-neutral-300');
    expect(filledBar).toHaveStyle({ width: '25px' });
  });

  it('should not render label when not provided', () => {
    const { container } = render(<TerminalProgressBar value={50} />);

    // Should not have any label text with colon
    const labels = container.querySelectorAll('.min-w-\\[80px\\]');
    expect(labels.length).toBe(0);
  });
});
