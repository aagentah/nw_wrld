import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConfirmationModal } from "../ConfirmationModal";

describe("ConfirmationModal", () => {
  const mockOnClose = vi.fn();
  const mockOnConfirm = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should not render when isOpen is false", () => {
    const { container } = render(
      <ConfirmationModal
        isOpen={false}
        onClose={mockOnClose}
        message="Are you sure?"
        onConfirm={mockOnConfirm}
      />
    );
    expect(container.firstChild).toBe(null);
  });

  it("should render when isOpen is true", () => {
    render(
      <ConfirmationModal
        isOpen={true}
        onClose={mockOnClose}
        message="Are you sure?"
        onConfirm={mockOnConfirm}
      />
    );
    expect(screen.getByText("CONFIRM")).toBeInTheDocument();
    expect(screen.getByText("Are you sure?")).toBeInTheDocument();
  });

  it("should render alert type correctly", () => {
    render(
      <ConfirmationModal
        isOpen={true}
        onClose={mockOnClose}
        message="Error occurred"
        onConfirm={mockOnConfirm}
        type="alert"
      />
    );
    expect(screen.getByText("ALERT")).toBeInTheDocument();
    expect(screen.getByText("OK")).toBeInTheDocument();
    expect(screen.queryByText("Cancel")).not.toBeInTheDocument();
  });

  it("should call onConfirm and onClose when confirm button is clicked", () => {
    render(
      <ConfirmationModal
        isOpen={true}
        onClose={mockOnClose}
        message="Are you sure?"
        onConfirm={mockOnConfirm}
      />
    );

    const confirmButton = screen.getByText("Confirm");
    fireEvent.click(confirmButton);

    expect(mockOnConfirm).toHaveBeenCalledTimes(1);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("should call onClose when cancel button is clicked", () => {
    render(
      <ConfirmationModal
        isOpen={true}
        onClose={mockOnClose}
        message="Are you sure?"
        onConfirm={mockOnConfirm}
      />
    );

    const cancelButton = screen.getByText("Cancel");
    fireEvent.click(cancelButton);

    expect(mockOnConfirm).not.toHaveBeenCalled();
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("should handle missing onConfirm callback gracefully", () => {
    render(
      <ConfirmationModal
        isOpen={true}
        onClose={mockOnClose}
        message="Are you sure?"
        onConfirm={undefined}
      />
    );

    const confirmButton = screen.getByText("Confirm");
    fireEvent.click(confirmButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
});
