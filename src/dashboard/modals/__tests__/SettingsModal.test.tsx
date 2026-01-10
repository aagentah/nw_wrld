import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { SettingsModal } from "../SettingsModal";

const mockInputConfig = {
  type: "midi" as const,
  deviceName: "",
  trackSelectionChannel: 0,
  methodTriggerChannel: 0,
  velocitySensitive: false,
  port: 8000,
};

describe("SettingsModal", () => {
  const mockOnClose = vi.fn();
  const mockSetAspectRatio = vi.fn();
  const mockSetBgColor = vi.fn();
  const mockSetInputConfig = vi.fn();
  const mockOnOpenMappings = vi.fn();
  const mockOnSelectWorkspace = vi.fn();
  const mockUpdateConfig = vi.fn();
  const mockConfig = {
    sequencerMode: false,
    sequencerBpm: 120,
    userColors: [],
    input: mockInputConfig,
    trackMappings: { midi: {}, osc: {} },
    channelMappings: { midi: {}, osc: {} },
    activeSetId: "set1",
    activeTrackId: null,
    autoRefresh: true,
  };

  const mockSettings = {
    aspectRatios: [
      { id: "16-9", label: "16:9", width: "16", height: "9" },
      { id: "4-3", label: "4:3", width: "4", height: "3" },
    ],
    backgroundColors: [
      { id: "black", label: "Black", value: "#000000" },
      { id: "white", label: "White", value: "#ffffff" },
    ],
    input: mockInputConfig,
    autoRefresh: true,
  };

  const mockAvailableMidiDevices = [
    { id: "device1", name: "Device 1" },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should not render when isOpen is false", () => {
    const { container } = render(
      <SettingsModal
        isOpen={false}
        onClose={mockOnClose}
        aspectRatio="16-9"
        setAspectRatio={mockSetAspectRatio}
        bgColor="black"
        setBgColor={mockSetBgColor}
        settings={mockSettings}
        inputConfig={mockInputConfig}
        setInputConfig={mockSetInputConfig}
        availableMidiDevices={mockAvailableMidiDevices}
        onOpenMappings={mockOnOpenMappings}
        config={mockConfig}
        updateConfig={mockUpdateConfig}
        workspacePath={null}
        onSelectWorkspace={mockOnSelectWorkspace}
      />
    );
    expect(container.firstChild).toBe(null);
  });

  it("should render when isOpen is true", () => {
    render(
      <SettingsModal
        isOpen={true}
        onClose={mockOnClose}
        aspectRatio="16-9"
        setAspectRatio={mockSetAspectRatio}
        bgColor="black"
        setBgColor={mockSetBgColor}
        settings={mockSettings}
        inputConfig={mockInputConfig}
        setInputConfig={mockSetInputConfig}
        availableMidiDevices={mockAvailableMidiDevices}
        onOpenMappings={mockOnOpenMappings}
        config={mockConfig}
        updateConfig={mockUpdateConfig}
        workspacePath={null}
        onSelectWorkspace={mockOnSelectWorkspace}
      />
    );
    expect(screen.getByText("SETTINGS")).toBeInTheDocument();
  });

  it("should display Signal Source section", () => {
    render(
      <SettingsModal
        isOpen={true}
        onClose={mockOnClose}
        aspectRatio="16-9"
        setAspectRatio={mockSetAspectRatio}
        bgColor="black"
        setBgColor={mockSetBgColor}
        settings={mockSettings}
        inputConfig={mockInputConfig}
        setInputConfig={mockSetInputConfig}
        availableMidiDevices={mockAvailableMidiDevices}
        onOpenMappings={mockOnOpenMappings}
        config={mockConfig}
        updateConfig={mockUpdateConfig}
        workspacePath={null}
        onSelectWorkspace={mockOnSelectWorkspace}
      />
    );
    expect(screen.getByText(/Signal Source:/)).toBeInTheDocument();
  });
});
