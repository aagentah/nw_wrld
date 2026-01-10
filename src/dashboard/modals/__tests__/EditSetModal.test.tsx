import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { EditSetModal } from "../EditSetModal";

// Mock the required hooks and utilities
const mockSetUserData = vi.fn();

vi.mock("jotai", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as any),
    useAtom: (atom: any) => [
      { sets: [{ id: "set1", name: "Existing Set", tracks: [] }], config: {} },
      mockSetUserData,
    ],
  };
});

vi.mock("@dashboard/core/hooks/useNameValidation", () => ({
  useNameValidation: (sets: any[], excludeId?: string) => ({
    validate: (name: string) => ({
      isValid: name.trim().length > 0,
      error: name.trim().length > 0 ? null : "Name is required",
    }),
  }),
}));

vi.mock("@dashboard/core/utils", () => ({
  updateUserData: vi.fn(),
}));

describe("EditSetModal", () => {
  const mockOnClose = vi.fn();
  const mockOnAlert = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should not render when isOpen is false", () => {
    const { container } = render(
      <EditSetModal
        isOpen={false}
        onClose={mockOnClose}
        setId="set1"
        onAlert={mockOnAlert}
      />
    );
    expect(container.firstChild).toBe(null);
  });

  it("should render when isOpen is true", () => {
    render(
      <EditSetModal
        isOpen={true}
        onClose={mockOnClose}
        setId="set1"
        onAlert={mockOnAlert}
      />
    );
    expect(screen.getByText("EDIT SET")).toBeInTheDocument();
  });

  it("should call onClose when cancel button is clicked", () => {
    render(
      <EditSetModal
        isOpen={true}
        onClose={mockOnClose}
        setId="set1"
        onAlert={mockOnAlert}
      />
    );

    const cancelButton = screen.getByText("Cancel");
    fireEvent.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
});
