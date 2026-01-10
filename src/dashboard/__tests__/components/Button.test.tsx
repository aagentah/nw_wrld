import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../../components/Button';

describe('Button', () => {
  it('should render children', () => {
    render(<Button>Click me</Button>);

    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('should call onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);

    const button = screen.getByText('Click me');
    fireEvent.click(button);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should not call onClick when disabled', () => {
    const handleClick = vi.fn();
    render(
      <Button onClick={handleClick} disabled={true}>
        Click me
      </Button>
    );

    const button = screen.getByText('Click me');
    fireEvent.click(button);

    expect(handleClick).not.toHaveBeenCalled();
  });

  it('should render with title', () => {
    render(<Button title="Button title">Click me</Button>);

    const button = screen.getByTitle('Button title');
    expect(button).toBeInTheDocument();
  });

  it('should render with custom className', () => {
    const { container } = render(
      <Button className="custom-class">Click me</Button>
    );

    const button = container.querySelector('.custom-class');
    expect(button).toBeInTheDocument();
  });

  it('should render with primary type by default', () => {
    const { container } = render(<Button>Click me</Button>);

    const button = container.querySelector('.text-neutral-300');
    expect(button).toBeInTheDocument();
  });

  it('should render with secondary type', () => {
    const { container } = render(<Button type="secondary">Click me</Button>);

    const button = container.querySelector('.text-red-500\\/50');
    expect(button).toBeInTheDocument();
  });

  it('should render with icon', () => {
    const { container } = render(
      <Button icon={<span data-testid="icon">🔥</span>}>Click me</Button>
    );

    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('should render as div element by default', () => {
    const { container } = render(<Button>Click me</Button>);

    const button = container.querySelector('div');
    expect(button).toBeInTheDocument();
  });

  it('should render as custom component', () => {
    const CustomComponent = ({ children, ...props }: any) => (
      <div data-custom="true" {...props}>
        {children}
      </div>
    );

    const { container } = render(
      <Button as={CustomComponent}>Click me</Button>
    );

    const custom = container.querySelector('[data-custom="true"]');
    expect(custom).toBeInTheDocument();
  });

  it('should render with as="button" component', () => {
    const { container } = render(
      <Button as="button">Click me</Button>
    );

    const button = container.querySelector('button');
    expect(button).toBeInTheDocument();
  });

  it('should have aria-disabled attribute', () => {
    const { container } = render(
      <Button disabled={true}>Click me</Button>
    );

    const button = container.querySelector('[aria-disabled="true"]');
    expect(button).toBeInTheDocument();
  });

  it('should pass htmlType to button element when as="button"', () => {
    const { container } = render(
      <Button as="button" htmlType="submit">
        Submit
      </Button>
    );

    const button = container.querySelector('button[type="submit"]');
    expect(button).toBeInTheDocument();
  });

  it('should have correct base classes', () => {
    const { container } = render(<Button>Click me</Button>);

    const button = container.querySelector('.relative.flex.uppercase');
    expect(button).toBeInTheDocument();
  });

  it('should not pass htmlType when rendered as div', () => {
    const { container } = render(
      <Button as="div" htmlType="submit">
        Submit
      </Button>
    );

    const button = container.querySelector('button[type="submit"]');
    expect(button).toBeNull();
  });
});
