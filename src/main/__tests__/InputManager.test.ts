/**
 * InputManager Tests
 *
 * Tests for the Electron main process InputManager that handles MIDI and OSC input.
 * Following TDD principles with comprehensive coverage of all functionality.
 */

// @vitest-environment node

// Set environment to node for main process tests
process.env.TZ = 'UTC';

// Mock navigator.requestMIDIAccess to prevent browser API errors
// This must be before any imports or mocks
if (typeof navigator !== 'undefined') {
  (navigator as any).requestMIDIAccess = () => Promise.resolve({
    inputs: [],
    outputs: [],
    sysexEnabled: false,
    onstatechange: null,
  });
}

// Prevent webmidi from requiring jzz and other Node.js modules
// In Node environment, we need to use Object.defineProperty to add navigator
if (typeof global !== 'undefined') {
  if (!(global as any).navigator) {
    Object.defineProperty(global, 'navigator', {
      value: {
        requestMIDIAccess: () => Promise.resolve({
          inputs: [],
          outputs: [],
          sysexEnabled: false,
          onstatechange: null,
        }),
      },
      writable: true,
      configurable: true,
    });
  }
  // Mock jzz if webmidi tries to require it
  (global as any).jzz = null;
}

// Note: We use manual mocks for webmidi and osc packages
// See __mocks__/webmidi.js and __mocks__/osc.js
// These mocks are automatically picked up by vitest

// Track osc port creation at module level (outside vi.mock to avoid hoisting issues)
let oscCallCount = 0;
let oscLastCreatedPort: any = null;
let oscShouldThrow: Error | null = null;

// Track webmidi state at module level (outside vi.mock to avoid hoisting issues)
let webMidiEnabled = false;
let webMidiInputs: any[] = [];
let webMidiOutputs: any[] = [];
let webMidiSupport = false;

// The manual mocks need vi.fn() for spy functionality
// We'll create vi.fn() spies and attach them to the manual mocks after import
vi.mock("webmidi", () => {
  const WebMidiMock = {
    enable: vi.fn().mockImplementation((options?: any, callback?: any) => {
      webMidiEnabled = true;
      webMidiSupport = true;
      // Support both callback-based and promise-based API
      if (callback) {
        setTimeout(() => callback(null), 0);
        return WebMidiMock as any;
      }
      // Return a promise that resolves on next tick to ensure state is set
      return new Promise((resolve) => {
        process.nextTick(() => resolve(WebMidiMock));
      });
    }),
    disable: vi.fn().mockImplementation(() => {
      webMidiEnabled = false;
      webMidiInputs = [];
      webMidiOutputs = [];
      return Promise.resolve();
    }),
    getInputById: vi.fn().mockImplementation((id: string) => {
      return webMidiInputs.find((input) => input.id === id) || null;
    }),
    getInputByName: vi.fn().mockImplementation((name: string) => {
      return webMidiInputs.find((input) => input.name === name) || null;
    }),
    getOutputById: vi.fn(() => null),
    getOutputByName: vi.fn(() => null),
  };

  // Define properties with getters/setters
  Object.defineProperty(WebMidiMock, 'enabled', {
    get: () => webMidiEnabled,
    set: (value: boolean) => { webMidiEnabled = value; },
    enumerable: true,
    configurable: true,
  });

  Object.defineProperty(WebMidiMock, 'inputs', {
    get: () => webMidiInputs,
    set: (value: any[]) => { webMidiInputs = value; },
    enumerable: true,
    configurable: true,
  });

  Object.defineProperty(WebMidiMock, 'outputs', {
    get: () => webMidiOutputs,
    set: (value: any[]) => { webMidiOutputs = value; },
    enumerable: true,
    configurable: true,
  });

  Object.defineProperty(WebMidiMock, 'sysexEnabled', {
    get: () => false,
    enumerable: true,
    configurable: true,
  });

  Object.defineProperty(WebMidiMock, 'support', {
    get: () => webMidiSupport,
    set: (value: boolean) => { webMidiSupport = value; },
    enumerable: true,
    configurable: true,
  });

  Object.defineProperty(WebMidiMock, 'supported', {
    get: () => webMidiSupport,
    enumerable: true,
    configurable: true,
  });

  Object.defineProperty(WebMidiMock, 'time', {
    get: () => 0,
    enumerable: true,
    configurable: true,
  });

  Object.defineProperty(WebMidiMock, 'version', {
    get: () => '3.1.14-mock',
    enumerable: true,
    configurable: true,
  });

  // Add _state for test compatibility
  Object.defineProperty(WebMidiMock, '_state', {
    get: () => ({
      enabled: webMidiEnabled,
      inputs: webMidiInputs,
      outputs: webMidiOutputs,
      sysexEnabled: false,
      support: webMidiSupport,
      time: 0,
    }),
    enumerable: false,
  });

  // Return mock with __esModule marker for proper ES6 module mocking
  // Also export stub classes to match real webmidi exports
  return {
    __esModule: true,
    WebMidi: WebMidiMock,
    Input: class Input {},
    Output: class Output {},
    InputChannel: class InputChannel {},
    OutputChannel: class OutputChannel {},
    Note: class Note {},
    Message: class Message {},
    Forwarder: class Forwarder {},
    Utilities: { isNode: false, isBrowser: true },
    Enumerations: {},
    default: { WebMidi: WebMidiMock },
  };
});

