import { find, forEach, isEqual, isFunction } from "lodash";
import logger from "../../helpers/logger";
import { TrackSandboxHost } from "../sandbox/TrackSandboxHost";
import { getMessaging } from "../bridge";

export function deactivateActiveTrack() {
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

  forEach(this.activeModules, (instances, instanceId) => {
    forEach(instances, (instance) => {
      if (isFunction(instance.destroy)) {
        try {
          instance.destroy();
        } catch (error) {
          console.error(`Error during destroy of instance "${instanceId}":`, error);
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
}

export async function handleTrackSelection(trackName) {
  const debugEnabled = logger.debugEnabled;
  if (debugEnabled) {
    logger.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    logger.log("📦 [TRACK] handleTrackSelection called with:", trackName);
    logger.log("📦 [TRACK] Current userData:", this.userData);
    logger.log("📦 [TRACK] Looking for track with name:", trackName);
  }

  if (this.isLoadingTrack) {
    if (this.activeTrack?.name === trackName) {
      if (debugEnabled) {
        logger.log("⚠️ [TRACK] Already loading this track, ignoring duplicate request");
      }
      return;
    }
    if (debugEnabled) {
      logger.log(`⚠️ [TRACK] Track load in progress, queueing "${trackName}" as pending`);
    }
    this.pendingTrackName = trackName;
    return;
  }

  this.isLoadingTrack = true;

  const track = find(this.userData, { name: trackName });
  if (debugEnabled) logger.log("📦 [TRACK] Track found:", track);

  if (!track) {
    logger.error(`❌ [TRACK] Track "${trackName}" not found in userData`);
    if (debugEnabled) {
      logger.log(
        "📦 [TRACK] Available tracks:",
        this.userData.map((t) => t.name)
      );
    }
    this.deactivateActiveTrack();
    this.isLoadingTrack = false;
    return;
  }

  if (debugEnabled) logger.log("📦 [TRACK] Current activeTrack:", this.activeTrack);

  if (this.activeTrack && this.activeTrack.name !== trackName) {
    if (debugEnabled) {
      logger.log("📦 [TRACK] Deactivating previous track:", this.activeTrack.name);
    }
    this.deactivateActiveTrack();
  }

  if (this.activeTrack?.name === trackName) {
    if (debugEnabled) logger.log("⚠️ [TRACK] Track already active, skipping");
    this.isLoadingTrack = false;
    return;
  }

  const modulesContainer = document.querySelector(".modules");
  if (debugEnabled) logger.log("📦 [TRACK] Modules container:", modulesContainer);

  if (!modulesContainer) {
    logger.error("❌ [TRACK] No .modules container found in DOM!");
    this.isLoadingTrack = false;
    return;
  }

  if (debugEnabled) logger.log("📦 [TRACK] Track modules to load:", track.modules);

  if (!Array.isArray(track.modules)) {
    logger.error(`❌ [TRACK] Track "${trackName}" has invalid modules array:`, track.modules);
    if (debugEnabled) logger.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    this.isLoadingTrack = false;
    return;
  }

  try {
    this.activeTrack = track;
    this.activeChannelHandlers = this.buildChannelHandlerMap(track);

    const moduleSources = {};
    const seenTypes = new Set();
    for (const m of track.modules) {
      const t = String(m?.type || "").trim();
      if (!t || seenTypes.has(t)) continue;
      seenTypes.add(t);
      const src = await this.loadWorkspaceModuleSource(t);
      moduleSources[t] = { text: src?.text || "" };
    }
    this.trackModuleSources = moduleSources;
    const moduleTypeList = Array.from(seenTypes);

    if (!this.trackSandboxHost) {
      this.trackSandboxHost = new TrackSandboxHost(modulesContainer);
    }

    await this.trackSandboxHost.ensureSandbox();
    const assetsBaseUrl = this.getAssetsBaseUrlForSandboxToken(this.trackSandboxHost.token);
    if (!assetsBaseUrl) {
      throw new Error("ASSETS_BASE_URL_UNAVAILABLE");
    }

    if (debugEnabled) logger.log("⏳ [TRACK] Waiting for sandbox track init...");
    const res = await this.trackSandboxHost.initTrack({
      track,
      moduleSources,
      assetsBaseUrl,
    });
    if (!res || res.ok !== true) {
      const resObj = res && typeof res === "object" ? res : {};
      const failedModuleType =
        resObj && typeof resObj.moduleType === "string" ? String(resObj.moduleType) : "";
      if (failedModuleType) {
        try {
          const messaging = getMessaging();
          messaging?.sendToDashboard?.("workspace-modules-failed", {
            moduleIds: [failedModuleType],
            trackName,
            error: String(resObj.error || "SANDBOX_TRACK_INIT_FAILED"),
          });
        } catch {}
      }
      throw new Error(res?.error || "SANDBOX_TRACK_INIT_FAILED");
    }
    try {
      const messaging = getMessaging();
      if (moduleTypeList.length) {
        messaging?.sendToDashboard?.("workspace-modules-loaded", {
          moduleIds: moduleTypeList,
          trackName,
        });
      }
    } catch {}

    this.activeModules = {};
    for (const m of track.modules) {
      const instanceId = String(m?.id || "").trim();
      if (!instanceId) continue;
      this.activeModules[instanceId] = [{}];
    }
    if (debugEnabled) logger.log("✅ [TRACK] Sandbox track initialized");

    if (debugEnabled) {
      logger.log(`✅✅✅ [TRACK] Track activated successfully: "${trackName}"`);
      logger.log("📦 [TRACK] Active modules:", Object.keys(this.activeModules));
      logger.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    }
  } catch (error) {
    logger.error(`❌ [TRACK] Failed to activate track "${trackName}":`, error);
    this.deactivateActiveTrack();
  } finally {
    this.isLoadingTrack = false;
  }

  if (this.pendingTrackName) {
    const nextTrack = this.pendingTrackName;
    this.pendingTrackName = null;
    if (debugEnabled) logger.log(`🔄 [TRACK] Loading pending track: "${nextTrack}"`);
    this.handleTrackSelection(nextTrack);
    return;
  }

  if (this.pendingReloadData) {
    const pending = this.pendingReloadData;
    this.pendingReloadData = null;
    this.loadUserData(pending.setId);
    this.applyConfigSettings();
    if (pending.trackName) {
      const nextTrack = find(this.userData, { name: pending.trackName });
      if (
        this.activeTrack &&
        this.activeTrack.name === pending.trackName &&
        nextTrack &&
        isEqual(
          {
            name: this.activeTrack.name,
            modules: this.activeTrack.modules,
            modulesData: this.activeTrack.modulesData,
            channelMappings: this.activeTrack.channelMappings,
          },
          {
            name: nextTrack.name,
            modules: nextTrack.modules,
            modulesData: nextTrack.modulesData,
            channelMappings: nextTrack.channelMappings,
          }
        )
      ) {
        // No changes needed, track is the same
      } else {
        this.deactivateActiveTrack();
        this.handleTrackSelection(pending.trackName);
        return;
      }
    }
  }

  {
    const messaging = getMessaging();
    messaging?.sendToDashboard?.("projector-ready", {});
  }
  logger.log("✅ [PROJECTOR-IPC] Sent projector-ready signal to dashboard");
}

