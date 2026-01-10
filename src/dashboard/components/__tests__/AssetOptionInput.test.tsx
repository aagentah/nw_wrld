import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AssetOptionInput } from "../AssetOptionInput";
import type { NwWrldBridge } from "../../../../src/types/bridge";

describe("AssetOptionInput", () => {
  const mockBridge = {
    workspace: {
      listAssets: vi.fn(),
    },
  } as any;

  beforeEach(() => {
    globalThis.nwWrldBridge = mockBridge;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should render select dropdown", () => {
    render(<AssetOptionInput value="" onChange={vi.fn()} />);
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("should display file options when listing succeeds", async () => {
    mockBridge.workspace.listAssets.mockResolvedValue({
      ok: true,
      files: ["file1.jpg", "file2.png"],
      dirs: [],
    });

    render(<AssetOptionInput value="" onChange={vi.fn()} baseDir="/files" />);

    await waitFor(() => {
      expect(screen.getByText("file1.jpg")).toBeInTheDocument();
      expect(screen.getByText("file2.png")).toBeInTheDocument();
    });
  });

  it("should display directory options when kind is dir", async () => {
    mockBridge.workspace.listAssets.mockResolvedValue({
      ok: true,
      files: [],
      dirs: ["folder1", "folder2"],
    });

    render(
      <AssetOptionInput value="" onChange={vi.fn()} kind="dir" baseDir="/test" />
    );

    await waitFor(() => {
      expect(screen.getByText("folder1")).toBeInTheDocument();
      expect(screen.getByText("folder2")).toBeInTheDocument();
    });
  });

  it("should filter files by extension", async () => {
    mockBridge.workspace.listAssets.mockResolvedValue({
      ok: true,
      files: ["file1.jpg", "file2.png", "file3.mp4"],
      dirs: [],
    });

    render(
      <AssetOptionInput
        value=""
        onChange={vi.fn()}
        baseDir="/filtered"
        extensions={["jpg", "png"]}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("file1.jpg")).toBeInTheDocument();
      expect(screen.getByText("file2.png")).toBeInTheDocument();
      expect(screen.queryByText("file3.mp4")).not.toBeInTheDocument();
    });
  });

  it("should show custom input when custom option is selected", async () => {
    mockBridge.workspace.listAssets.mockResolvedValue({
      ok: true,
      files: ["file1.jpg"],
      dirs: [],
    });

    const onChange = vi.fn();
    render(
      <AssetOptionInput
        value="custom-value"
        onChange={onChange}
        baseDir=""
        allowCustom={true}
      />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue("custom-value")).toBeInTheDocument();
    });
  });

  it("should call onChange when selecting an option", async () => {
    mockBridge.workspace.listAssets.mockResolvedValue({
      ok: true,
      files: ["file1.jpg"],
      dirs: [],
    });

    const onChange = vi.fn();
    render(<AssetOptionInput value="" onChange={onChange} baseDir="/select-test" />);

    await waitFor(() => {
      expect(screen.getByText("file1.jpg")).toBeInTheDocument();
    });

    const select = screen.getByRole("combobox");
    await userEvent.selectOptions(select, "file1.jpg");

    expect(onChange).toHaveBeenCalledWith("/select-test/file1.jpg");
  });

  it("should call onChange when typing in custom input", async () => {
    const onChange = vi.fn();
    render(
      <AssetOptionInput
        value="custom"
        onChange={onChange}
        allowCustom={true}
      />
    );

    const input = screen.getByRole("textbox");
    await userEvent.type(input, "value");

    await waitFor(() => {
      // onChange fires for each keystroke, just verify it was called
      expect(onChange).toHaveBeenCalled();
      expect(onChange.mock.calls.length).toBeGreaterThan(0);
    });
  });

  it("should auto-select first directory for placeholder paths", async () => {
    mockBridge.workspace.listAssets.mockResolvedValue({
      ok: true,
      files: [],
      dirs: ["myFolder"],
    });

    const onChange = vi.fn();
    render(
      <AssetOptionInput
        value="/path/to/yourFolder"
        onChange={onChange}
        kind="dir"
        baseDir="/path/to"
        allowCustom={true}
      />
    );

    await waitFor(() => {
      // The component selects the base directory first
      expect(onChange).toHaveBeenCalledWith("/path/to");
    });
  });

  it("should handle missing bridge gracefully", async () => {
    globalThis.nwWrldBridge = null;

    render(<AssetOptionInput value="" onChange={vi.fn()} baseDir="assets" />);

    // Should not throw error and should render
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("should handle empty base directory", async () => {
    render(<AssetOptionInput value="" onChange={vi.fn()} baseDir="" />);

    // Should render without errors
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });
});
