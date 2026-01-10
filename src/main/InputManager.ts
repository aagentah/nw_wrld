/**
 * InputManager - Handles MIDI and OSC input in the Electron main process
 *
 * This class manages hardware input devices (MIDI and OSC) and broadcasts
 * events to renderer processes via IPC.
 */

// ES6 imports - no CommonJS require()
import { WebMidi } from "webmidi";
import * as osc from "osc";
import {
  isValidOSCTrackAddress,
  isValidOSCChannelAddress,
} from "../shared/validation/oscValidation";

import { DEFAULT_INPUT_CONFIG } from "../shared/config/defaultConfig";
import { INPUT_STATUS } from "../shared/constants/inputStatus";

// Type imports
import type { InputConfig } from "../types/userData";
import type {
  InputStatus,
  InputEventPayload,
  InputStatusPayload,
  TrackSelectionEventData,
  MethodTriggerEventData,
} from "../types/input";

// Electron BrowserWindow type (simplified for Node.js context)
interface BrowserWindow {
  isDestroyed(): boolean;
  webContents?: WebContents;
}

interface WebContents {
  isDestroyed(): boolean;
  send(channel: string, payload: InputEventPayload | InputStatusPayload): void;
}

// MIDI Input interface
interface MIDIInput {
  id: string;
  name: string;
  manufacturer?: string;
  addListener(event: string, callback: (event: any) => void): void;
  removeListener(event: string): void;
}

// OSC Port interface
interface OSCPort {
  open(): void;
  close(): void;
  on(event: string, callback: (data: any) => void): void;
}

// Input source types
type InputSourceType = "midi" | "osc";

interface InputSource {
  type: InputSourceType;
  instance: MIDIInput | OSCPort;
}

interface MIDIConfig extends InputConfig {
  type: "midi";
  deviceName?: string;
  deviceId?: string;
}

interface OSCConfig extends InputConfig {
  type: "osc";
  port: number;
}

type ExtendedInputConfig = MIDIConfig | OSCConfig;

// MIDI note event structure
interface MIDINoteEvent {
  note: {
    number: number;
  };
  message: {
    channel: number;
  };
  velocity: number;
}

// OSC message structure
interface OSCMessage {
  address: string;
  args?: Array<{ value: unknown }>;
}

class InputManager {
  dashboard: BrowserWindow | null;
  projector: BrowserWindow | null;
  currentSource: InputSource | null;
  config: ExtendedInputConfig | null;
  connectionStatus: InputStatus;

  constructor(dashboardWindow: BrowserWindow | null, projectorWindow: BrowserWindow | null) {
    this.dashboard = dashboardWindow;
    this.projector = projectorWindow;
    this.currentSource = null;
    this.config = null;
    this.connectionStatus = INPUT_STATUS.DISCONNECTED;
  }

  broadcast(eventType: string, data: Partial<TrackSelectionEventData | MethodTriggerEventData>): void {
    const payload: InputEventPayload = {
      type: eventType as any,
      data: {
        ...data,
        timestamp: Date.now() / 1000,
      } as any,
    };

    if (
      this.dashboard &&
      !this.dashboard.isDestroyed() &&
      this.dashboard.webContents &&
      !this.dashboard.webContents.isDestroyed()
    ) {
      this.dashboard.webContents.send("input-event", payload);
    }
    if (
      this.projector &&
      !this.projector.isDestroyed() &&
      this.projector.webContents &&
      !this.projector.webContents.isDestroyed()
    ) {
      this.projector.webContents.send("input-event", payload);
    }
  }

  broadcastStatus(status: InputStatus, message: string = ""): void {
    this.connectionStatus = status;
    const statusPayload: InputStatusPayload = {
      type: "input-status",
      data: {
        status,
        message,
        config: this.config,
      },
    };

    if (
      this.dashboard &&
      !this.dashboard.isDestroyed() &&
      this.dashboard.webContents &&
      !this.dashboard.webContents.isDestroyed()
    ) {
      this.dashboard.webContents.send("input-status", statusPayload);
    }
  }

