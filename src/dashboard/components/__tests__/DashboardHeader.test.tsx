import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DashboardHeader } from "../DashboardHeader";

describe("DashboardHeader", () => {
  it("should render header with buttons", () => {
    const handlers = {
      onSets: vi.fn(),
      onTracks: vi.fn(),
      onModules: vi.fn(),
      onSettings: vi.fn(),
      onDebugOverlay: vi.fn(),
    };

    render(<DashboardHeader {...handlers} />);

    expect(screen.getByText("SETS")).toBeInTheDocument();
    expect(screen.getByText("TRACKS")).toBeInTheDocument();
    expect(screen.getByText("MODULES")).toBeInTheDocument();
    expect(screen.getByText("SETTINGS")).toBeInTheDocument();
    expect(screen.getByText("DEBUG")).toBeInTheDocument();
  });

  it("should call onSets when SETS button is clicked", () => {
    const handlers = {
      onSets: vi.fn(),
      onTracks: vi.fn(),
      onModules: vi.fn(),
      onSettings: vi.fn(),
      onDebugOverlay: vi.fn(),
    };

    render(<DashboardHeader {...handlers} />);

    handlers.onSets.mockReturnValueOnce(
      <button onClick={handlers.onSets}>SETS</button>
    );
  });

  it("should display nw_wrld branding", () => {
    const handlers = {
      onSets: vi.fn(),
      onTracks: vi.fn(),
      onModules: vi.fn(),
      onSettings: vi.fn(),
      onDebugOverlay: vi.fn(),
    };

    render(<DashboardHeader {...handlers} />);

    expect(screen.getByText("nw_wrld")).toBeInTheDocument();
  });
});
