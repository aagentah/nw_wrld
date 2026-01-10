import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useIPCSend, useIPCInvoke, useIPCListener } from "../useIPC";
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
    getDir: vi.fn(() => null),
    isRequired: vi.fn(() => false),
    isDirAvailable: vi.fn(() => false),
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
    getBaseMethodNames: vi.fn(),
    getMethodCode: vi.fn(),
    getKickMp3ArrayBuffer: vi.fn(),
    isPackaged: vi.fn(),
  },
  messaging: mockMessaging as any,
};

describe("useIPCSend", () => {
  beforeEach(() => {
    globalThis.nwWrldBridge = mockBridge;
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete globalThis.nwWrldBridge;
  });

  it("should send message to projector", () => {
    const { result } = renderHook(() => useIPCSend("dashboard-to-projector"));

    result.current("module-introspect", { moduleId: "test-module" });

    expect(mockMessaging.sendToProjector).toHaveBeenCalledWith("module-introspect", {
      moduleId: "test-module",
    });
  });

  it("should send message to dashboard", () => {
    const { result } = renderHook(() => useIPCSend("projector-to-dashboard"));

    result.current("projector-ready" as any, {});

    expect(mockMessaging.sendToDashboard).toHaveBeenCalledWith("projector-ready", {});
  });

  it("should return early if messaging is not available", () => {
    delete globalThis.nwWrldBridge;

    const { result } = renderHook(() => useIPCSend("dashboard-to-projector"));

    result.current("module-introspect", { moduleId: "test-module" });

    expect(mockMessaging.sendToProjector).not.toHaveBeenCalled();
  });

  it("should not send if channel is unknown", () => {
    const { result } = renderHook(() => useIPCSend("unknown-channel" as any));

    result.current("module-introspect", { moduleId: "test-module" });

    expect(mockMessaging.sendToProjector).not.toHaveBeenCalled();
    expect(mockMessaging.sendToDashboard).not.toHaveBeenCalled();
  });
});

describe("useIPCInvoke", () => {
  beforeEach(() => {
    globalThis.nwWrldBridge = mockBridge;
    mockMessaging.configureInput.mockResolvedValue({ success: true });
    mockMessaging.getMidiDevices.mockResolvedValue([
      { id: "1", name: "Device 1" },
    ]);
    mockMessaging.selectWorkspace.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete globalThis.nwWrldBridge;
  });

  it("should invoke input:configure", async () => {
    const { result } = renderHook(() => useIPCInvoke());

    const config = { type: "midi" as const };
    await result.current("input:configure", config);

    expect(mockMessaging.configureInput).toHaveBeenCalledWith(config);
  });

  it("should invoke input:get-midi-devices", async () => {
    const { result } = renderHook(() => useIPCInvoke());

    const devices = await result.current("input:get-midi-devices");

    expect(mockMessaging.getMidiDevices).toHaveBeenCalled();
    expect(devices).toEqual([{ id: "1", name: "Device 1" }]);
  });

  it("should invoke workspace:select", async () => {
    const { result } = renderHook(() => useIPCInvoke());

    await result.current("workspace:select");

    expect(mockMessaging.selectWorkspace).toHaveBeenCalled();
  });

  it("should return null for unknown channels", async () => {
    const { result } = renderHook(() => useIPCInvoke());

    const response = await result.current("unknown-channel" as any);

    expect(response).toBeNull();
  });

  it("should return null if messaging is not available", async () => {
    delete globalThis.nwWrldBridge;

    const { result } = renderHook(() => useIPCInvoke());

    const response = await result.current("input:configure", {});

    expect(response).toBeNull();
  });
});

