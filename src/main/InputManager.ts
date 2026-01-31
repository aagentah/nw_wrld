import { WebMidi, type Input as WebMidiInput } from "webmidi";
import { UDPPort, type OscMessage, type OscError } from "osc";
import { isValidOSCChannelAddress, isValidOSCTrackAddress } from "../shared/validation/oscValidation";
import { normalizeInputEventPayload } from "../shared/validation/inputEventValidation";
import type {
  InputEventPayload,
  InputStatus,
  InputStatusPayload,
  MidiDeviceInfo,
} from "../types/input";
import type { InputConfig } from "../types/userData";

const DEFAULT_INPUT_CONFIG = {
  type: "midi",
  deviceName: "IAC Driver Bus 1",
  trackSelectionChannel: 2,
  methodTriggerChannel: 1,
  velocitySensitive: false,
  noteMatchMode: "pitchClass",
  port: 8000,
};

const INPUT_STATUS: {
  DISCONNECTED: InputStatus;
  CONNECTING: InputStatus;
  CONNECTED: InputStatus;
  ERROR: InputStatus;
} = {
  DISCONNECTED: "disconnected",
  CONNECTING: "connecting",
  CONNECTED: "connected",
  ERROR: "error",
};

type RuntimeMidiConfig = Omit<InputConfig, "type"> & {
  type: "midi";
  deviceId?: string;
  noteMatchMode?: string;
};

type RuntimeOscConfig = Omit<InputConfig, "type"> & {
  type: "osc";
  noteMatchMode?: string;
};

type RuntimeAudioConfig = Omit<InputConfig, "type"> & {
  type: "audio";
  noteMatchMode?: string;
};

type RuntimeFileConfig = Omit<InputConfig, "type"> & {
  type: "file";
  noteMatchMode?: string;
};

type RuntimeInputConfig =
  | RuntimeMidiConfig
  | RuntimeOscConfig
  | RuntimeAudioConfig
  | RuntimeFileConfig;

type WindowWebContents = {
  isDestroyed(): boolean;
  send(channel: "input-event", payload: InputEventPayload): void;
  send(channel: "input-status", payload: InputStatusPayload): void;
  send(channel: string, payload: object): void;
};

type WindowLike = {
  isDestroyed(): boolean;
  webContents?: WindowWebContents | null;
};

type CurrentSource =
  | { type: "midi"; instance: WebMidiInput }
  | { type: "osc"; instance: UDPPort }
  | { type: "audio"; instance: { close?: () => unknown } }
  | { type: "file"; instance: { close?: () => unknown } }
  | null;

type WebMidiProvider = typeof WebMidi;

const getWebMidiProvider = () => {
  const g = globalThis as unknown as { __nwWrldWebMidiOverride?: unknown };
  if (g.__nwWrldWebMidiOverride) return g.__nwWrldWebMidiOverride as WebMidiProvider;
  return WebMidi as unknown as WebMidiProvider;
};

const webMidiEnableInFlightByProvider: WeakMap<object, Promise<void>> = new WeakMap();

const enableWebMidi = (webMidi: WebMidiProvider): Promise<void> => {
  try {
    if (webMidi.enabled) return Promise.resolve();
  } catch {}

  const key = webMidi as unknown as object;
  const inFlight = webMidiEnableInFlightByProvider.get(key);
  if (inFlight) return inFlight;

  const promise = new Promise<void>((resolve, reject) => {
    let settled = false;
    const envTimeoutRaw = process.env.NW_WRLD_WEBMIDI_ENABLE_TIMEOUT_MS;
    const envTimeoutParsed = typeof envTimeoutRaw === "string" ? parseInt(envTimeoutRaw, 10) : NaN;
    const ENABLE_TIMEOUT_MS = Number.isFinite(envTimeoutParsed) && envTimeoutParsed > 0 ? envTimeoutParsed : 8000;

    const t = setTimeout(() => {
      if (settled) return;
      settled = true;
      webMidiEnableInFlightByProvider.delete(key);
      reject(new Error("WebMIDI enable timed out"));
    }, ENABLE_TIMEOUT_MS);

    const callback = (err: Error | null | undefined) => {
      if (settled) return;
      settled = true;
      clearTimeout(t);
      webMidiEnableInFlightByProvider.delete(key);
      if (err) return reject(err);
      resolve();
    };
    try {
      webMidi.enable({ callback });
    } catch (e) {
      if (!settled) {
        settled = true;
        clearTimeout(t);
      }
      webMidiEnableInFlightByProvider.delete(key);
      reject(e);
    }
  });

  webMidiEnableInFlightByProvider.set(key, promise);
  return promise;
};

