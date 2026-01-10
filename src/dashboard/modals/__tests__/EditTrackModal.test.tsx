import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { EditTrackModal } from "../EditTrackModal";

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
            tracks: [{ id: 1, name: "Track 1", trackSlot: 1, modules: [], modulesData: {} }]
          }],
          config: {}
        },
        mockSetUserData,
      ];
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
  getActiveSetTracks: (userData: any, setId: string) => {
    return userData.sets.find((s: any) => s.id === setId)?.tracks || [];
  },
}));

describe("EditTrackModal", () => {
  const mockOnClose = vi.fn();
  const mockInputConfig = {
  type: "midi" as const,
  deviceName: "",
  trackSelectionChannel: 1,
  methodTriggerChannel: 2,
  velocitySensitive: false,
  port: 8000
};

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should not render when isOpen is false", () => {
    const { container } = render(
      <EditTrackModal
        isOpen={false}
        onClose={mockOnClose}
        trackIndex={0}
        inputConfig={mockInputConfig}
      />
    );
    expect(container.firstChild).toBe(null);
  });

  it("should render when isOpen is true", () => {
    render(
      <EditTrackModal
        isOpen={true}
        onClose={mockOnClose}
        trackIndex={0}
        inputConfig={mockInputConfig}
      />
    );
    expect(screen.getByText("EDIT TRACK")).toBeInTheDocument();
  });

  it("should call onClose when cancel button is clicked", () => {
    render(
      <EditTrackModal
        isOpen={true}
        onClose={mockOnClose}
        trackIndex={0}
        inputConfig={mockInputConfig}
      />
    );

    const cancelButton = screen.getByText("Cancel");
    cancelButton.click();
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
});
