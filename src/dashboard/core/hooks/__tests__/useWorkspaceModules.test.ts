import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useWorkspaceModules } from "../useWorkspaceModules";
import type { UserData } from "../../../../types";
import type { NwWrldBridge } from "../../../../types/bridge";

// Store handlers for testing
const mockHandlers: Record<string, (event: unknown, data: unknown) => void> = {};

// Mock the utils to avoid import issues
vi.mock("../../utils.js", () => ({
  updateUserData: vi.fn((setUserData, fn) => {
    setUserData((prev: any) => {
      const draft = JSON.parse(JSON.stringify(prev));
      fn(draft);
      return draft;
    });
  }),
}));

// Mock useIPCListener to avoid actual IPC calls
vi.mock("../useIPC.js", () => ({
  useIPCListener: vi.fn((channel, handler, deps) => {
    // Store handlers by channel so tests can trigger them
    mockHandlers[channel] = handler;
  }),
}));

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

const mockWorkspace = {
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
  workspace: mockWorkspace,
  app: {
    getBaseMethodNames: vi.fn(() => ({ moduleBase: [], threeBase: [] })),
    getMethodCode: vi.fn(() => ({ code: null, filePath: null })),
    getKickMp3ArrayBuffer: vi.fn(() => null),
    isPackaged: vi.fn(() => false),
  },
  messaging: mockMessaging as any,
};

