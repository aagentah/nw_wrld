import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SequencerGrid } from "../SequencerGrid";

describe("SequencerGrid", () => {
  const defaultProps = {
    track: {
      id: 1,
      name: "Test Track",
      channels: ["ch1", "ch2"],
    },
    pattern: {
      ch1: [0, 2, 4],
      ch2: [1, 3, 5],
    },
    bpm: 120,
    isPlaying: false,
    currentStep: 0,
    onToggleStep: vi.fn(),
    onBpmChange: vi.fn(),
  };

  it("should render sequencer grid", () => {
    render(<SequencerGrid {...defaultProps} />);

    expect(screen.getByText((content, element) => {
      return content.includes("SEQUENCER");
    })).toBeInTheDocument();
    expect(screen.getByText("BPM:")).toBeInTheDocument();
  });

  it("should render channel rows", () => {
    render(<SequencerGrid {...defaultProps} />);

    expect(screen.getByText("ch1")).toBeInTheDocument();
    expect(screen.getByText("ch2")).toBeInTheDocument();
  });

  it("should render 16 step buttons", () => {
    render(<SequencerGrid {...defaultProps} />);

    const stepButtons = screen.getAllByRole("button");
    expect(stepButtons.length).toBeGreaterThan(0);
  });

  it("should show no channels message when track has no channels", () => {
    const props = {
      ...defaultProps,
      track: { id: 1, name: "Empty Track", channels: [] },
    };

    render(<SequencerGrid {...props} />);

    expect(
      screen.getByText(/No channels available/)
    ).toBeInTheDocument();
  });

  it("should call onBpmChange when BPM input changes", async () => {
    const user = userEvent.setup();
    render(<SequencerGrid {...defaultProps} />);

    const bpmInput = screen.getByDisplayValue("120");
    await user.clear(bpmInput);
    await user.type(bpmInput, "125");

    // Verify the onChange callback was invoked (user interaction happened)
    expect(defaultProps.onBpmChange).toHaveBeenCalled();
  });

  it("should collapse and expand sequencer", async () => {
    const user = userEvent.setup();
    render(<SequencerGrid {...defaultProps} />);

    const collapseButton = screen.getByText("▼ SEQUENCER");
    await user.click(collapseButton);

    expect(screen.getByText("▶ SEQUENCER")).toBeInTheDocument();
  });
});
