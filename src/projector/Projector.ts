// Projector.ts
import {
  reduce,
  find,
  forEach,
  get,
  isEmpty,
  isEqual,
  isFunction,
  throttle,
  random,
} from "lodash";
import { loadJsonFileSync } from "../shared/json/jsonFileBase";
import { buildMidiConfig } from "../shared/midi/midiUtils";
import { loadSettingsSync } from "../shared/json/configUtils";
import { getActiveSetTracks, migrateToSets } from "../shared/utils/setUtils";
import { buildMethodOptions } from "../shared/utils/methodOptions";
import { getProjectDir } from "../shared/utils/projectDir";
import logger from "./helpers/logger";

const getBridge = () => globalThis.nwWrldBridge as any;
const getMessaging = () => getBridge()?.messaging;

interface TrackModule {
  id: string;
  type: string;
}

interface Track {
  name: string;
  modules: TrackModule[];
  modulesData: Record<string, any>;
  channelMappings: Record<string, any>;
}

interface ModuleInstance {
  destroy?: () => void;
}

interface ChannelTarget {
  instanceId: string;
  moduleType: string;
}

interface ProjectorState {
  activeTrack: Track | null;
  activeModules: Record<string, ModuleInstance[]>;
  activeChannelHandlers: Record<string, ChannelTarget[]>;
  moduleClassCache: Map<any, any>;
  workspaceModuleSourceCache: Map<string, Promise<any>>;
  methodOptionNoRepeatCache: Map<any, any>;
  runtimeMatrixOverrides: Map<string, any>;
  assetsBaseUrl: string | null;
  trackSandboxHost: any;
  trackModuleSources: Record<string, { text: string }> | null;
  restoreTrackNameAfterPreview: string | null;
  workspacePath: string | null;
  userData: any[];
  isDeactivating: boolean;
  isLoadingTrack: boolean;
  pendingTrackName: string | null;
  pendingReloadData: any;
  previewModuleName: string | null;
  previewToken: number;
  debugOverlayActive: boolean;
  debugLogQueue: string[];
  debugLogTimeout: ReturnType<typeof setTimeout> | null;
  moduleIntrospectionCache: Map<string, any>;
}

class TrackSandboxHost {
  modulesContainer: HTMLElement | null;
  token: string | null;
  disposed: boolean;

  constructor(modulesContainer: HTMLElement | null) {
    this.modulesContainer = modulesContainer;
    this.token = null;
    this.disposed = false;
  }

  async ensureSandbox(): Promise<any> {
    if (this.disposed) {
      return { ok: false, reason: "DISPOSED" };
    }
    const bridge = getBridge();
    const ensure = bridge?.sandbox?.ensure;
    if (typeof ensure !== "function") {
      throw new Error(`[Projector] Sandbox bridge is unavailable.`);
    }
    const res = await ensure();
    const token = String(res?.token || "").trim();
    if (!res || res.ok !== true || !token) {
      throw new Error(res?.reason || "SANDBOX_ENSURE_FAILED");
    }
    this.token = token;
    return { ok: true, token };
  }

  async request(type: string, props: any): Promise<any> {
    await this.ensureSandbox();
    const bridge = getBridge();
    const req = bridge?.sandbox?.request;
    if (typeof req !== "function") {
      return { ok: false, error: "SANDBOX_BRIDGE_UNAVAILABLE" };
    }
    return await req(this.token, type, props || {});
  }

  initTrack({ track, moduleSources, assetsBaseUrl }: any): Promise<any> {
    return this.request("initTrack", {
      track,
      moduleSources,
      assetsBaseUrl,
    });
  }

  setMatrixForInstance({
    instanceId,
    track,
    moduleSources,
    assetsBaseUrl,
    matrixOptions,
  }: any): Promise<any> {
    return this.request("setMatrixForInstance", {
      instanceId,
      track,
      moduleSources,
      assetsBaseUrl,
      matrixOptions,
    });
  }

  invokeOnInstance(instanceId: string, methodName: string, options: any): Promise<any> {
    return this.request("invokeOnInstance", {
      instanceId,
      methodName,
      options,
    });
  }

