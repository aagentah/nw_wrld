import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CreateSetModal } from "../CreateSetModal";

// Mock the required hooks and utilities
const mockSetUserData = vi.fn();
const mockSetActiveTrackId = vi.fn();
const mockSetActiveSetId = vi.fn();

vi.mock("jotai", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as any),
    useAtom: (atom: any) => [
      { sets: [], config: {} },
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
  updateUserData: (setter: any, callback: any) => {
    mockSetUserData(callback);
  },
}));

describe("CreateSetModal", () => {
  const mockOnClose = vi.fn();
  const mockOnAlert = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should not render when isOpen is false", () => {
    const { container } = render(
      <CreateSetModal
        isOpen={false}
        onClose={mockOnClose}
        onAlert={mockOnAlert}
      />
    );
    expect(container.firstChild).toBe(null);
  });

  it("should render when isOpen is true", () => {
    render(
      <CreateSetModal
        isOpen={true}
        onClose={mockOnClose}
        onAlert={mockOnAlert}
      />
    );
    expect(screen.getByText("CREATE SET")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter set name")).toBeInTheDocument();
  });

  it("should call onClose when cancel button is clicked", () => {
    render(
      <CreateSetModal
        isOpen={true}
        onClose={mockOnClose}
        onAlert={mockOnAlert}
      />
    );

    const cancelButton = screen.getByText("Cancel");
    fireEvent.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("should disable submit button when name is empty", () => {
    render(
      <CreateSetModal
        isOpen={true}
        onClose={mockOnClose}
        onAlert={mockOnAlert}
      />
    );

    const createButton = screen.getByText("Create Set").closest("div");
    expect(createButton).toHaveAttribute("aria-disabled", "true");
  });

  it("should enable submit button when name is valid", async () => {
    render(
      <CreateSetModal
        isOpen={true}
        onClose={mockOnClose}
        onAlert={mockOnAlert}
      />
    );

    const input = screen.getByPlaceholderText("Enter set name");
    fireEvent.change(input, { target: { value: "My New Set" } });

    await waitFor(() => {
      const createButton = screen.getByText("Create Set").closest("div");
      expect(createButton).not.toHaveAttribute("aria-disabled");
    });
  });
});
