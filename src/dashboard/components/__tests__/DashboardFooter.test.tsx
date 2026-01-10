import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DashboardFooter } from "../DashboardFooter";
import { recordingDataAtom } from "../../core/state";

// Mock jotai
vi.mock("jotai", () => ({
  atom: (val: any) => val,
  useAtom: (atom: any) => [null, vi.fn()],
}));

// Mock the required types
const mockTrack = null;
const mockInputStatus = {
  status: "disconnected" as const,
  message: "",
  config: null,
};

// Mock FormInputs components
vi.mock("../FormInputs", () => ({
  Checkbox: ({ checked, onChange }: any) => (
    <input type="checkbox" checked={checked} onChange={onChange} data-testid="checkbox" />
  ),
}));

describe("DashboardFooter", () => {
  const defaultProps = {
    track: mockTrack,
    isPlaying: false,
    onPlayPause: vi.fn(),
    onStop: vi.fn(),
    inputStatus: mockInputStatus,
    inputConfig: null,
    onSettingsClick: vi.fn(),
    config: null,
    isMuted: false,
    onMuteChange: vi.fn(),
    isProjectorReady: true,
  };

  it("should render footer when no track is selected", () => {
    render(<DashboardFooter {...defaultProps} />);

    expect(screen.getByText("No track selected")).toBeInTheDocument();
  });

  it("should render playback controls when track is selected and sequencer mode is on", () => {
    const props = {
      ...defaultProps,
      track: { id: 1, name: "Test Track" },
      config: { sequencerMode: true },
    } as any;

    render(<DashboardFooter {...props} />);

    expect(screen.getByText("PLAY")).toBeInTheDocument();
  });

  it("should render stop button when playing", () => {
    const props = {
      ...defaultProps,
      track: { id: 1, name: "Test Track" },
      isPlaying: true,
      config: { sequencerMode: true },
    } as any;

    render(<DashboardFooter {...props} />);

    expect(screen.getByText("STOP")).toBeInTheDocument();
  });

  it("should display developer attribution", () => {
    const props = {
      ...defaultProps,
      track: { id: 1, name: "Test Track" },
    } as any;

    render(<DashboardFooter {...props} />);

    expect(screen.getByText(/Daniel Aagentah/)).toBeInTheDocument();
    expect(screen.getByText(/GPL-3.0/)).toBeInTheDocument();
  });
});
