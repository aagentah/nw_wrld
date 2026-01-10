import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useInputEvents } from "../useInputEvents";
import type { UserData, Track, SetId, TrackId } from "../../../../types";
import type { NwWrldBridge } from "../../../../types/bridge";

const mockMessaging = {
  sendToProjector: vi.fn(),
  sendToDashboard: vi.fn(),
  configureInput: vi.fn(),
  getMidiDevices: vi.fn(),
  selectWorkspace: vi.fn(),
  onFromProjector: vi.fn(),
  onFromDashboard: vi.fn(),
  onInputEvent: vi.fn(),
  onInputStatus: vi.fn(),
  onWorkspaceModulesChanged: vi.fn(),
  onWorkspaceLostSync: vi.fn(),
};

const mockBridge: NwWrldBridge = {
  project: {
    getDir: vi.fn(() => "/test/project"),
    isRequired: vi.fn(() => false),
    isDirAvailable: vi.fn(() => true),
  },
  sandbox: {
    registerToken: vi.fn(),
    unregisterToken: vi.fn(),
    ensure: vi.fn(),
    request: vi.fn(),
    destroy: vi.fn(),
  },
  workspace: {
    listModuleFiles: vi.fn(),
    listModuleSummaries: vi.fn(),
    getModuleUrl: vi.fn(),
    readModuleText: vi.fn(),
    readModuleWithMeta: vi.fn(),
    writeModuleTextSync: vi.fn(),
    moduleExists: vi.fn(),
    showModuleInFolder: vi.fn(),
    assetUrl: vi.fn(),
    listAssets: vi.fn(),
    readAssetText: vi.fn(),
  },
  app: {
    getBaseMethodNames: vi.fn(() => ({ moduleBase: [], threeBase: [] })),
    getMethodCode: vi.fn(() => ({ code: null, filePath: null })),
    getKickMp3ArrayBuffer: vi.fn(() => null),
    isPackaged: vi.fn(() => false),
  },
  messaging: mockMessaging as any,
};