class InputManager {
  dashboard: WindowLike | null;
  projector: WindowLike | null;
  currentSource: CurrentSource;
  config: RuntimeInputConfig | null;
  connectionStatus: InputStatus;
  private midiWebMidi: WebMidiProvider | null;
  private midiConnectedHandler: ((e: unknown) => void) | null;
  private midiDisconnectedHandler: ((e: unknown) => void) | null;
  private midiTargetDeviceId: string;
  private midiTargetDeviceName: string;

  constructor(dashboardWindow: WindowLike, projectorWindow: WindowLike) {
    this.dashboard = dashboardWindow;
    this.projector = projectorWindow;
    this.currentSource = null;
    this.config = null;
    this.connectionStatus = INPUT_STATUS.DISCONNECTED;
    this.midiWebMidi = null;
    this.midiConnectedHandler = null;
    this.midiDisconnectedHandler = null;
    this.midiTargetDeviceId = "";
    this.midiTargetDeviceName = "";
  }

  private teardownMidiWebMidiListeners() {
    const webMidi = this.midiWebMidi;
    if (!webMidi) return;
    try {
      if (this.midiConnectedHandler && typeof webMidi.removeListener === "function") {
        webMidi.removeListener("connected", this.midiConnectedHandler);
      }
    } catch {}
    try {
      if (this.midiDisconnectedHandler && typeof webMidi.removeListener === "function") {
        webMidi.removeListener("disconnected", this.midiDisconnectedHandler);
      }
    } catch {}
    this.midiWebMidi = null;
    this.midiConnectedHandler = null;
    this.midiDisconnectedHandler = null;
    this.midiTargetDeviceId = "";
    this.midiTargetDeviceName = "";
  }

  private installMidiWebMidiListeners(webMidi: WebMidiProvider, deviceId: string, deviceName: string) {
    this.teardownMidiWebMidiListeners();
    this.midiWebMidi = webMidi;
    this.midiTargetDeviceId = deviceId;
    this.midiTargetDeviceName = deviceName;

    const matchesTarget = (evt: unknown) => {
      const e = evt && typeof evt === "object" ? (evt as Record<string, unknown>) : null;
      const port = e && typeof e.port === "object" && e.port ? (e.port as Record<string, unknown>) : null;
      const id = port && typeof port.id === "string" ? port.id : "";
      const name = port && typeof port.name === "string" ? port.name : "";
      if (deviceId && id && id === deviceId) return true;
      if (deviceName && name && name === deviceName) return true;
      return false;
    };

    this.midiDisconnectedHandler = (evt: unknown) => {
      if (!matchesTarget(evt)) return;
      if (!this.config || (this.config as RuntimeInputConfig).type !== "midi") return;
      if (!this.currentSource || this.currentSource.type !== "midi") return;
      try {
        this.currentSource.instance.removeListener();
      } catch {
        try {
          this.currentSource.instance.removeListener("noteon");
        } catch {}
      }
      this.currentSource = null;
      this.broadcastStatus(INPUT_STATUS.DISCONNECTED, `MIDI device disconnected: ${deviceName}`);
    };

    this.midiConnectedHandler = (evt: unknown) => {
      if (!matchesTarget(evt)) return;
      if (!this.config || (this.config as RuntimeInputConfig).type !== "midi") return;
      if (this.connectionStatus === INPUT_STATUS.CONNECTING) return;
      if (this.currentSource && this.currentSource.type === "midi") return;
      this.initialize(this.config as RuntimeInputConfig).catch(() => {});
    };

    try {
      if (typeof webMidi.addListener === "function") {
        webMidi.addListener("disconnected", this.midiDisconnectedHandler);
        webMidi.addListener("connected", this.midiConnectedHandler);
      }
    } catch {}
  }