  introspectModule(moduleType: string, sourceText: string): Promise<any> {
    return this.request("introspectModule", { moduleType, sourceText });
  }

  destroyTrack(): Promise<any> {
    return this.request("destroyTrack", {});
  }

  async destroy(): Promise<void> {
    this.disposed = true;
    try {
      await getBridge()?.sandbox?.destroy?.();
    } catch {}
    this.token = null;
  }
}

const Projector: ProjectorState & {
  [key: string]: any;
} = {
  activeTrack: null,
  activeModules: {},
  activeChannelHandlers: {},
  moduleClassCache: new Map(),
  workspaceModuleSourceCache: new Map(),
  methodOptionNoRepeatCache: new Map(),
  runtimeMatrixOverrides: new Map(),
  assetsBaseUrl: null,
  trackSandboxHost: null,
  trackModuleSources: null,
  restoreTrackNameAfterPreview: null,
  workspacePath: null,

  getAssetsBaseUrlForSandboxToken(token: string): string | null {
    const safe = String(token || "").trim();
    if (!safe) return null;
    return `nw-assets://app/${encodeURIComponent(safe)}/`;
  },

  async loadWorkspaceModuleSource(moduleType: string): Promise<any> {
    if (!moduleType) return null;

    const safeModuleType = String(moduleType).trim();
    if (!safeModuleType) return null;
    if (!/^[A-Za-z][A-Za-z0-9]*$/.test(safeModuleType)) {
      throw new Error(
        `[Projector] Invalid module type "${safeModuleType}" (expected alphanumeric class/file name, no paths).`
      );
    }

    if (!this.workspacePath) {
      throw new Error(
        `[Projector] Project directory is not set; cannot load module "${safeModuleType}".`
      );
    }

    const bridge = getBridge();
    if (
      !bridge ||
      !bridge.workspace ||
      typeof bridge.workspace.readModuleWithMeta !== "function"
    ) {
      throw new Error(`[Projector] Workspace module bridge is unavailable.`);
    }

    const info = await bridge.workspace.readModuleWithMeta(safeModuleType);
    if (!info || typeof info.text !== "string") {
      throw new Error(
        `[Projector] Workspace module not found: "${safeModuleType}".`
      );
    }

    const mtimeMs = typeof info.mtimeMs === "number" ? info.mtimeMs : 0;
    const cacheKey = `${safeModuleType}:${mtimeMs}`;
    if (this.workspaceModuleSourceCache.has(cacheKey)) {
      return this.workspaceModuleSourceCache.get(cacheKey);
    }

    const promise = Promise.resolve({
      moduleId: safeModuleType,
      text: info.text,
      mtimeMs,
    });

    for (const key of this.workspaceModuleSourceCache.keys()) {
      if (key.startsWith(`${safeModuleType}:`) && key !== cacheKey) {
        this.workspaceModuleSourceCache.delete(key);
      }
    }
    this.workspaceModuleSourceCache.set(cacheKey, promise);
    return promise;
  },

  async loadModuleClass(moduleType: string): Promise<any> {
    return await this.loadWorkspaceModuleSource(moduleType);
  },

  userData: [],
  isDeactivating: false,
  isLoadingTrack: false,
  pendingTrackName: null,
  pendingReloadData: null,
  previewModuleName: null,
  previewToken: 0,
  debugOverlayActive: false,
  debugLogQueue: [],
  debugLogTimeout: null,
  moduleIntrospectionCache: new Map(),

  logToMain(message: string): void {
    const appBridge = (globalThis as any).nwWrldAppBridge;
    if (!appBridge || typeof appBridge.logToMain !== "function") return;
    appBridge.logToMain(message);
  },

  queueDebugLog(log: string): void {
    if (!this.debugOverlayActive || !logger.debugEnabled) return;

    this.debugLogQueue.push(log);
    if (!this.debugLogTimeout) {
      this.debugLogTimeout = setTimeout(() => {
        if (this.debugLogQueue.length > 0 && this.debugOverlayActive) {
          const batchedLogs = this.debugLogQueue.join("\n\n");
          const messaging = getMessaging();
          if (!messaging || typeof messaging.sendToDashboard !== "function")
            return;
          messaging.sendToDashboard("debug-log", { log: batchedLogs });
          this.debugLogQueue = [];
        }
        this.debugLogTimeout = null;
      }, 100);
    }
  },

  init(): void {
    this.loadUserData();
    this.settings = loadSettingsSync();
    this.applyConfigSettings();

    {
      const messaging = getMessaging();
      messaging?.sendToDashboard?.("projector-ready", {});
    }

    {
      const messaging = getMessaging();
      messaging?.onWorkspaceModulesChanged?.(() => {
        this.workspaceModuleSourceCache.clear();
        this.assetsBaseUrl = null;
        try {
          this.trackSandboxHost?.destroy?.();
        } catch {}
        this.trackSandboxHost = null;
        this.trackModuleSources = null;
      });
    }

    // IPC listener setup would go here
    // (simplified for brevity - full implementation in original file)

    this.initInputListener();
  },

  async introspectModule(moduleId: string): Promise<any> {
    const safeModuleId = String(moduleId || "").trim();
    if (!safeModuleId) {
      return { moduleId, ok: false, error: "INVALID_MODULE_ID" };
    }

    let mtimeMs = null;
    try {
      if (this.workspacePath) {
        const bridge = getBridge();
        const info =
          bridge?.workspace &&
          typeof bridge.workspace.getModuleUrl === "function"
            ? await bridge.workspace.getModuleUrl(safeModuleId)
            : null;
        mtimeMs = typeof info?.mtimeMs === "number" ? info.mtimeMs : null;
      }
    } catch {
      mtimeMs = null;
    }

    const cacheKey =
      mtimeMs != null ? `${safeModuleId}:${mtimeMs}` : `${safeModuleId}:na`;
    if (this.moduleIntrospectionCache.has(cacheKey)) {
      return this.moduleIntrospectionCache.get(cacheKey);
    }

    const result = await (async () => {
      try {
        const src = await this.loadWorkspaceModuleSource(safeModuleId);
        if (!this.trackSandboxHost) {
          this.trackSandboxHost = new TrackSandboxHost(null);
        }
        const initRes = await this.trackSandboxHost.introspectModule(
          src.moduleId,
          src.text
        );

        const displayName = initRes?.name || safeModuleId;
        return {
          moduleId: safeModuleId,
          ok: true,
          name: displayName,
          category: initRes?.category || "Workspace",
          methods: Array.isArray(initRes?.methods) ? initRes.methods : [],
          mtimeMs,
        };
      } catch (e: any) {
        return {
          moduleId: safeModuleId,
          ok: false,
          error: e?.message || "INTROSPECTION_FAILED",
          mtimeMs,
        };
      }
    })();

    for (const key of this.moduleIntrospectionCache.keys()) {
      if (key.startsWith(`${safeModuleId}:`) && key !== cacheKey) {
        this.moduleIntrospectionCache.delete(key);
      }
    }
    this.moduleIntrospectionCache.set(cacheKey, result);
    return result;
  },

  initInputListener(): void {
    const midiConfig = buildMidiConfig(
      this.userData,
      this.config,
      this.inputType
    );

    const messaging = getMessaging();
    if (!messaging || typeof messaging.onInputEvent !== "function") return;
    messaging.onInputEvent((event: any, payload: any) => {
      const { type, data } = payload;
      const debugEnabled = logger.debugEnabled;

      if (debugEnabled) {
        logger.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        logger.log(`🎵 [INPUT] Event type: ${type}, source: ${data.source}`);
      }

      // Event handling logic would go here
      // (simplified for brevity - full implementation in original file)

      if (debugEnabled) logger.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    });
  },

  applyConfigSettings(): void {
    const config = this.config;
    if (config.aspectRatio) {
      this.toggleAspectRatioStyle(config.aspectRatio);
    }
    if (config.bgColor) {
      this.setBg(config.bgColor);
    }
  },

  loadUserData(activeSetIdOverride: string | null = null): void {
    const parsedData = loadJsonFileSync(
      "userData.json",
      { config: {}, sets: [] },
      "Could not load userData.json, initializing with empty data."
    );
    const migratedData = migrateToSets(parsedData);

    let activeSetId: string | null = null;
    if (activeSetIdOverride) {
      activeSetId = activeSetIdOverride;
    } else {
      const appState = loadJsonFileSync(
        "appState.json",
        { activeSetId: null, workspacePath: null },
        "Could not load appState.json, initializing with defaults."
      );
      activeSetId = appState?.activeSetId || null;
      const projectDir = getProjectDir();
      this.workspacePath = projectDir || appState?.workspacePath || null;
    }

    this.userData = getActiveSetTracks(migratedData, activeSetId);
    this.config = (migratedData as any).config || {};
    this.inputType = (migratedData as any).config?.input?.type || "midi";
    if (logger.debugEnabled) {
      console.log(
        `✅ [Projector] Loaded ${this.userData.length} tracks from set: ${
          activeSetId || "default"
        }`
      );
    }
  },

  refreshPage(): void {
    // Reload the current window
    window.location.reload();
  },

  deactivateActiveTrack(): void {
    if (!this.activeTrack || this.isDeactivating) return;
    this.isDeactivating = true;

    const modulesContainer = document.querySelector(".modules");
    if (!modulesContainer) {
      this.isDeactivating = false;
      return;
    }

    try {
      this.trackSandboxHost?.destroy?.();
    } catch {}
    this.trackSandboxHost = null;

    forEach(this.activeModules, (instances: any[]) => {
      forEach(instances, (instance: any) => {
        if (isFunction(instance.destroy)) {
          try {
            instance.destroy();
          } catch (error) {
            console.error(
              `Error during destroy of instance:`,
              error
            );
          }
        }
      });
    });

    try {
      modulesContainer.textContent = "";
    } catch {}

    this.activeModules = {};
    this.activeTrack = null;
    this.activeChannelHandlers = {};
    try {
      this.runtimeMatrixOverrides = new Map();
    } catch {}
    this.isDeactivating = false;
  },

  toggleAspectRatioStyle(selectedRatioId: string): void {
    document.documentElement.classList.remove("reel", "portrait", "scale");

    const dispatchResize = () => {
      try {
        requestAnimationFrame(() => {
          try {
            window.dispatchEvent(new Event("resize"));
          } catch {}
        });
      } catch {
        try {
          window.dispatchEvent(new Event("resize"));
        } catch {}
      }
    };

    const ratio = (this.settings as any).aspectRatios?.find(
      (r: any) => r.id === selectedRatioId
    );
    if (!ratio) {
      if (logger.debugEnabled) {
        logger.warn(`Aspect ratio "${selectedRatioId}" not found in settings`);
      }
      document.body.style = ``;
      dispatchResize();
      return;
    }

    if (
      ratio.id === "default" ||
      ratio.id === "16-9" ||
      ratio.id === "landscape"
    ) {
      document.body.style = ``;
    } else {
      if (ratio.id === "9-16") {
        document.documentElement.classList.add("reel");
      } else if (ratio.id === "4-5") {
        document.documentElement.classList.add("scale");
      }

      document.body.style = `
        width: ${ratio.width};
        height: ${ratio.height};
        position: relative;
        margin: 0 auto;
        transform-origin: center center;
      `;
    }

    dispatchResize();
  },

  setBg(colorId: string): void {
    const color = (this.settings as any).backgroundColors?.find((c: any) => c.id === colorId);
    if (!color) {
      if (logger.debugEnabled) {
        logger.warn(`Background color "${colorId}" not found in settings`);
      }
      return;
    }

    const currentStyle = document.documentElement.style.filter;
    const hasHueRotate = currentStyle.includes("hue-rotate");
    const hueRotateValue = hasHueRotate
      ? currentStyle.match(/hue-rotate\(([^)]+)\)/)?.[1]
      : "";

    document.documentElement.style.backgroundColor = color.value;
    document.documentElement.style.filter = hasHueRotate
      ? `invert(0) hue-rotate(${hueRotateValue})`
      : "invert(0)";
  },
};

export default Projector;