describe("useWorkspaceModules", () => {
  let mockUserData: UserData;

  beforeEach(() => {
    // Clear mock handlers before each test
    Object.keys(mockHandlers).forEach(key => delete mockHandlers[key]);

    globalThis.nwWrldBridge = mockBridge;
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});

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
          midi: {},
          osc: {},
        },
        channelMappings: {
          midi: {},
          osc: {},
        },
        activeSetId: null,
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
              modules: [{ id: "mod1", type: "oldModuleId" }],
              modulesData: {},
            },
          ],
        },
      ],
    };

    mockWorkspace.listModuleSummaries.mockResolvedValue([
      {
        file: "module1.js",
        id: "moduleId1",
        name: "Module One",
        category: "effects",
        hasMetadata: true,
      },
      {
        file: "module2.js",
        id: "moduleId2",
        name: "Module Two",
        category: "generators",
        hasMetadata: true,
      },
    ]);

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete globalThis.nwWrldBridge;
  });

  it("should load modules on mount", async () => {
    const setPredefinedModules = vi.fn();
    const setWorkspaceModuleFiles = vi.fn();
    const sendToProjector = vi.fn();

    renderHook(() =>
      useWorkspaceModules({
        workspacePath: "/test/workspace",
        isWorkspaceModalOpen: false,
        sendToProjector,
        userData: mockUserData,
        setUserData: vi.fn(),
        predefinedModules: [],
        workspaceModuleFiles: [],
        setPredefinedModules,
        setWorkspaceModuleFiles,
        setWorkspaceModuleLoadFailures: vi.fn(),
        setIsProjectorReady: vi.fn(),
        didMigrateWorkspaceModuleTypesRef: { current: false },
        loadModulesRunIdRef: { current: 0 },
      })
    );

    await waitFor(() => {
      expect(mockWorkspace.listModuleSummaries).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(setPredefinedModules).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: "moduleId1",
            name: "Module One",
            category: "effects",
          }),
        ])
      );
    });
  });

  it("should not load modules when workspace modal is open", async () => {
    const setPredefinedModules = vi.fn();
    const setWorkspaceModuleFiles = vi.fn();

    renderHook(() =>
      useWorkspaceModules({
        workspacePath: "/test/workspace",
        isWorkspaceModalOpen: true,
        sendToProjector: vi.fn(),
        userData: mockUserData,
        setUserData: vi.fn(),
        predefinedModules: [],
        workspaceModuleFiles: [],
        setPredefinedModules,
        setWorkspaceModuleFiles,
        setWorkspaceModuleLoadFailures: vi.fn(),
        setIsProjectorReady: vi.fn(),
        didMigrateWorkspaceModuleTypesRef: { current: false },
        loadModulesRunIdRef: { current: 0 },
      })
    );

    await waitFor(() => {
      expect(mockWorkspace.listModuleSummaries).not.toHaveBeenCalled();
    });
  });

  it("should filter out modules without valid metadata", async () => {
    mockWorkspace.listModuleSummaries.mockResolvedValue([
      {
        file: "module1.js",
        id: "moduleId1",
        name: "Module One",
        category: "effects",
        hasMetadata: true,
      },
      {
        file: "module2.js",
        id: "123invalid",
        name: "Module Two",
        category: "generators",
        hasMetadata: true,
      },
      {
        file: "module3.js",
        id: "moduleId3",
        name: "",
        category: "effects",
        hasMetadata: true,
      },
    ]);

    const setPredefinedModules = vi.fn();
    const setWorkspaceModuleFiles = vi.fn();

    renderHook(() =>
      useWorkspaceModules({
        workspacePath: "/test/workspace",
        isWorkspaceModalOpen: false,
        sendToProjector: vi.fn(),
        userData: mockUserData,
        setUserData: vi.fn(),
        predefinedModules: [],
        workspaceModuleFiles: [],
        setPredefinedModules,
        setWorkspaceModuleFiles,
        setWorkspaceModuleLoadFailures: vi.fn(),
        setIsProjectorReady: vi.fn(),
        didMigrateWorkspaceModuleTypesRef: { current: false },
        loadModulesRunIdRef: { current: 0 },
      })
    );

    await waitFor(() => {
      expect(setPredefinedModules).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: "moduleId1",
          }),
        ])
      );
    });

    const call = setPredefinedModules.mock.calls[0]?.[0];
    expect(call).toHaveLength(1);
    expect(call[0].id).toBe("moduleId1");
  });

  it("should migrate old module type names to new IDs", async () => {
    const setUserData = vi.fn();
    const setPredefinedModules = vi.fn();

    mockWorkspace.listModuleSummaries.mockResolvedValue([
      {
        file: "module1.js",
        id: "moduleId1",
        name: "oldModuleId",
        category: "effects",
        hasMetadata: true,
      },
    ]);

    renderHook(() =>
      useWorkspaceModules({
        workspacePath: "/test/workspace",
        isWorkspaceModalOpen: false,
        sendToProjector: vi.fn(),
        userData: mockUserData,
        setUserData,
        predefinedModules: [
          {
            id: "moduleId1",
            name: "oldModuleId",
            category: "effects",
            methods: [],
            status: "uninspected",
          },
        ],
        workspaceModuleFiles: ["moduleId1"],
        setPredefinedModules,
        setWorkspaceModuleFiles: vi.fn(),
        setWorkspaceModuleLoadFailures: vi.fn(),
        setIsProjectorReady: vi.fn(),
        didMigrateWorkspaceModuleTypesRef: { current: false },
        loadModulesRunIdRef: { current: 0 },
      })
    );

    await waitFor(() => {
      expect(setUserData).toHaveBeenCalled();
    });
  });

  it("should reload modules on workspace:modulesChanged event", async () => {
    const setPredefinedModules = vi.fn();
    const setWorkspaceModuleFiles = vi.fn();

    const { rerender } = renderHook(
      ({ workspacePath }) =>
        useWorkspaceModules({
          workspacePath,
          isWorkspaceModalOpen: false,
          sendToProjector: vi.fn(),
          userData: mockUserData,
          setUserData: vi.fn(),
          predefinedModules: [],
          workspaceModuleFiles: [],
          setPredefinedModules,
          setWorkspaceModuleFiles,
          setWorkspaceModuleLoadFailures: vi.fn(),
          setIsProjectorReady: vi.fn(),
          didMigrateWorkspaceModuleTypesRef: { current: true },
          loadModulesRunIdRef: { current: 0 },
        }),
      { initialProps: { workspacePath: "/test/workspace" } }
    );

    await waitFor(() => {
      expect(mockWorkspace.listModuleSummaries).toHaveBeenCalledTimes(1);
    });

    // Simulate the modules changed event by triggering the registered handler
    const handler = mockHandlers["workspace:modulesChanged"];
    if (handler) {
      act(() => {
        handler(null, {});
      });
    }

    await waitFor(() => {
      expect(mockWorkspace.listModuleSummaries).toHaveBeenCalledTimes(2);
    });
  });

  it("should return loadModules function", () => {
    const { result } = renderHook(() =>
      useWorkspaceModules({
        workspacePath: "/test/workspace",
        isWorkspaceModalOpen: false,
        sendToProjector: vi.fn(),
        userData: mockUserData,
        setUserData: vi.fn(),
        predefinedModules: [],
        workspaceModuleFiles: [],
        setPredefinedModules: vi.fn(),
        setWorkspaceModuleFiles: vi.fn(),
        setWorkspaceModuleLoadFailures: vi.fn(),
        setIsProjectorReady: vi.fn(),
        didMigrateWorkspaceModuleTypesRef: { current: false },
        loadModulesRunIdRef: { current: 0 },
      })
    );

    expect(result.current.loadModules).toBeDefined();
    expect(typeof result.current.loadModules).toBe("function");
  });
});
