import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NewModuleDialog } from "../NewModuleDialog";
import type { NwWrldBridge } from "../../../../src/types/bridge";

const mockBridge = {
  workspace: {
    moduleExists: vi.fn(),
  },
} as any;

describe("NewModuleDialog", () => {
  beforeEach(() => {
    globalThis.nwWrldBridge = mockBridge;
    mockBridge.workspace.moduleExists.mockReturnValue(false);
  });

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onCreateModule: vi.fn(),
    workspacePath: "/workspace",
  };

  it("should render dialog when open", () => {
    render(<NewModuleDialog {...defaultProps} />);

    expect(screen.getByText("CREATE MODULE FROM TEMPLATE")).toBeInTheDocument();
  });

  it("should not render dialog when closed", () => {
    render(<NewModuleDialog {...defaultProps} isOpen={false} />);

    expect(screen.queryByText("CREATE MODULE FROM TEMPLATE")).not.toBeInTheDocument();
  });

  it("should validate module name format", async () => {
    const user = userEvent.setup();
    render(<NewModuleDialog {...defaultProps} />);

    const input = screen.getByPlaceholderText("MyCustomModule");
    await user.type(input, "invalid-name");

    const createButton = screen.getByText("Create Module");
    // Button is enabled while typing - validation happens on submit
    expect(createButton).not.toHaveAttribute("aria-disabled", "true");

    // Clicking create should show error
    await user.click(createButton);
    // Check for the error message (red text class)
    const errorElements = document.getElementsByClassName("text-red-400");
    expect(errorElements.length).toBeGreaterThan(0);
    expect(errorElements[0].textContent).toContain("uppercase letter");
  });

  it("should accept valid module name", async () => {
    const user = userEvent.setup();
    render(<NewModuleDialog {...defaultProps} />);

    const input = screen.getByPlaceholderText("MyCustomModule");
    await user.type(input, "MyValidModule");

    // Button should be clickable (no aria-disabled)
    const createButton = screen.getByText("Create Module");
    expect(createButton).not.toHaveAttribute("aria-disabled");
  });

  it("should call onCreateModule when form is submitted", async () => {
    const user = userEvent.setup();
    const onCreateModule = vi.fn();
    const props = { ...defaultProps, onCreateModule };

    render(<NewModuleDialog {...props} />);

    const input = screen.getByPlaceholderText("MyCustomModule");
    await user.type(input, "TestModule");

    const createButton = screen.getByText("Create Module");
    await user.click(createButton);

    expect(onCreateModule).toHaveBeenCalledWith("TestModule", "basic");
  });

  it("should display template options", () => {
    render(<NewModuleDialog {...defaultProps} />);

    expect(screen.getByText("Basic (DOM/Canvas)")).toBeInTheDocument();
    expect(screen.getByText("Three.js (3D)")).toBeInTheDocument();
    expect(screen.getByText("p5.js (2D Canvas)")).toBeInTheDocument();
  });
});
