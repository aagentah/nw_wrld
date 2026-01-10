import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HelpIcon } from '../../components/HelpIcon';

// Mock Tooltip component
vi.mock('../../components/Tooltip', () => ({
  Tooltip: ({ children, content, position }: any) => (
    <div data-testid="tooltip" data-content={content} data-position={position}>
      {children}
    </div>
  ),
}));

// Mock FaQuestionCircle icon
vi.mock('react-icons/fa', () => ({
  FaQuestionCircle: ({ className }: any) => (
    <svg data-testid="question-icon" className={className}>
      <circle />
    </svg>
  ),
}));

describe('HelpIcon', () => {
  it('should render help icon', () => {
    render(<HelpIcon helpText="Help text" />);

    expect(screen.getByTestId('question-icon')).toBeInTheDocument();
  });

  it('should pass help text to Tooltip', () => {
    render(<HelpIcon helpText="This is help text" />);

    const tooltip = screen.getByTestId('tooltip');
    expect(tooltip).toHaveAttribute('data-content', 'This is help text');
  });

  it('should render with correct position', () => {
    render(<HelpIcon helpText="Help" />);

    const tooltip = screen.getByTestId('tooltip');
    expect(tooltip).toHaveAttribute('data-position', 'top');
  });

  it('should render icon with correct classes', () => {
    render(<HelpIcon helpText="Help" />);

    const icon = screen.getByTestId('question-icon');
    expect(icon).toHaveClass('scale-[1.1]');
    expect(icon).toHaveClass('rounded-full');
    expect(icon).toHaveClass('text-blue-800');
    expect(icon).toHaveClass('text-[10px]');
  });

  it('should render with wrapper styling', () => {
    const { container } = render(<HelpIcon helpText="Help" />);

    const wrapper = container.querySelector('.bg-neutral-200');
    expect(wrapper).toBeInTheDocument();
  });

  it('should render with cursor-help class', () => {
    const { container } = render(<HelpIcon helpText="Help" />);

    const wrapper = container.querySelector('.cursor-help');
    expect(wrapper).toBeInTheDocument();
  });

  it('should render with rounded-full', () => {
    const { container } = render(<HelpIcon helpText="Help" />);

    const wrapper = container.querySelector('.rounded-full');
    expect(wrapper).toBeInTheDocument();
  });
});
