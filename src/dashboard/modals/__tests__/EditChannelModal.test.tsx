import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { EditChannelModal } from "../EditChannelModal";

const mockSetUserData = vi.fn();
const mockActiveSetId = "set1";

vi.mock("jotai", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as any),
    useAtom: (atom: any) => {
      if (atom.toString().includes("activeSetId")) return [mockActiveSetId, vi.fn()];
      return [
        {
          sets: [{
            id: "set1",
            tracks: [{
              id: 1,
              name: "Track 1",
              trackSlot: 1,
              modules: [],
              modulesData: {},
              channelMappings: { "1": 1, "2": 2 }
            }]
          }],
          config: { sequencerMode: false }
        },
        mockSetUserData,
      ];
    },
  };
});

vi.mock("@dashboard/core/utils", () => ({
  updateActiveSet: vi.fn(),
}));

vi.mock("@shared/utils/setUtils", () => ({
  getActiveSetTracks: (userData: any, setId: string) => {
    return userData.sets.find((s: any) => s.id === setId)?.tracks || [];
  },
}));

describe("EditChannelModal", () => {
  const mockOnClose = vi.fn();
  const mockInputConfig = {
  type: "midi" as const,
  deviceName: "",
  trackSelectionChannel: 1,
  methodTriggerChannel: 2,
  velocitySensitive: false,
  port: 8000
};
  const mockConfig = {
    sequencerMode: false,
    input: mockInputConfig,
    trackMappings: { midi: {}, osc: {} },
    channelMappings: { midi: {}, osc: {} },
    autoRefresh: true,
    activeSetId: "set1",
    activeTrackId: null,
    sequencerBpm: 120,
    sequencerMuted: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should not render when isOpen is false", () => {
    const { container } = render(
      <EditChannelModal
        isOpen={false}
        onClose={mockOnClose}
        trackIndex={0}
        channelNumber={1}
        inputConfig={mockInputConfig}
        config={mockConfig}
      />
    );
    expect(container.firstChild).toBe(null);
  });

  it("should render when isOpen is true", () => {
    render(
      <EditChannelModal
        isOpen={true}
        onClose={mockOnClose}
        trackIndex={0}
        channelNumber={1}
        inputConfig={mockInputConfig}
        config={mockConfig}
      />
    );
    expect(screen.getByText("EDIT CHANNEL")).toBeInTheDocument();
  });

  it("should call onClose when cancel button is clicked", () => {
    render(
      <EditChannelModal
        isOpen={true}
        onClose={mockOnClose}
        trackIndex={0}
        channelNumber={1}
        inputConfig={mockInputConfig}
        config={mockConfig}
      />
    );

    const cancelButton = screen.getByText("Cancel");
    cancelButton.click();
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
});
