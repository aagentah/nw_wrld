import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { InputMappingsModal } from "../InputMappingsModal";

// Mock the required hooks and utilities
const mockSetUserData = vi.fn();

vi.mock("jotai", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as any),
    useAtom: (atom: any) => [
      {
        config: {
          trackMappings: { midi: {}, osc: {} },
          channelMappings: { midi: {}, osc: {} },
        },
      },
      mockSetUserData,
    ],
  };
});

vi.mock("@dashboard/core/utils", () => ({
  updateUserData: vi.fn(),
  DEFAULT_GLOBAL_MAPPINGS: {
    trackMappings: { midi: {}, osc: {} },
    channelMappings: { midi: {}, osc: {} },
  },
}));

describe("InputMappingsModal", () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should not render when isOpen is false", () => {
    const { container } = render(
      <InputMappingsModal isOpen={false} onClose={mockOnClose} />
    );
    expect(container.firstChild).toBe(null);
  });

  it("should render when isOpen is true", () => {
    render(
      <InputMappingsModal isOpen={true} onClose={mockOnClose} />
    );
    expect(screen.getByText("INPUT MAPPINGS")).toBeInTheDocument();
  });

  it("should display MIDI tab by default", () => {
    render(
      <InputMappingsModal isOpen={true} onClose={mockOnClose} />
    );
    expect(screen.getByText("Track Mappings (1-10):")).toBeInTheDocument();
    expect(screen.getByText("Channel Mappings (1-16):")).toBeInTheDocument();
  });
});
