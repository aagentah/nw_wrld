import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { SelectSetModal } from "../SelectSetModal";

const mockSetUserData = vi.fn();
const mockSetActiveTrackId = vi.fn();
const mockSetActiveSetId = vi.fn();

vi.mock("jotai", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as any),
    useAtom: (atom: any) => {
      if (atom.toString().includes("activeTrackId")) return [1, mockSetActiveTrackId];
      if (atom.toString().includes("activeSetId")) return ["set1", mockSetActiveSetId];
      return [
        {
          sets: [
            { id: "set1", name: "Set 1", tracks: [] },
            { id: "set2", name: "Set 2", tracks: [] }
          ],
          config: {}
        },
        mockSetUserData,
      ];
    },
  };
});

vi.mock("@dashboard/core/utils", () => ({
  updateUserData: vi.fn(),
}));

vi.mock("@shared/json/recordingUtils", () => ({
  deleteRecordingsForTracks: (prev: any, trackIds: number[]) => prev,
}));

describe("SelectSetModal", () => {
  const mockOnClose = vi.fn();
  const mockOnCreateSet = vi.fn();
  const mockOnConfirmDelete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should not render when isOpen is false", () => {
    const { container } = render(
      <SelectSetModal
        isOpen={false}
        onClose={mockOnClose}
        userData={{ sets: [], config: {} } as any}
        setUserData={vi.fn()}
        activeTrackId={null}
        setActiveTrackId={vi.fn()}
        activeSetId={null}
        setActiveSetId={vi.fn()}
        recordingData={{recordings: {}}}
        setRecordingData={vi.fn()}
        onCreateSet={mockOnCreateSet}
        onConfirmDelete={mockOnConfirmDelete}
      />
    );
    expect(container.firstChild).toBe(null);
  });

  it("should render when isOpen is true", () => {
    render(
      <SelectSetModal
        isOpen={true}
        onClose={mockOnClose}
        userData={{ sets: [{ id: "set1", name: "Set 1", tracks: [] }], config: {} } as any}
        setUserData={vi.fn()}
        activeTrackId={null}
        setActiveTrackId={vi.fn()}
        activeSetId="set1"
        setActiveSetId={vi.fn()}
        recordingData={{recordings: {}}}
        setRecordingData={vi.fn()}
        onCreateSet={mockOnCreateSet}
        onConfirmDelete={mockOnConfirmDelete}
      />
    );
    expect(screen.getByText("SETS")).toBeInTheDocument();
  });

  it("should display Create Set button", () => {
    render(
      <SelectSetModal
        isOpen={true}
        onClose={mockOnClose}
        userData={{ sets: [], config: {} } as any}
        setUserData={vi.fn()}
        activeTrackId={null}
        setActiveTrackId={vi.fn()}
        activeSetId={null}
        setActiveSetId={vi.fn()}
        recordingData={{recordings: {}}}
        setRecordingData={vi.fn()}
        onCreateSet={mockOnCreateSet}
        onConfirmDelete={mockOnConfirmDelete}
      />
    );
    expect(screen.getByText("Create Set")).toBeInTheDocument();
  });
});