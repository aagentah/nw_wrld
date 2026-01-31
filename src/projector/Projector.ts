import { loadJsonFileSync } from "../shared/json/jsonFileBase";
import { loadSettingsSync } from "../shared/json/configUtils";
import { getActiveSetTracks, migrateToSets } from "../shared/utils/setUtils";
import { getProjectDir } from "../shared/utils/projectDir";
import logger from "./helpers/logger";

import { getMessaging } from "./internal/bridge";
import { queueDebugLog } from "./internal/debugLog";
import { initDashboardIpc } from "./internal/ipcFromDashboard";
import { initInputListener } from "./internal/inputListener";
import { introspectModule } from "./internal/introspection";
import {
  applyConfigSettings,
  setBg,
  toggleAspectRatioStyle,
} from "./internal/uiStyle";
import { initWorkspaceModulesChangedListener } from "./internal/workspaceEvents";
import { loadWorkspaceModuleSource } from "./internal/workspaceModules";
import {
  previewModule,
  clearPreview,
  clearPreviewForModule,
  triggerPreviewMethod,
} from "./internal/preview/previewController";
import {
  handleChannelMessage,
  buildChannelHandlerMap,
} from "./internal/track/channelDispatch";
import { executeMethods } from "./internal/track/methodExecutor";
import {
  deactivateActiveTrack,
  handleTrackSelection,
} from "./internal/track/trackLifecycle.js";

const Projector = {
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

  getAssetsBaseUrlForSandboxToken(token: unknown) {
    const safe = String(token || "").trim();
    if (!safe) return null;
    return `nw-assets://app/${encodeURIComponent(safe)}/`;
  },

  async loadWorkspaceModuleSource(moduleType: unknown) {
    return await loadWorkspaceModuleSource.call(this, moduleType);
  },

  async loadModuleClass(moduleType: unknown) {
    return await this.loadWorkspaceModuleSource(moduleType);
  },

  logToMain(message: unknown) {
    const appBridge = (globalThis as typeof globalThis & { nwWrldAppBridge?: unknown })
      .nwWrldAppBridge as { logToMain?: (message: unknown) => unknown } | undefined;
    if (!appBridge || typeof appBridge.logToMain !== "function") return;
    appBridge.logToMain(message);
  },

  queueDebugLog,
  initDashboardIpc,
  initWorkspaceModulesChangedListener,
  initInputListener,
  introspectModule,
  applyConfigSettings,
  toggleAspectRatioStyle,
  setBg,
  deactivateActiveTrack,
  handleTrackSelection,
  handleChannelMessage,
  buildChannelHandlerMap,
  executeMethods,
  previewModule,
  clearPreview,
  clearPreviewForModule,
  triggerPreviewMethod,

  init() {
    this.loadUserData();
    this.settings = loadSettingsSync();
    this.applyConfigSettings();

    {
      const messaging = getMessaging();
      messaging?.sendToDashboard?.("projector-ready", {});
    }

    this.initWorkspaceModulesChangedListener();
    this.initDashboardIpc();
    this.initInputListener();
  },

  loadUserData(activeSetIdOverride: unknown = null) {
    const parsedData = loadJsonFileSync(
      "userData.json",
      { config: {}, sets: [] },
      "Could not load userData.json, initializing with empty data."
    );
    const migratedData = migrateToSets(parsedData);

    let activeSetId: unknown = null;
    if (activeSetIdOverride) {
      activeSetId = activeSetIdOverride;
    } else {
      const appState = loadJsonFileSync(
        "appState.json",
        { activeSetId: null, workspacePath: null },
        "Could not load appState.json, initializing with defaults."
      );
      activeSetId = (appState as { activeSetId?: unknown } | null)?.activeSetId || null;
      const projectDir = getProjectDir();
      this.workspacePath =
        projectDir ||
        (appState as { workspacePath?: unknown } | null)?.workspacePath ||
        null;
    }

    this.userData = getActiveSetTracks(migratedData, activeSetId);
    const config =
      migratedData && typeof migratedData === "object" && "config" in migratedData
        ? (migratedData as { config?: unknown }).config
        : null;
    this.config = config && typeof config === "object" ? config : {};
    this.inputType =
      this.config &&
      typeof this.config === "object" &&
      "input" in this.config &&
      (this.config as { input?: unknown }).input &&
      typeof (this.config as { input?: unknown }).input === "object" &&
      "type" in ((this.config as { input?: unknown }).input as object)
        ? String(
            (
              (this.config as { input?: unknown }).input as { type?: unknown }
            ).type || ""
          ) || "midi"
        : "midi";
    if (logger.debugEnabled) {
      console.log(
        `✅ [Projector] Loaded ${this.userData.length} tracks from set: ${
          activeSetId || "default"
        }`
      );
    }
  },

  refreshPage() {
    window.location.reload();
  },
};

export default Projector;