describe("useIPCListener", () => {
  beforeEach(() => {
    globalThis.nwWrldBridge = mockBridge;
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete globalThis.nwWrldBridge;
  });

  it("should listen to from-projector channel", () => {
    const cleanup = vi.fn();
    mockMessaging.onFromProjector.mockReturnValue(cleanup);

    const handler = vi.fn();
    const { unmount } = renderHook(() =>
      useIPCListener("from-projector", handler, [])
    );

    expect(mockMessaging.onFromProjector).toHaveBeenCalledWith(handler);

    unmount();
    expect(cleanup).toHaveBeenCalled();
  });

  it("should listen to from-dashboard channel", () => {
    const cleanup = vi.fn();
    mockMessaging.onFromDashboard.mockReturnValue(cleanup);

    const handler = vi.fn();
    const { unmount } = renderHook(() =>
      useIPCListener("from-dashboard", handler, [])
    );

    expect(mockMessaging.onFromDashboard).toHaveBeenCalledWith(handler);

    unmount();
    expect(cleanup).toHaveBeenCalled();
  });

  it("should listen to input-event channel", () => {
    const cleanup = vi.fn();
    mockMessaging.onInputEvent.mockReturnValue(cleanup);

    const handler = vi.fn();
    renderHook(() => useIPCListener("input-event", handler, []));

    expect(mockMessaging.onInputEvent).toHaveBeenCalledWith(handler);
  });

  it("should listen to input-status channel", () => {
    const cleanup = vi.fn();
    mockMessaging.onInputStatus.mockReturnValue(cleanup);

    const handler = vi.fn();
    renderHook(() => useIPCListener("input-status", handler, []));

    expect(mockMessaging.onInputStatus).toHaveBeenCalledWith(handler);
  });

  it("should listen to workspace:modulesChanged channel", () => {
    const cleanup = vi.fn();
    mockMessaging.onWorkspaceModulesChanged.mockReturnValue(cleanup);

    const handler = vi.fn();
    renderHook(() => useIPCListener("workspace:modulesChanged", handler, []));

    expect(mockMessaging.onWorkspaceModulesChanged).toHaveBeenCalledWith(handler);
  });

  it("should listen to workspace:lostSync channel", () => {
    const cleanup = vi.fn();
    mockMessaging.onWorkspaceLostSync.mockReturnValue(cleanup);

    const handler = vi.fn();
    renderHook(() => useIPCListener("workspace:lostSync", handler, []));

    expect(mockMessaging.onWorkspaceLostSync).toHaveBeenCalledWith(handler);
  });

  it("should not add listener for unknown channels", () => {
    const handler = vi.fn();
    renderHook(() =>
      useIPCListener("unknown-channel" as any, handler, [])
    );

    expect(mockMessaging.onFromProjector).not.toHaveBeenCalled();
    expect(mockMessaging.onFromDashboard).not.toHaveBeenCalled();
    expect(mockMessaging.onInputEvent).not.toHaveBeenCalled();
  });

  it("should return early if messaging is not available", () => {
    delete globalThis.nwWrldBridge;

    const handler = vi.fn();
    renderHook(() => useIPCListener("from-projector", handler, []));

    expect(mockMessaging.onFromProjector).not.toHaveBeenCalled();
  });

  it("should cleanup listener on unmount", () => {
    const cleanup = vi.fn();
    mockMessaging.onFromProjector.mockReturnValue(cleanup);

    const handler = vi.fn();
    const { unmount } = renderHook(() =>
      useIPCListener("from-projector", handler, [])
    );

    unmount();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("should re-register listener when handler changes", () => {
    const cleanup1 = vi.fn();
    const cleanup2 = vi.fn();
    mockMessaging.onFromProjector
      .mockReturnValueOnce(cleanup1)
      .mockReturnValueOnce(cleanup2);

    const handler1 = vi.fn();
    const { rerender } = renderHook(
      ({ handler }) => useIPCListener("from-projector", handler, []),
      { initialProps: { handler: handler1 } }
    );

    expect(cleanup1).not.toHaveBeenCalled();

    const handler2 = vi.fn();
    rerender({ handler: handler2 });

    expect(cleanup1).toHaveBeenCalledTimes(1);
    expect(mockMessaging.onFromProjector).toHaveBeenCalledTimes(2);
  });
});