  async initialize(inputConfig: ExtendedInputConfig | null): Promise<void> {
    if (this.currentSource) {
      await this.disconnect();
    }

    const config = inputConfig || DEFAULT_INPUT_CONFIG;

    this.config = config;

    try {
      this.broadcastStatus(
        INPUT_STATUS.CONNECTING,
        `Connecting to ${config.type}...`
      );

      switch (config.type) {
        case "midi":
          await this.initMIDI(config as MIDIConfig);
          break;
        case "osc":
          await this.initOSC(config as OSCConfig);
          break;
        default:
          console.warn("[InputManager] Unknown input type:", (config as any).type);
          this.broadcastStatus(
            INPUT_STATUS.ERROR,
            `Unknown input type: ${(config as any).type}`
          );
      }
    } catch (error) {
      console.error("[InputManager] Initialization failed:", error);
      this.broadcastStatus(INPUT_STATUS.ERROR, (error as Error).message);
      throw error;
    }
  }

  async initMIDI(midiConfig: MIDIConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      const setupMIDI = () => {
        try {
          const deviceId =
            typeof midiConfig.deviceId === "string" &&
            midiConfig.deviceId.trim()
              ? midiConfig.deviceId.trim()
              : null;
          const deviceName =
            typeof midiConfig.deviceName === "string" &&
            midiConfig.deviceName.trim()
              ? midiConfig.deviceName.trim()
              : "";

          const input =
            (deviceId && typeof (WebMidi as any).getInputById === "function"
              ? (WebMidi as any).getInputById(deviceId)
              : null) || (WebMidi as any).getInputByName(deviceName);
          if (!input) {
            const error = new Error(
              `MIDI device "${midiConfig.deviceName}" not found`
            );
            console.error("[InputManager]", error.message);
            this.currentSource = null;
            this.broadcastStatus(INPUT_STATUS.DISCONNECTED, "");
            return reject(error);
          }

          input.addListener("noteon", (e: MIDINoteEvent) => {
            const note = e.note.number;
            const channel = e.message.channel;
            const velocity = midiConfig.velocitySensitive ? e.velocity : 127;

            if (channel === midiConfig.trackSelectionChannel) {
              this.broadcast("track-selection", {
                note,
                channel,
                velocity,
                source: "midi",
              });
            }
            if (channel === midiConfig.methodTriggerChannel) {
              this.broadcast("method-trigger", {
                note,
                channel,
                velocity,
                source: "midi",
              });
            }
          });

          this.currentSource = { type: "midi", instance: input as MIDIInput };
          this.broadcastStatus(
            INPUT_STATUS.CONNECTED,
            `MIDI: ${midiConfig.deviceName}`
          );
          resolve();
        } catch (error) {
          console.error("[InputManager] Error in MIDI setup:", error);
          this.currentSource = null;
          this.broadcastStatus(
            INPUT_STATUS.ERROR,
            `MIDI error: ${(error as Error).message}`
          );
          reject(error);
        }
      };

      if (WebMidi.enabled) {
        setupMIDI();
      } else {
        WebMidi.enable({}).then(() => {
          setupMIDI();
        }).catch((err: Error | null) => {
          if (err) {
            console.error("[InputManager] MIDI enable failed:", err);
            this.currentSource = null;
            this.broadcastStatus(
              INPUT_STATUS.ERROR,
              `Failed to enable MIDI: ${err.message}`
            );
            return reject(err);
          }
        });
      }
    });
  }

  async initOSC(oscConfig: OSCConfig): Promise<void> {
    const port = oscConfig.port;

    try {
      const udpPort = new osc.UDPPort({
        localAddress: "0.0.0.0",
        localPort: port,
        metadata: true,
      }) as OSCPort;

      udpPort.on("ready", () => {
        this.broadcastStatus(INPUT_STATUS.CONNECTED, `OSC: Port ${port}`);
      });

      udpPort.on("message", (oscMsg: OSCMessage) => {
        const rawAddress = oscMsg.address;
        const address = rawAddress.replace(/\s+/g, "");
        const args = oscMsg.args || [];
        const value = args[0]?.value;

        // Filter out note-off messages (value = 0)
        if (value !== undefined && typeof value === "number" && value === 0) {
          return;
        }

        // OSC Naming Convention (Industry Standard)
        if (isValidOSCTrackAddress(address)) {
          this.broadcast("track-selection", {
            identifier: address,
            source: "osc",
            address,
          });
          return;
        }

        if (isValidOSCChannelAddress(address)) {
          const velocity = typeof value === "number" ? value : 127;
          this.broadcast("method-trigger", {
            channelName: address,
            velocity,
            source: "osc",
            address,
          });
          return;
        }

        console.warn(
          `[InputManager] ⚠️ OSC message ignored (invalid prefix): "${address}"\n` +
            `  Expected format:\n` +
            `    /track/name → Select track\n` +
            `    /ch/name or /channel/name → Trigger channel\n` +
            `  Example: Set GrabberSender name to "track/intro" or "ch/bass"`
        );
      });

      udpPort.on("error", (err: Error) => {
        console.error("[InputManager] ❌ OSC error:", err);
        console.error("[InputManager] Error details:", {
          code: (err as any).code,
          message: err.message,
          port: port,
        });
        this.broadcastStatus(INPUT_STATUS.ERROR, `OSC error: ${err.message}`);
      });

      console.log(`[InputManager] 🔌 Opening UDP port ${port}...`);
      udpPort.open();
      this.currentSource = { type: "osc", instance: udpPort };
      console.log(`[InputManager] ✅ UDP port opened successfully`);
    } catch (err) {
      console.error(`[InputManager] ❌ Failed to initialize OSC:`, err);
      this.currentSource = null;
      this.broadcastStatus(
        INPUT_STATUS.ERROR,
        `Failed to start OSC: ${(err as Error).message}`
      );
    }
  }