  broadcast(eventType: InputEventPayload["type"], data: object) {
    const payload = {
      type: eventType,
      data: {
        ...(data as object),
        timestamp: Date.now() / 1000,
      },
    };

    const normalized = normalizeInputEventPayload(payload);
    if (!normalized) {
      console.warn("[InputManager] Invalid input-event payload:", payload);
      return;
    }

    if (
      this.dashboard &&
      !this.dashboard.isDestroyed() &&
      this.dashboard.webContents &&
      !this.dashboard.webContents.isDestroyed()
    ) {
      this.dashboard.webContents.send("input-event", normalized);
    }
    if (
      this.projector &&
      !this.projector.isDestroyed() &&
      this.projector.webContents &&
      !this.projector.webContents.isDestroyed()
    ) {
      this.projector.webContents.send("input-event", normalized);
    }
  }

  broadcastStatus(status: InputStatus, message = "") {
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

  async initialize(inputConfig?: RuntimeInputConfig | null) {
    if (this.currentSource) {
      await this.disconnect();
    }

    const config = (inputConfig || DEFAULT_INPUT_CONFIG) as RuntimeInputConfig;

    this.config = config;

    try {
      this.broadcastStatus(
        INPUT_STATUS.CONNECTING,
        `Connecting to ${config.type}...`
      );

      const inputType =
        typeof (config as { type?: string }).type === "string"
          ? (config as { type: string }).type
          : "";

      switch (inputType) {
        case "midi":
          await this.initMIDI(config as RuntimeMidiConfig);
          break;
        case "osc":
          await this.initOSC(config as RuntimeOscConfig);
          break;
        case "audio":
          await this.initAudio(config as RuntimeAudioConfig);
          break;
        case "file":
          await this.initFile(config as RuntimeFileConfig);
          break;
        default:
          console.warn("[InputManager] Unknown input type:", inputType);
          this.broadcastStatus(
            INPUT_STATUS.ERROR,
            `Unknown input type: ${inputType}`
          );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[InputManager] Initialization failed:", error);
      this.broadcastStatus(INPUT_STATUS.ERROR, message);
      throw error;
    }
  }

  async initMIDI(midiConfig: RuntimeMidiConfig) {
    return new Promise<void>((resolve, reject) => {
      const setupMIDI = () => {
        try {
          const webMidi = getWebMidiProvider();
          const deviceId = midiConfig?.deviceId?.trim() || "";
          const deviceName = midiConfig?.deviceName?.trim() || "";

          this.installMidiWebMidiListeners(webMidi, deviceId, deviceName);

          let input: WebMidiInput | undefined;
          try {
            if (deviceId) {
              input = webMidi.getInputById(deviceId) as unknown as WebMidiInput | undefined;
            }
          } catch {}
          try {
            if (!input && deviceName) {
              input = webMidi.getInputByName(deviceName) as unknown as WebMidiInput | undefined;
            }
          } catch {}

          if (!input) {
            const error = new Error(
              `MIDI device "${midiConfig.deviceName}" not found`
            );
            console.error("[InputManager]", error.message);
            this.currentSource = null;
            this.broadcastStatus(INPUT_STATUS.DISCONNECTED, "");
            return reject(error);
          }

          const resolvedId = typeof (input as unknown as { id?: unknown }).id === "string"
            ? ((input as unknown as { id: string }).id as string)
            : deviceId;
          const resolvedName = typeof (input as unknown as { name?: unknown }).name === "string"
            ? ((input as unknown as { name: string }).name as string)
            : deviceName;
          this.installMidiWebMidiListeners(webMidi, resolvedId, resolvedName);

          input.addListener("noteon", (e) => {
            const note = e.note.number;
            const channel = e.message.channel;
            const rawAttack =
              typeof e?.note?.rawAttack === "number" && Number.isFinite(e.note.rawAttack)
                ? e.note.rawAttack
                : typeof (e as unknown as { velocity?: unknown })?.velocity === "number" &&
                    Number.isFinite((e as unknown as { velocity: number }).velocity)
                  ? (e as unknown as { velocity: number }).velocity <= 1 &&
                      (e as unknown as { velocity: number }).velocity >= 0
                    ? Math.round((e as unknown as { velocity: number }).velocity * 127)
                    : (e as unknown as { velocity: number }).velocity
                  : 127;
            const velocity = midiConfig.velocitySensitive ? rawAttack : 127;

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

          this.currentSource = { type: "midi", instance: input };
          this.broadcastStatus(
            INPUT_STATUS.CONNECTED,
            `MIDI: ${resolvedName || midiConfig.deviceName}`
          );
          resolve();
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          console.error("[InputManager] Error in MIDI setup:", error);
          this.currentSource = null;
          this.broadcastStatus(INPUT_STATUS.ERROR, `MIDI error: ${message}`);
          reject(error);
        }
      };

      const webMidi = getWebMidiProvider();
      if (webMidi.enabled) {
        setupMIDI();
      } else {
        enableWebMidi(webMidi)
          .then(() => setupMIDI())
          .catch((err) => {
            const e = err instanceof Error ? err : new Error(String(err));
            console.error("[InputManager] MIDI enable failed:", e);
            this.currentSource = null;
            this.broadcastStatus(INPUT_STATUS.ERROR, `Failed to enable MIDI: ${e.message}`);
            return reject(e);
          });
      }
    });
  }

  async initOSC(oscConfig: RuntimeOscConfig) {
    const port = oscConfig.port || 8000;

    try {
      const udpPort = new UDPPort({
        localAddress: "0.0.0.0",
        localPort: port,
        metadata: true,
      });

      udpPort.on("ready", () => {
        this.broadcastStatus(INPUT_STATUS.CONNECTED, `OSC: Port ${port}`);
      });

      udpPort.on("message", (oscMsg: OscMessage) => {
        const rawAddress = oscMsg.address;
        const address = rawAddress.replace(/\s+/g, "");
        const args = oscMsg.args || [];
        const value = args[0] ? args[0].value : undefined;

        if (value !== undefined && typeof value === "number" && value === 0) {
          return;
        }

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

      udpPort.on("error", (err: OscError) => {
        console.error("[InputManager] ❌ OSC error:", err);
        console.error("[InputManager] Error details:", {
          code: err.code,
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
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[InputManager] ❌ Failed to initialize OSC:`, err);
      this.currentSource = null;
      this.broadcastStatus(
        INPUT_STATUS.ERROR,
        `Failed to start OSC: ${message}`
      );
    }
  }

  async initAudio(_audioConfig: RuntimeAudioConfig) {
    this.currentSource = { type: "audio", instance: {} };
    this.broadcastStatus(INPUT_STATUS.CONNECTED, "Audio (listening)");
  }

  async initFile(_fileConfig: RuntimeFileConfig) {
    this.currentSource = { type: "file", instance: {} };
    this.broadcastStatus(INPUT_STATUS.CONNECTED, "File (ready)");
  }

  async disconnect() {
    try {
      if (this.currentSource) {
        switch (this.currentSource.type) {
          case "midi":
            this.teardownMidiWebMidiListeners();
            if (this.currentSource.instance) {
              try {
                this.currentSource.instance.removeListener();
              } catch {
                this.currentSource.instance.removeListener("noteon");
              }
            }
            const webMidi = getWebMidiProvider();
            if (webMidi.enabled && typeof webMidi.disable === "function") {
              try {
                await webMidi.disable();
              } catch {
                try {
                  webMidi.disable();
                } catch {}
              }
            }
            break;
          case "osc":
            if (this.currentSource.instance) {
              this.currentSource.instance.close();
            }
            break;
          case "audio":
            if (this.currentSource.instance && typeof this.currentSource.instance.close === "function") {
              try {
                this.currentSource.instance.close();
              } catch {}
            }
            break;
          case "file":
            if (this.currentSource.instance && typeof this.currentSource.instance.close === "function") {
              try {
                this.currentSource.instance.close();
              } catch {}
            }
            break;
        }
      }

      this.broadcastStatus(INPUT_STATUS.DISCONNECTED, "");
    } catch (error) {
      console.error("[InputManager] Error during disconnect:", error);
    }

    this.currentSource = null;
  }

  static getAvailableMIDIDevices() {
    return new Promise<MidiDeviceInfo[]>((resolve) => {
      const webMidi = getWebMidiProvider();
      const resolveDevices = () => {
        try {
          const devices = webMidi.inputs.map((input) => ({
            id: input.id,
            name: input.name,
            manufacturer: input.manufacturer,
          }));
          resolve(devices);
        } catch (e) {
          console.error("[InputManager] Failed to read WebMIDI inputs:", e);
          resolve([]);
        }
      };

      if (webMidi.enabled) {
        resolveDevices();
        return;
      }

      enableWebMidi(webMidi)
        .then(() => resolveDevices())
        .catch((err) => {
          console.error("[InputManager] Failed to enable WebMIDI:", err);
          resolve([]);
        });
    });
  }
}

export default InputManager;
