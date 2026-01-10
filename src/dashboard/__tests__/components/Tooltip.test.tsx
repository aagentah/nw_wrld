import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Tooltip } from '../../components/Tooltip';

describe('Tooltip', () => {
  beforeEach(() => {
    // Reset window size before each test
    global.innerWidth = 1024;
    global.innerHeight = 768;
  });

  it('should render children', () => {
    render(
      <Tooltip content="Tooltip content">
        <button>Hover me</button>
      </Tooltip>
    );

    expect(screen.getByText('Hover me')).toBeInTheDocument();
  });

  it('should not render tooltip when content is empty', () => {
    const { container } = render(
      <Tooltip content="">
        <button>Hover me</button>
      </Tooltip>
    );

    expect(screen.getByText('Hover me')).toBeInTheDocument();
    expect(container.querySelector('.fixed')).toBeNull();
  });

  it('should show tooltip on mouse enter', () => {
    render(
      <Tooltip content="Help text">
        <button>Hover me</button>
      </Tooltip>
    );

    const button = screen.getByText('Hover me');
    fireEvent.mouseEnter(button);

    expect(screen.getByText('Help text')).toBeInTheDocument();
  });

  it('should hide tooltip on mouse leave', () => {
    render(
      <Tooltip content="Help text">
        <button>Hover me</button>
      </Tooltip>
    );

    const button = screen.getByText('Hover me');
    fireEvent.mouseEnter(button);
    expect(screen.getByText('Help text')).toBeInTheDocument();

    fireEvent.mouseLeave(button);
    // After mouse leave, tooltip should be removed from DOM
    expect(screen.queryByText('Help text')).toBeNull();
  });

  it('should render with default top position', () => {
    render(
      <Tooltip content="Tooltip">
        <button>Hover me</button>
      </Tooltip>
    );

    const button = screen.getByText('Hover me');
    fireEvent.mouseEnter(button);

    const tooltip = screen.getByText('Tooltip');
    expect(tooltip).toBeInTheDocument();
  });

  it('should render with custom position', () => {
    render(
      <Tooltip content="Tooltip" position="bottom">
        <button>Hover me</button>
      </Tooltip>
    );

    const button = screen.getByText('Hover me');
    fireEvent.mouseEnter(button);

    expect(screen.getByText('Tooltip')).toBeInTheDocument();
  });

  it('should render tooltip with correct styling', () => {
    render(
      <Tooltip content="Tooltip content">
        <button>Hover me</button>
      </Tooltip>
    );

    const button = screen.getByText('Hover me');
    fireEvent.mouseEnter(button);

    const tooltip = screen.getByText('Tooltip content');
    expect(tooltip.className).toContain('bg-[#1a1a1a]');
    expect(tooltip.className).toContain('border');
    expect(tooltip.className).toContain('fixed');
  });

  it('should render children as span wrapper', () => {
    const { container } = render(
      <Tooltip content="Help">
        <button>Button</button>
      </Tooltip>
    );

    const wrapper = container.querySelector('.inline-block');
    expect(wrapper).toBeInTheDocument();
  });

  it('should render with z-index for stacking', () => {
    render(
      <Tooltip content="Tooltip">
        <button>Hover</button>
      </Tooltip>
    );

    const button = screen.getByText('Hover');
    fireEvent.mouseEnter(button);

    const tooltip = screen.getByText('Tooltip');
    expect(tooltip.className).toContain('z-[1000]');
  });
});