// Mock osc with inline factory that includes tracking
vi.mock("osc", () => {
  const EventEmitter = require("events").EventEmitter;
  const UDPPortSpy = vi.fn().mockImplementation(() => {
    console.log("[INLINE MOCK] UDPPort constructor called! Call #", ++oscCallCount);
    // Check if we should throw an error (for testing error handling)
    if (oscShouldThrow) {
      console.log("[INLINE MOCK] Throwing error:", oscShouldThrow.message);
      throw oscShouldThrow;
    }
    const mockPort = new EventEmitter();
    // Use Object.assign to ensure EventEmitter methods are included
    const port = Object.assign(mockPort, {
      open: vi.fn().mockImplementation(() => {
        console.log("[INLINE MOCK] UDP port open() called");
        // Emit 'ready' event after open
        process.nextTick(() => {
          mockPort.emit("ready");
        });
      }),
      close: vi.fn(),
    });
    // Store reference to this port
    oscLastCreatedPort = port;
    console.log("[INLINE MOCK] Created port, oscLastCreatedPort:", oscLastCreatedPort ? 'SET' : 'NULL');
    return port;
  });
  // Add tracking properties directly to the function
  (UDPPortSpy as any).callCount = 0;
  (UDPPortSpy as any).lastCreatedPort = null;
  // Add getters that track state
  Object.defineProperty(UDPPortSpy, "callCount", {
    get: () => oscCallCount,
    enumerable: false,
    configurable: true,
  });
  Object.defineProperty(UDPPortSpy, "lastCreatedPort", {
    get: () => oscLastCreatedPort,
    enumerable: false,
    configurable: true,
  });
  return {
    UDPPort: UDPPortSpy,
    default: { UDPPort: UDPPortSpy },
  };
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "events";

// Import after mocks are set up
import { WebMidi } from "webmidi";
// Use require() for osc to match how InputManager uses it
const osc = require("osc");

// Debug: Check what osc actually is
console.log("[TEST SETUP] osc module loaded:", typeof osc);
console.log("[TEST SETUP] osc.UDPPort:", typeof osc.UDPPort);
console.log("[TEST SETUP] osc.UDPPort.callCount:", (osc.UDPPort as any).callCount);
console.log("[TEST SETUP] osc.UDPPort.lastCreatedPort:", (osc.UDPPort as any).lastCreatedPort);
console.log("[TEST SETUP] WebMidi imported:", typeof WebMidi);
console.log("[TEST SETUP] WebMidi.enable:", typeof WebMidi.enable);
console.log("[TEST SETUP] WebMidi.enabled:", WebMidi.enabled);
console.log("[TEST SETUP] WebMidi is mock:", (WebMidi as any).version === '3.1.14-mock');

// Mock the constants and validation
const mockInputStatus = {
  DISCONNECTED: "disconnected",
  CONNECTING: "connecting",
  CONNECTED: "connected",
  ERROR: "error",
};

vi.mock("../shared/constants/inputStatus", () => ({
  __esModule: true,
  INPUT_STATUS: mockInputStatus,
  default: mockInputStatus,
}));

vi.mock("../shared/validation/oscValidation", () => ({
  isValidOSCTrackAddress: vi.fn((addr: string) => addr?.startsWith("/track/")),
  isValidOSCChannelAddress: vi.fn((addr: string) =>
    addr?.startsWith("/ch/") || addr?.startsWith("/channel/")
  ),
}));

vi.mock("../shared/config/defaultConfig", () => ({
  DEFAULT_INPUT_CONFIG: {
    type: "midi",
    deviceName: "IAC Driver Bus 1",
    trackSelectionChannel: 1,
    methodTriggerChannel: 2,
    velocitySensitive: false,
    port: 8000,
  },
}));

// Mock Electron BrowserWindow
class MockWebContents extends EventEmitter {
  isDestroyed = vi.fn(() => false);
  send = vi.fn();
}

class MockBrowserWindow extends EventEmitter {
  webContents = new MockWebContents();
  isDestroyed = vi.fn(() => false);

  constructor() {
    super();
  }
}

// Get the mocked WebMedi instance (already imported above)
const webmidiMock = WebMidi as any;

// Note: InputManager is imported dynamically in beforeEach to ensure mocks are applied

describe("InputManager", () => {
  let InputManager: any;
  let mockDashboard: MockBrowserWindow;
  let mockProjector: MockBrowserWindow;
  let mockMidiInput: any;

  beforeEach(async () => {
    // Don't use resetModules() - it breaks the mock application
    // vi.resetModules();

    // Reset osc tracking variables
    oscCallCount = 0;
    oscLastCreatedPort = null;
    oscShouldThrow = null;

    // Reset webmidi state variables
    webMidiEnabled = false;
    webMidiInputs = [];
    webMidiOutputs = [];
    webMidiSupport = false;

    // Reset all mocks (clears call history but keeps implementations)
    vi.clearAllMocks();

    // Reset webmidi mock implementations after clearAllMocks
    // (vi.clearAllMocks() may break closures in mockImplementation)
    (webmidiMock.enable as any).mockImplementation((options?: any, callback?: any) => {
      webMidiEnabled = true;
      webMidiSupport = true;
      if (callback) {
        setTimeout(() => callback(null), 0);
        return webmidiMock as any;
      }
      return new Promise((resolve) => {
        process.nextTick(() => resolve(webmidiMock));
      });
    });

    (webmidiMock.getInputByName as any).mockImplementation((name: string) => {
      return webMidiInputs.find((input: any) => input.name === name) || null;
    });

    (webmidiMock.getInputById as any).mockImplementation((id: string) => {
      return webMidiInputs.find((input: any) => input.id === id) || null;
    });

    // Reset OSC mock properties after clearAllMocks
    // (vi.clearAllMocks() may remove property getters)
    Object.defineProperty(osc.UDPPort, "callCount", {
      get: () => oscCallCount,
      enumerable: false,
      configurable: true,
    });
    Object.defineProperty(osc.UDPPort, "lastCreatedPort", {
      get: () => oscLastCreatedPort,
      enumerable: false,
      configurable: true,
    });

    // Create mock windows
    mockDashboard = new MockBrowserWindow();
    mockProjector = new MockBrowserWindow();

    // Create mock Input object for webmidi
    // This needs to match the structure of the real webmidi Input class
    mockMidiInput = {
      id: "test-midi-id",
      name: "Test Device",
      manufacturer: "Test Manufacturer",
      connection: "open",
      state: "connected",
      type: "input",
      addListener: vi.fn(),
      removeListener: vi.fn(),
    };

    // Set up webmidi state with the mock input
    webMidiInputs = [mockMidiInput];

    // Dynamically import InputManager after resetting modules
    // This ensures the mocks are applied when InputManager does require()
    const InputManagerModule = await import("../InputManager");
    InputManager = (InputManagerModule as any).default || InputManagerModule;
  });

  afterEach(() => {
    // Don't restore all mocks since we use module-level vi.mock()
    // vi.clearAllMocks() in beforeEach is sufficient
  });

  describe("constructor", () => {
    it("should initialize with provided windows", () => {
      const manager = new InputManager(mockDashboard, mockProjector);

      expect(manager.dashboard).toBe(mockDashboard);
      expect(manager.projector).toBe(mockProjector);
      expect(manager.currentSource).toBeNull();
      expect(manager.config).toBeNull();
      expect(manager.connectionStatus).toBe("disconnected");
    });

    it("should initialize with null windows if not provided", () => {
      const manager = new InputManager(null, null);

      expect(manager.dashboard).toBeNull();
      expect(manager.projector).toBeNull();
    });
  });

  describe("broadcast", () => {
    it("should broadcast events to both dashboard and projector", async () => {
      const manager = new InputManager(mockDashboard, mockProjector);
      const testData = { note: 60, velocity: 127 };

      manager.broadcast("track-selection", testData);

      // Verify both windows received the event
      expect(mockDashboard.webContents.send).toHaveBeenCalledWith(
        "input-event",
        expect.objectContaining({
          type: "track-selection",
          data: expect.objectContaining({
            ...testData,
            timestamp: expect.any(Number),
          }),
        })
      );

      expect(mockProjector.webContents.send).toHaveBeenCalledWith(
        "input-event",
        expect.objectContaining({
          type: "track-selection",
          data: expect.objectContaining({
            ...testData,
            timestamp: expect.any(Number),
          }),
        })
      );
    });

    it("should not send to destroyed dashboard window", () => {
      mockDashboard.isDestroyed.mockReturnValue(true);
      const manager = new InputManager(mockDashboard, mockProjector);

      manager.broadcast("track-selection", { note: 60 });

      expect(mockDashboard.webContents.send).not.toHaveBeenCalled();
      expect(mockProjector.webContents.send).toHaveBeenCalled();
    });

    it("should not send to destroyed projector window", () => {
      mockProjector.isDestroyed.mockReturnValue(true);
      const manager = new InputManager(mockDashboard, mockProjector);

      manager.broadcast("track-selection", { note: 60 });

      expect(mockDashboard.webContents.send).toHaveBeenCalled();
      expect(mockProjector.webContents.send).not.toHaveBeenCalled();
    });

    it("should not send to windows with destroyed webContents", () => {
      mockDashboard.webContents.isDestroyed.mockReturnValue(true);
      const manager = new InputManager(mockDashboard, mockProjector);

      manager.broadcast("track-selection", { note: 60 });

      expect(mockDashboard.webContents.send).not.toHaveBeenCalled();
      expect(mockProjector.webContents.send).toHaveBeenCalled();
    });

    it("should handle null windows gracefully", () => {
      const manager = new InputManager(null, null);

      // Should not throw
      expect(() => {
        manager.broadcast("track-selection", { note: 60 });
      }).not.toThrow();
    });
  });

  describe("broadcastStatus", () => {
    it("should broadcast status to dashboard window", () => {
      const manager = new InputManager(mockDashboard, mockProjector);
      const config = {
        type: "midi" as const,
        trackSelectionChannel: 1,
        methodTriggerChannel: 2,
        velocitySensitive: false,
        port: 8000,
      };
      manager.config = config;

      manager.broadcastStatus("connected", "MIDI connected");

      expect(manager.connectionStatus).toBe("connected");
      expect(mockDashboard.webContents.send).toHaveBeenCalledWith(
        "input-status",
        expect.objectContaining({
          type: "input-status",
          data: expect.objectContaining({
            status: "connected",
            message: "MIDI connected",
            config: config,
          }),
        })
      );
    });

    it("should not send to destroyed dashboard window", () => {
      mockDashboard.isDestroyed.mockReturnValue(true);
      const manager = new InputManager(mockDashboard, mockProjector);

      manager.broadcastStatus("connected", "Connected");

      expect(mockDashboard.webContents.send).not.toHaveBeenCalled();
    });

    it("should update connection status", () => {
      const manager = new InputManager(mockDashboard, mockProjector);

      manager.broadcastStatus("connecting", "Connecting...");
      expect(manager.connectionStatus).toBe("connecting");

      manager.broadcastStatus("connected", "Connected");
      expect(manager.connectionStatus).toBe("connected");
    });
  });

  describe("initialize", () => {
    it("should disconnect existing source before initializing new one", async () => {
      const manager = new InputManager(mockDashboard, mockProjector);
      const disconnectSpy = vi.spyOn(manager, "disconnect").mockResolvedValue(undefined);

      manager.currentSource = { type: "midi", instance: mockMidiInput };

      const midiConfig = {
        type: "midi" as const,
        deviceName: "Test Device",
        trackSelectionChannel: 1,
        methodTriggerChannel: 2,
        velocitySensitive: false,
        port: 8000,
      };

      await manager.initialize(midiConfig);

      expect(disconnectSpy).toHaveBeenCalled();
    });

    it("should use default config if none provided", async () => {
      const manager = new InputManager(mockDashboard, mockProjector);
      const initMidiSpy = vi.spyOn(manager, "initMIDI").mockResolvedValue(undefined);

      await manager.initialize(null as any);

      expect(initMidiSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "midi",
          deviceName: "IAC Driver Bus 1",
        })
      );
    });

    it("should initialize MIDI connection", async () => {
      const manager = new InputManager(mockDashboard, mockProjector);
      const initMidiSpy = vi.spyOn(manager, "initMIDI").mockResolvedValue(undefined);

      const midiConfig = {
        type: "midi" as const,
        deviceName: "Test Device",
        trackSelectionChannel: 1,
        methodTriggerChannel: 2,
        velocitySensitive: false,
        port: 8000,
      };

      await manager.initialize(midiConfig);

      expect(initMidiSpy).toHaveBeenCalledWith(midiConfig);
    });

    it("should initialize OSC connection", async () => {
      const manager = new InputManager(mockDashboard, mockProjector);
      const initOscSpy = vi.spyOn(manager, "initOSC").mockResolvedValue(undefined);

      const oscConfig = {
        type: "osc" as const,
        trackSelectionChannel: 1,
        methodTriggerChannel: 2,
        velocitySensitive: false,
        port: 8000,
      };

      await manager.initialize(oscConfig);

      expect(initOscSpy).toHaveBeenCalledWith(oscConfig);
    });

    it("should handle unknown input type", async () => {
      const manager = new InputManager(mockDashboard, mockProjector);

      const invalidConfig = {
        type: "invalid" as any,
        trackSelectionChannel: 1,
        methodTriggerChannel: 2,
        velocitySensitive: false,
        port: 8000,
      };

      await manager.initialize(invalidConfig);

      expect(mockDashboard.webContents.send).toHaveBeenCalledWith(
        "input-status",
        expect.objectContaining({
          data: expect.objectContaining({
            status: "error",
            message: 'Unknown input type: invalid',
          }),
        })
      );
    });

    it("should handle initialization errors", async () => {
      const manager = new InputManager(mockDashboard, mockProjector);
      const error = new Error("Init failed");
      vi.spyOn(manager, "initMIDI").mockRejectedValue(error);

      const midiConfig = {
        type: "midi" as const,
        deviceName: "Test Device",
        trackSelectionChannel: 1,
        methodTriggerChannel: 2,
        velocitySensitive: false,
        port: 8000,
      };

      await expect(manager.initialize(midiConfig)).rejects.toThrow("Init failed");

      expect(mockDashboard.webContents.send).toHaveBeenCalledWith(
        "input-status",
        expect.objectContaining({
          data: expect.objectContaining({
            status: "error",
            message: "Init failed",
          }),
        })
      );
    });
  });

  describe("initMIDI", () => {
    it("should enable WebMidi if not already enabled", async () => {
      const manager = new InputManager(mockDashboard, mockProjector);
      webMidiEnabled = false;

      const midiConfig = {
        type: "midi" as const,
        deviceName: "Test Device",
        deviceId: "",
        trackSelectionChannel: 1,
        methodTriggerChannel: 2,
        velocitySensitive: false,
        port: 8000,
      };

      await manager.initMIDI(midiConfig);

      expect(webmidiMock.enable).toHaveBeenCalled();
    });

    it("should not enable WebMidi if already enabled", async () => {
      const manager = new InputManager(mockDashboard, mockProjector);
      webMidiEnabled = true;

      const midiConfig = {
        type: "midi" as const,
        deviceName: "Test Device",
        deviceId: "",
        trackSelectionChannel: 1,
        methodTriggerChannel: 2,
        velocitySensitive: false,
        port: 8000,
      };

      await manager.initMIDI(midiConfig);

      expect(webmidiMock.enable).not.toHaveBeenCalled();
    });

    it("should set up MIDI input device by name", async () => {
      const manager = new InputManager(mockDashboard, mockProjector);
      webMidiEnabled = true;

      const midiConfig = {
        type: "midi" as const,
        deviceName: "Test Device",
        deviceId: "",
        trackSelectionChannel: 1,
        methodTriggerChannel: 2,
        velocitySensitive: false,
        port: 8000,
      };

      await manager.initMIDI(midiConfig);

      expect(webmidiMock.getInputByName).toHaveBeenCalledWith("Test Device");
      expect(mockMidiInput.addListener).toHaveBeenCalledWith(
        "noteon",
        expect.any(Function)
      );
      expect(manager.currentSource).toEqual({
        type: "midi",
        instance: mockMidiInput,
      });
    });

    it("should set up MIDI input device by ID", async () => {
      const manager = new InputManager(mockDashboard, mockProjector);
      webMidiEnabled = true;

      const midiConfig = {
        type: "midi" as const,
        deviceName: "",
        deviceId: "test-midi-id",
        trackSelectionChannel: 1,
        methodTriggerChannel: 2,
        velocitySensitive: false,
        port: 8000,
      };

      await manager.initMIDI(midiConfig);

      expect(webmidiMock.getInputById).toHaveBeenCalledWith("test-midi-id");
    });

    it("should reject when MIDI device not found", async () => {
      const manager = new InputManager(mockDashboard, mockProjector);
      webMidiEnabled = true;
      // Set mock to return null (device not found)
      webmidiMock.getInputByName.mockReturnValue(null);

      const midiConfig = {
        type: "midi" as const,
        deviceName: "Nonexistent Device",
        deviceId: "",
        trackSelectionChannel: 1,
        methodTriggerChannel: 2,
        velocitySensitive: false,
        port: 8000,
      };

      await expect(manager.initMIDI(midiConfig)).rejects.toThrow(
        'MIDI device "Nonexistent Device" not found'
      );

      expect(manager.currentSource).toBeNull();
    });

    it("should handle track selection MIDI events", async () => {
      const manager = new InputManager(mockDashboard, mockProjector);
      webMidiEnabled = true;

      const midiConfig = {
        type: "midi" as const,
        deviceName: "Test Device",
        deviceId: "",
        trackSelectionChannel: 1,
        methodTriggerChannel: 2,
        velocitySensitive: false,
        port: 8000,
      };

      await manager.initMIDI(midiConfig);

      // Get the noteon listener callback
      const addListenerCalls = mockMidiInput.addListener.mock.calls;
      const noteOnCallback = addListenerCalls.find(
        (call: any[]) => call[0] === "noteon"
      )[1];

      // Simulate MIDI note on event for track selection
      noteOnCallback({
        note: { number: 60 },
        message: { channel: 1 },
        velocity: 100,
      });

      expect(mockDashboard.webContents.send).toHaveBeenCalledWith(
        "input-event",
        expect.objectContaining({
          type: "track-selection",
          data: expect.objectContaining({
            note: 60,
            velocity: 127, // Should be 127 when not velocity sensitive
            source: "midi",
          }),
        })
      );
    });

    it("should use actual velocity when velocitySensitive is true", async () => {
      const manager = new InputManager(mockDashboard, mockProjector);
      webMidiEnabled = true;

      const midiConfig = {
        type: "midi" as const,
        deviceName: "Test Device",
        deviceId: "",
        trackSelectionChannel: 1,
        methodTriggerChannel: 2,
        velocitySensitive: true,
        port: 8000,
      };

      await manager.initMIDI(midiConfig);

      // Get the noteon listener callback
      const addListenerCalls = mockMidiInput.addListener.mock.calls;
      const noteOnCallback = addListenerCalls.find(
        (call: any[]) => call[0] === "noteon"
      )[1];

      // Simulate MIDI note on event
      noteOnCallback({
        note: { number: 60 },
        message: { channel: 1 },
        velocity: 80,
      });

      expect(mockDashboard.webContents.send).toHaveBeenCalledWith(
        "input-event",
        expect.objectContaining({
          data: expect.objectContaining({
            velocity: 80, // Should use actual velocity
          }),
        })
      );
    });

    it("should handle method trigger MIDI events", async () => {
      const manager = new InputManager(mockDashboard, mockProjector);
      webMidiEnabled = true;

      const midiConfig = {
        type: "midi" as const,
        deviceName: "Test Device",
        deviceId: "",
        trackSelectionChannel: 1,
        methodTriggerChannel: 2,
        velocitySensitive: false,
        port: 8000,
      };

      await manager.initMIDI(midiConfig);

      // Get the noteon listener callback
      const addListenerCalls = mockMidiInput.addListener.mock.calls;
      const noteOnCallback = addListenerCalls.find(
        (call: any[]) => call[0] === "noteon"
      )[1];

      // Simulate MIDI note on event for method trigger
      noteOnCallback({
        note: { number: 64 },
        message: { channel: 2 },
        velocity: 100,
      });

      expect(mockDashboard.webContents.send).toHaveBeenCalledWith(
        "input-event",
        expect.objectContaining({
          type: "method-trigger",
          data: expect.objectContaining({
            note: 64,
            channel: 2,
            velocity: 127,
            source: "midi",
          }),
        })
      );
    });

    it("should handle WebMidi enable failure", async () => {
      const manager = new InputManager(mockDashboard, mockProjector);
      webMidiEnabled = false;
      const enableError = new Error("MIDI enable failed");
      (webmidiMock.enable as any).mockImplementation(() => Promise.reject(enableError));

      const midiConfig = {
        type: "midi" as const,
        deviceName: "Test Device",
        deviceId: "",
        trackSelectionChannel: 1,
        methodTriggerChannel: 2,
        velocitySensitive: false,
        port: 8000,
      };

      await expect(manager.initMIDI(midiConfig)).rejects.toThrow(
        "MIDI enable failed"
      );

      expect(manager.currentSource).toBeNull();
      expect(mockDashboard.webContents.send).toHaveBeenCalledWith(
        "input-status",
        expect.objectContaining({
          data: expect.objectContaining({
            status: "error",
            message: "Failed to enable MIDI: MIDI enable failed",
          }),
        })
      );
    });
  });

  describe("initOSC", () => {
    it("should create OSC UDP port", async () => {
      const manager = new InputManager(mockDashboard, mockProjector);

      const oscConfig = {
        type: "osc" as const,
        trackSelectionChannel: 1,
        methodTriggerChannel: 2,
        velocitySensitive: false,
        port: 8000,
      };

      await manager.initOSC(oscConfig);

      // Check that the manual mock was called
      expect((osc.UDPPort as any).callCount).toBeGreaterThan(0);
      expect((osc.UDPPort as any).lastCreatedPort).not.toBeNull();
    });

    it("should open UDP port", async () => {
      const manager = new InputManager(mockDashboard, mockProjector);

      const oscConfig = {
        type: "osc" as const,
        trackSelectionChannel: 1,
        methodTriggerChannel: 2,
        velocitySensitive: false,
        port: 8000,
      };

      await manager.initOSC(oscConfig);

      const udpPort = oscLastCreatedPort;
      expect(udpPort.open).toHaveBeenCalled();
      expect(manager.currentSource).toEqual({
        type: "osc",
        instance: udpPort,
      });
    });

    it("should handle OSC track selection messages", async () => {
      const manager = new InputManager(mockDashboard, mockProjector);

      const oscConfig = {
        type: "osc" as const,
        trackSelectionChannel: 1,
        methodTriggerChannel: 2,
        velocitySensitive: false,
        port: 8000,
      };

      await manager.initOSC(oscConfig);

      const udpPort = oscLastCreatedPort;

      // Emit track selection message
      udpPort.emit("message", {
        address: "/track/intro",
        args: [{ value: 1 }],
      });

      expect(mockDashboard.webContents.send).toHaveBeenCalledWith(
        "input-event",
        expect.objectContaining({
          type: "track-selection",
          data: expect.objectContaining({
            identifier: "/track/intro",
            source: "osc",
            address: "/track/intro",
          }),
        })
      );
    });

    it("should handle OSC channel trigger messages", async () => {
      const manager = new InputManager(mockDashboard, mockProjector);

      const oscConfig = {
        type: "osc" as const,
        trackSelectionChannel: 1,
        methodTriggerChannel: 2,
        velocitySensitive: false,
        port: 8000,
      };

      await manager.initOSC(oscConfig);

      const udpPort = oscLastCreatedPort;

      // Emit channel trigger message
      udpPort.emit("message", {
        address: "/ch/bass",
        args: [{ value: 100 }],
      });

      expect(mockDashboard.webContents.send).toHaveBeenCalledWith(
        "input-event",
        expect.objectContaining({
          type: "method-trigger",
          data: expect.objectContaining({
            channelName: "/ch/bass",
            velocity: 100,
            source: "osc",
            address: "/ch/bass",
          }),
        })
      );
    });

    it("should filter out note-off messages (value = 0)", async () => {
      const manager = new InputManager(mockDashboard, mockProjector);

      const oscConfig = {
        type: "osc" as const,
        trackSelectionChannel: 1,
        methodTriggerChannel: 2,
        velocitySensitive: false,
        port: 8000,
      };

      await manager.initOSC(oscConfig);

      const udpPort = oscLastCreatedPort;

      // Emit note-off message (value = 0)
      udpPort.emit("message", {
        address: "/track/intro",
        args: [{ value: 0 }],
      });

      expect(mockDashboard.webContents.send).not.toHaveBeenCalled();
    });

    it("should handle OSC ready event", async () => {
      const manager = new InputManager(mockDashboard, mockProjector);

      const oscConfig = {
        type: "osc" as const,
        trackSelectionChannel: 1,
        methodTriggerChannel: 2,
        velocitySensitive: false,
        port: 9000,
      };

      await manager.initOSC(oscConfig);

      const udpPort = oscLastCreatedPort;

      // Emit ready event
      udpPort.emit("ready");

      expect(mockDashboard.webContents.send).toHaveBeenCalledWith(
        "input-status",
        expect.objectContaining({
          data: expect.objectContaining({
            status: "connected",
            message: "OSC: Port 9000",
          }),
        })
      );
    });

    it("should handle OSC error events", async () => {
      const manager = new InputManager(mockDashboard, mockProjector);

      const oscConfig = {
        type: "osc" as const,
        trackSelectionChannel: 1,
        methodTriggerChannel: 2,
        velocitySensitive: false,
        port: 8000,
      };

      await manager.initOSC(oscConfig);

      const udpPort = oscLastCreatedPort;

      // Emit error event
      const oscError = new Error("OSC port in use");
      (oscError as any).code = "EADDRINUSE";
      udpPort.emit("error", oscError);

      expect(mockDashboard.webContents.send).toHaveBeenCalledWith(
        "input-status",
        expect.objectContaining({
          data: expect.objectContaining({
            status: "error",
            message: "OSC error: OSC port in use",
          }),
        })
      );
    });

    it("should use default velocity when value is not a number", async () => {
      const manager = new InputManager(mockDashboard, mockProjector);

      const oscConfig = {
        type: "osc" as const,
        trackSelectionChannel: 1,
        methodTriggerChannel: 2,
        velocitySensitive: false,
        port: 8000,
      };

      await manager.initOSC(oscConfig);

      const udpPort = oscLastCreatedPort;

      // Emit message with non-numeric value
      udpPort.emit("message", {
        address: "/ch/bass",
        args: [{ value: "string value" }],
      });

      expect(mockDashboard.webContents.send).toHaveBeenCalledWith(
        "input-event",
        expect.objectContaining({
          data: expect.objectContaining({
            velocity: 127, // Default velocity
          }),
        })
      );
    });

    it("should handle OSC initialization errors", async () => {
      // Set up error-throwing flag
      const oscError = new Error("OSC init failed");
      oscShouldThrow = oscError;

      const manager = new InputManager(mockDashboard, mockProjector);

      const oscConfig = {
        type: "osc" as const,
        trackSelectionChannel: 1,
        methodTriggerChannel: 2,
        velocitySensitive: false,
        port: 8000,
      };

      try {
        await manager.initOSC(oscConfig);
      } catch (e) {
        // Expected error
      }

      expect(manager.currentSource).toBeNull();
      expect(mockDashboard.webContents.send).toHaveBeenCalledWith(
        "input-status",
        expect.objectContaining({
          data: expect.objectContaining({
            status: "error",
            message: "Failed to start OSC: OSC init failed",
          }),
        })
      );

      // Reset the error flag for other tests
      oscShouldThrow = null;
    });
  });

  describe("disconnect", () => {
    it("should do nothing if no current source", async () => {
      const manager = new InputManager(mockDashboard, mockProjector);
      manager.currentSource = null;

      await manager.disconnect();

      expect(mockDashboard.webContents.send).not.toHaveBeenCalled();
    });

    it("should remove MIDI event listener", async () => {
      const manager = new InputManager(mockDashboard, mockProjector);
      manager.currentSource = { type: "midi", instance: mockMidiInput };

      await manager.disconnect();

      expect(mockMidiInput.removeListener).toHaveBeenCalledWith("noteon");
    });

    it("should close OSC port", async () => {
      const manager = new InputManager(mockDashboard, mockProjector);
      const mockUdpPort = new EventEmitter() as any;
      mockUdpPort.close = vi.fn();
      manager.currentSource = { type: "osc", instance: mockUdpPort };

      await manager.disconnect();

      expect(mockUdpPort.close).toHaveBeenCalled();
    });

    it("should broadcast disconnected status", async () => {
      const manager = new InputManager(mockDashboard, mockProjector);
      manager.currentSource = { type: "midi", instance: mockMidiInput };

      await manager.disconnect();

      expect(mockDashboard.webContents.send).toHaveBeenCalledWith(
        "input-status",
        expect.objectContaining({
          data: expect.objectContaining({
            status: "disconnected",
            message: "",
          }),
        })
      );
    });

    it("should clear current source", async () => {
      const manager = new InputManager(mockDashboard, mockProjector);
      manager.currentSource = { type: "midi", instance: mockMidiInput };

      await manager.disconnect();

      expect(manager.currentSource).toBeNull();
    });

    it("should handle disconnect errors gracefully", async () => {
      const manager = new InputManager(mockDashboard, mockProjector);
      const mockUdpPort = new EventEmitter() as any;
      mockUdpPort.close = vi.fn(() => {
        throw new Error("Close failed");
      });
      manager.currentSource = { type: "osc", instance: mockUdpPort };

      // Should not throw
      await expect(manager.disconnect()).resolves.not.toThrow();
    });
  });

  describe("getAvailableMIDIDevices", () => {
    it("should return list of MIDI devices", async () => {
      console.log("[TEST] webMidiInputs before getAvailable:", webMidiInputs);
      console.log("[TEST] WebMidi.inputs:", (WebMidi as any).inputs);
      const devices = await InputManager.getAvailableMIDIDevices();
      console.log("[TEST] devices returned:", devices);

      expect(devices).toEqual([
        {
          id: "test-midi-id",
          name: "Test Device",
          manufacturer: "Test Manufacturer",
        },
      ]);
    });

    it("should return empty array on WebMidi enable failure", async () => {
      const enableError = new Error("Failed to enable");
      // Set up mock to reject promise
      (webmidiMock.enable as any).mockImplementation(() => Promise.reject(enableError));

      const devices = await InputManager.getAvailableMIDIDevices();

      expect(devices).toEqual([]);
    });

    it("should enable WebMidi if not enabled", async () => {
      webMidiEnabled = false;

      await InputManager.getAvailableMIDIDevices();

      expect(webmidiMock.enable).toHaveBeenCalled();
    });
  });
});
