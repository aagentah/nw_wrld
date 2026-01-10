import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ErrorBoundary from "../ErrorBoundary";

// Component that throws an error
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error("Test error");
  }
  return <div>No error</div>;
};

describe("ErrorBoundary", () => {
  const originalError = console.error;
  const originalWarn = console.warn;

  beforeEach(() => {
    console.error = vi.fn();
    console.warn = vi.fn();
  });

  afterEach(() => {
    console.error = originalError;
    console.warn = originalWarn;
  });

  it("should render children when there is no error", () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText("No error")).toBeInTheDocument();
  });

  it("should catch and display error when child throws", () => {
    // Suppress the error output for this test
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText("Dashboard Error")).toBeInTheDocument();
    expect(screen.getByText(/An error occurred/)).toBeInTheDocument();

    spy.mockRestore();
  });

  it("should display reload button on error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    const reloadButton = screen.getByText("Reload Application");
    expect(reloadButton).toBeInTheDocument();

    spy.mockRestore();
  });

  it("should reload page when reload button is clicked", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const originalLocation = window.location;
    delete (window as any).location;
    window.location = {
      ...originalLocation,
      reload: vi.fn(),
      toString: () => originalLocation.toString(),
    } as any;

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    const reloadButton = screen.getByText("Reload Application");
    reloadButton.click();

    expect(window.location.reload).toHaveBeenCalled();

    (window as any).location = originalLocation;
    spy.mockRestore();
  });
});