describe("useInputEvents", () => {
  let mockUserData: UserData;
  let mockActiveSetId: SetId;
  let mockHandlers: {
    userDataRef: React.MutableRefObject<UserData>;
    activeTrackIdRef: React.MutableRefObject<TrackId>;
    activeSetIdRef: React.MutableRefObject<SetId>;
    recordingStateRef: React.MutableRefObject<Record<TrackId, { startTime: number; isRecording: boolean }>>;
    triggerMapsRef: React.MutableRefObject<any>;
    setActiveTrackId: ReturnType<typeof vi.fn>;
    setRecordingData: ReturnType<typeof vi.fn>;
    setRecordingState: ReturnType<typeof vi.fn>;
    flashChannel: ReturnType<typeof vi.fn>;
    setFlashingConstructors: ReturnType<typeof vi.fn>;
    setInputStatus: ReturnType<typeof vi.fn>;
    setDebugLogs: ReturnType<typeof vi.fn>;
    sendToProjector: ReturnType<typeof vi.fn>;
    setIsProjectorReady: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    globalThis.nwWrldBridge = mockBridge;

    mockActiveSetId = "set_1";
    mockUserData = {
      config: {
        input: {
          type: "midi",
          deviceName: "Test Device",
          trackSelectionChannel: 1,
          methodTriggerChannel: 2,
          velocitySensitive: false,
          port: 8000,
        },
        trackMappings: {
          midi: { 1: "C3", 2: "D3" },
          osc: { 1: "/track/1", 2: "/track/2" },
        },
        channelMappings: {
          midi: {},
          osc: {},
        },
        activeSetId: "set_1",
        activeTrackId: null,
        sequencerMode: true,
        sequencerBpm: 120,
      },
      sets: [
        {
          id: "set_1",
          name: "Set 1",
          tracks: [
            {
              id: 1,
              name: "Track 1",
              modules: [],
              modulesData: {},
              trackSlot: 1,
              channelMappings: {},
            },
            {
              id: 2,
              name: "Track 2",
              modules: [],
              modulesData: {},
              trackSlot: 2,
              channelMappings: {},
            },
          ],
        },
      ],
    };

    const createRef = <T,>(initial: T) => ({ current: initial });

    mockHandlers = {
      userDataRef: createRef(mockUserData),
      activeTrackIdRef: createRef(1 as TrackId),
      activeSetIdRef: createRef(mockActiveSetId),
      recordingStateRef: createRef({}),
      triggerMapsRef: createRef({
        trackTriggersMap: {},
        channelTriggersMap: {},
      }),
      setActiveTrackId: vi.fn(),
      setRecordingData: vi.fn(),
      setRecordingState: vi.fn(),
      flashChannel: vi.fn(),
      setFlashingConstructors: vi.fn(),
      setInputStatus: vi.fn(),
      setDebugLogs: vi.fn(),
      sendToProjector: vi.fn(),
      setIsProjectorReady: vi.fn(),
    };

    vi.clearAllMocks();
  });

  afterEach(() => {
    delete globalThis.nwWrldBridge;
  });

  it("should initialize and register IPC listeners", () => {
    renderHook(() =>
      useInputEvents({
        userData: mockUserData,
        activeSetId: mockActiveSetId,
        isDebugOverlayOpen: false,
        ...mockHandlers,
      })
    );

    expect(mockMessaging.onInputStatus).toHaveBeenCalled();
    expect(mockMessaging.onFromProjector).toHaveBeenCalled();
    expect(mockMessaging.onInputEvent).toHaveBeenCalled();
  });

  it("should handle input-status events", () => {
    renderHook(() =>
      useInputEvents({
        userData: mockUserData,
        activeSetId: mockActiveSetId,
        isDebugOverlayOpen: false,
        ...mockHandlers,
      })
    );

    const calls = mockMessaging.onInputStatus.mock.calls;
    if (calls.length === 0) return;

    const onInputStatusCallback = calls[0][0];
    if (!onInputStatusCallback) return;

    expect(onInputStatusCallback).toBeDefined();

    const mockPayload = {
      type: "input-status" as const,
      data: {
        status: "connected" as const,
        message: "Connected",
        config: mockUserData.config.input,
      },
    };

    onInputStatusCallback(null, mockPayload);

    expect(mockHandlers.setInputStatus).toHaveBeenCalledWith(mockPayload.data);
  });

  it("should send debug overlay visibility", () => {
    const sendToProjectorMock = vi.fn();
    renderHook(
      ({ isDebugOverlayOpen }) =>
        useInputEvents({
          userData: mockUserData,
          activeSetId: mockActiveSetId,
          ...mockHandlers,
          sendToProjector: sendToProjectorMock,
          isDebugOverlayOpen,
        }),
      { initialProps: { isDebugOverlayOpen: false } }
    );

    expect(sendToProjectorMock).toHaveBeenCalledWith(
      "debug-overlay-visibility",
      { isOpen: false }
    );
  });

  it("should handle projector-ready event", () => {
    let capturedHandler: ((event: unknown, data: unknown) => void) | undefined;

    mockMessaging.onFromProjector.mockImplementation((handler: (event: unknown, data: unknown) => void) => {
      capturedHandler = handler;
      return vi.fn();
    });

    renderHook(() =>
      useInputEvents({
        userData: mockUserData,
        activeSetId: mockActiveSetId,
        isDebugOverlayOpen: false,
        ...mockHandlers,
      })
    );

    expect(capturedHandler).toBeDefined();

    act(() => {
      if (capturedHandler) {
        capturedHandler(null, { type: "projector-ready", props: {} });
      }
    });

    expect(mockHandlers.setIsProjectorReady).toHaveBeenCalledWith(true);
  });

  it("should handle debug-log events from projector", () => {
    renderHook(() =>
      useInputEvents({
        userData: mockUserData,
        activeSetId: mockActiveSetId,
        isDebugOverlayOpen: false,
        ...mockHandlers,
      })
    );

    const calls = mockMessaging.onFromProjector.mock.calls;
    if (calls.length === 0) return;

    const validCall = calls.find(
      (call: any[]) => call && call[0]
    );

    if (!validCall) return;

    const onFromProjectorCallback = validCall[0];
    expect(onFromProjectorCallback).toBeDefined();

    onFromProjectorCallback(null, {
      type: "debug-log",
      props: { log: "Test log entry\n\nSecond entry" },
    });

    expect(mockHandlers.setDebugLogs).toHaveBeenCalled();
    const setDebugLogsCalls = mockHandlers.setDebugLogs.mock.calls;
    expect(setDebugLogsCalls.length).toBeGreaterThan(0);
  });
});
