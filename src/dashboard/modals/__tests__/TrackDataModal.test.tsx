import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TrackDataModal } from "../TrackDataModal";
import type { Track } from "@/types";

describe("TrackDataModal", () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should not render when isOpen is false", () => {
    const { container } = render(
      <TrackDataModal
        isOpen={false}
        onClose={mockOnClose}
        trackData={undefined}
      />
    );
    expect(container.firstChild).toBe(null);
  });

  it("should render when isOpen is true", () => {
    render(
      <TrackDataModal
        isOpen={true}
        onClose={mockOnClose}
        trackData={undefined}
      />
    );
    expect(screen.getByText("Track:")).toBeInTheDocument();
  });

  it("should display track name in title", () => {
    const trackData: Partial<Track> = {
      id: 1,
      name: "Test Track",
    };

    render(
      <TrackDataModal
        isOpen={true}
        onClose={mockOnClose}
        trackData={trackData as Track}
      />
    );
    expect(screen.getByText("Track: Test Track")).toBeInTheDocument();
  });

  it("should display JSON data when trackData is provided", () => {
    const trackData: Partial<Track> = {
      id: 1,
      name: "Test Track",
      modules: [],
      modulesData: {},
    };

    render(
      <TrackDataModal
        isOpen={true}
        onClose={mockOnClose}
        trackData={trackData as Track}
      />
    );
    expect(screen.getByText("Track Data:")).toBeInTheDocument();
    expect(screen.getByText(/"id": 1/)).toBeInTheDocument();
    expect(screen.getByText(/"name": "Test Track"/)).toBeInTheDocument();
  });

  it("should display no data message when trackData is null", () => {
    render(
      <TrackDataModal
        isOpen={true}
        onClose={mockOnClose}
        trackData={null}
      />
    );
    expect(screen.getByText("No track data available.")).toBeInTheDocument();
  });
});
