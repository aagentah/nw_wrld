import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { CreateTrackModal } from "../CreateTrackModal";

const mockSetUserData = vi.fn();
const mockSetActiveTrackId = vi.fn();
const mockSetActiveSetId = vi.fn();
const mockInputConfig = {
  type: "midi" as const,
  deviceName: "",
  trackSelectionChannel: 1,
  methodTriggerChannel: 2,
  velocitySensitive: false,
  port: 8000,
};

vi.mock("jotai", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as any),
    useAtom: (atom: any) => {
      if (atom.toString().includes("activeTrackId")) return [null, mockSetActiveTrackId];
      if (atom.toString().includes("activeSetId")) return ["set1", mockSetActiveSetId];
      const mockConfig = {
        input: mockInputConfig,
        trackMappings: { midi: {}, osc: {} },
        channelMappings: { midi: {}, osc: {} },
        autoRefresh: true,
        activeSetId: "set1",
        activeTrackId: null,
        sequencerMode: false,
        sequencerBpm: 120,
        sequencerMuted: false,
        aspectRatio: "default",
        bgColor: "#000000"
      };
      return [{ sets: [{ id: "set1", tracks: [] }], config: mockConfig }, mockSetUserData];
    },
  };
});

vi.mock("@dashboard/core/hooks/useNameValidation", () => ({
  useNameValidation: () => ({
    validate: (name: string) => ({
      isValid: name.trim().length > 0,
      error: name.trim().length > 0 ? null : "Name is required",
    }),
  }),
}));

vi.mock("@dashboard/core/hooks/useTrackSlots", () => ({
  useTrackSlots: () => ({
    availableSlots: [1, 2, 3],
    getTrigger: () => "C-1",
  }),
}));

vi.mock("@dashboard/core/utils", () => ({
  updateActiveSet: vi.fn(),
}));

vi.mock("@shared/utils/setUtils", () => ({
  getActiveSetTracks: () => [],
}));

describe("CreateTrackModal", () => {
  const mockOnClose = vi.fn();
  const mockOnAlert = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should not render when isOpen is false", () => {
    const { container } = render(
      <CreateTrackModal
        isOpen={false}
        onClose={mockOnClose}
        inputConfig={mockInputConfig}
        onAlert={mockOnAlert}
      />
    );
    expect(container.firstChild).toBe(null);
  });

  it("should render when isOpen is true", () => {
    render(
      <CreateTrackModal
        isOpen={true}
        onClose={mockOnClose}
        inputConfig={mockInputConfig}
        onAlert={mockOnAlert}
      />
    );
    expect(screen.getByText("CREATE TRACK")).toBeInTheDocument();
  });

  it("should call onClose when cancel button is clicked", () => {
    render(
      <CreateTrackModal
        isOpen={true}
        onClose={mockOnClose}
        inputConfig={mockInputConfig}
        onAlert={mockOnAlert}
      />
    );

    const cancelButton = screen.getByText("Cancel");
    cancelButton.click();
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
});
