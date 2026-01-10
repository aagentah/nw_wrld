import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { SelectTrackModal } from "../SelectTrackModal";

const mockSetUserData = vi.fn();
const mockSetActiveTrackId = vi.fn();
const mockActiveSetId = "set1";

vi.mock("jotai", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as any),
    useAtom: (atom: any) => {
      if (atom.toString().includes("activeTrackId")) return [1, mockSetActiveTrackId];
      return [
        {
          sets: [{
            id: "set1",
            tracks: [
              { id: 1, name: "Track 1", modules: [] },
              { id: 2, name: "Track 2", modules: [] }
            ]
          }],
          config: {}
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
  getActiveSet: (userData: any, setId: string) => {
    return userData.sets.find((s: any) => s.id === setId);
  },
}));

vi.mock("@shared/json/recordingUtils", () => ({
  deleteRecordingsForTracks: (prev: any, trackIds: number[]) => prev,
}));

describe("SelectTrackModal", () => {
  const mockOnClose = vi.fn();
  const mockOnCreateTrack = vi.fn();
  const mockOnConfirmDelete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should not render when isOpen is false", () => {
    const { container } = render(
      <SelectTrackModal
        isOpen={false}
        onClose={mockOnClose}
        userData={{ sets: [], config: {} } as any}
        setUserData={vi.fn()}
        activeTrackId={null}
        setActiveTrackId={vi.fn()}
        activeSetId={null}
        recordingData={{recordings: {}}}
        setRecordingData={vi.fn()}
        onCreateTrack={mockOnCreateTrack}
        onConfirmDelete={mockOnConfirmDelete}
      />
    );
    expect(container.firstChild).toBe(null);
  });

  it("should render when isOpen is true", () => {
    render(
      <SelectTrackModal
        isOpen={true}
        onClose={mockOnClose}
        userData={{
          sets: [{
            id: "set1",
            tracks: [{ id: 1, name: "Track 1", modules: [] }]
          }],
          config: {}
        } as any}
        setUserData={vi.fn()}
        activeTrackId={null}
        setActiveTrackId={vi.fn()}
        activeSetId="set1"
        recordingData={{recordings: {}}}
        setRecordingData={vi.fn()}
        onCreateTrack={mockOnCreateTrack}
        onConfirmDelete={mockOnConfirmDelete}
      />
    );
    expect(screen.getByText("TRACKS")).toBeInTheDocument();
  });

  it("should display Create Track button", () => {
    render(
      <SelectTrackModal
        isOpen={true}
        onClose={mockOnClose}
        userData={{ sets: [{ id: "set1", tracks: [] }], config: {} } as any}
        setUserData={vi.fn()}
        activeTrackId={null}
        setActiveTrackId={vi.fn()}
        activeSetId="set1"
        recordingData={{recordings: {}}}
        setRecordingData={vi.fn()}
        onCreateTrack={mockOnCreateTrack}
        onConfirmDelete={mockOnConfirmDelete}
      />
    );
    expect(screen.getByText("Create Track")).toBeInTheDocument();
  });
});