<<<<<<< HEAD:src/main/InputManager.ts
  async disconnect(): Promise<void> {
    if (!this.currentSource) return;

    try {
      switch (this.currentSource.type) {
        case "midi":
          if (this.currentSource.instance) {
            try {
              (this.currentSource.instance as MIDIInput).removeListener();
            } catch {
              (this.currentSource.instance as MIDIInput).removeListener("noteon");
            }
          }
          if (WebMidi.enabled && typeof WebMidi.disable === "function") {
            try {
              await WebMidi.disable();
            } catch {
              try {
                WebMidi.disable();
              } catch {}
              }
            }
          }
          break;
        case "osc":
          (this.currentSource.instance as OSCPort).close();
          break;
      }

      this.broadcastStatus(INPUT_STATUS.DISCONNECTED, "");
    } catch (error) {
      console.error("[InputManager] Error during disconnect:", error);
    }

    this.currentSource = null;
  }

  static getAvailableMIDIDevices(): Promise<Array<{ id: string; name: string; manufacturer?: string }>> {
    return new Promise((resolve) => {
      WebMidi.enable({}).then(() => {
        const inputs = (WebMidi as any).inputs;
        console.log("[InputManager] WebMidi.inputs:", inputs);
        console.log("[InputManager] inputs.length:", inputs?.length);
        console.log("[InputManager] inputs[0]:", inputs?.[0]);
        const devices = inputs.map((input: MIDIInput) => ({
          id: input.id,
          name: input.name,
          manufacturer: input.manufacturer,
        }));
        console.log("[InputManager] devices:", devices);
        resolve(devices);
      }).catch((err: Error | null) => {
        console.error("[InputManager] Failed to enable WebMIDI:", err);
        resolve([]);
      });
    });
  }
}

export default InputManager;
