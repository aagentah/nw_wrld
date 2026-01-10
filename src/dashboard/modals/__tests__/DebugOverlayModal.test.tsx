import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { DebugOverlayModal } from "../DebugOverlayModal";

describe("DebugOverlayModal", () => {
  const mockOnClose = vi.fn();
  const mockLogs = [
    "[0.123] Method Execution: testMethod",
    "[0.456] MIDI Event: note on",
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should not render when isOpen is false", () => {
    const { container } = render(
      <DebugOverlayModal
        isOpen={false}
        onClose={mockOnClose}
        debugLogs={[]}
      />
    );
    expect(container.firstChild).toBe(null);
  });

  it("should render when isOpen is true", () => {
    render(
      <DebugOverlayModal
        isOpen={true}
        onClose={mockOnClose}
        debugLogs={mockLogs}
      />
    );
    expect(screen.getByText("DEBUG")).toBeInTheDocument();
  });

  it("should display no logs message when logs are empty", () => {
    render(
      <DebugOverlayModal
        isOpen={true}
        onClose={mockOnClose}
        debugLogs={[]}
      />
    );
    expect(screen.getByText(/No debug logs yet/)).toBeInTheDocument();
  });

  it("should display logs when provided", () => {
    render(
      <DebugOverlayModal
        isOpen={true}
        onClose={mockOnClose}
        debugLogs={mockLogs}
      />
    );
    expect(screen.getByText(/testMethod/)).toBeInTheDocument();
    expect(screen.getByText(/MIDI Event/)).toBeInTheDocument();
  });
});
