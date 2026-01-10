import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MethodCodeModal } from "../MethodCodeModal";

// Mock the getMethodCode utility
const mockGetMethodCode = vi.fn();
vi.mock("@dashboard/core/utils", () => ({
  getMethodCode: () => mockGetMethodCode(),
  updateUserData: vi.fn(),
  updateActiveSet: vi.fn(),
}));

describe("MethodCodeModal", () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Setup default mock implementation
    mockGetMethodCode.mockReturnValue({
      code: "function testMethod() { return true; }",
      filePath: "/modules/test-module.js",
    });
  });

  it("should not render when isOpen is false", () => {
    const { container } = render(
      <MethodCodeModal
        isOpen={false}
        onClose={mockOnClose}
        moduleName="test-module"
        methodName="testMethod"
      />
    );
    expect(container.firstChild).toBe(null);
  });

  it("should render when isOpen is true", () => {
    render(
      <MethodCodeModal
        isOpen={true}
        onClose={mockOnClose}
        moduleName="test-module"
        methodName="testMethod"
      />
    );
    expect(screen.getByText("METHOD: TESTMETHOD")).toBeInTheDocument();
  });

  it("should display method code after loading", async () => {
    render(
      <MethodCodeModal
        isOpen={true}
        onClose={mockOnClose}
        moduleName="test-module"
        methodName="testMethod"
      />
    );

    await waitFor(() => {
      expect(screen.getByText("File Path:")).toBeInTheDocument();
      expect(screen.getByText("/modules/test-module.js")).toBeInTheDocument();
      expect(screen.getByText("Method Code:")).toBeInTheDocument();
      expect(screen.getByText(/function testMethod/)).toBeInTheDocument();
    });
  });

  it("should display not found message when method is not found", async () => {
    mockGetMethodCode.mockReturnValue({
      code: null,
      filePath: null,
    });

    render(
      <MethodCodeModal
        isOpen={true}
        onClose={mockOnClose}
        moduleName="non-existent"
        methodName="fakeMethod"
      />
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          "Method code not found or method is inherited from base class."
        )
      ).toBeInTheDocument();
    });
  });

  it("should handle missing methodName gracefully", () => {
    render(
      <MethodCodeModal
        isOpen={true}
        onClose={mockOnClose}
        moduleName="test-module"
        methodName={undefined}
      />
    );
    expect(screen.getByText("METHOD:")).toBeInTheDocument();
  });
});
