import { BrowserView, ipcMain } from "electron";
import * as fs from "node:fs";
import * as path from "node:path";
import { srcDir, state } from "./state";
import { isExistingDirectory, resolveWithinDir } from "./pathSafety";
import {
  normalizeSandboxRequestProps,
  normalizeSandboxResult,
} from "../../shared/validation/sandboxValidation";
import { normalizeSandboxPerfStats } from "../../shared/validation/perfValidation";

type WebContentsWithId = { id?: unknown; once?: unknown };
type SenderEvent = { sender?: WebContentsWithId };
type Jsonish = string | number | boolean | null | undefined | Jsonish[] | { [k: string]: Jsonish };

const SANDBOX_ASSET_TEXT_MAX_BYTES = 2 * 1024 * 1024;

const readFileUtf8WithLimit = async (
  filePath: string,
  maxBytes: number
): Promise<string | null> => {
  try {
    const stat = await fs.promises.stat(filePath);
    const limit = Math.max(0, Number(maxBytes) || 0);
    if (limit && stat.size > limit) return null;
    return await fs.promises.readFile(filePath, "utf-8");
  } catch {
    return null;
  }
};

const getProjectDirForEvent = (event: SenderEvent): string | null => {
  try {
    const senderId = event?.sender?.id;
    if (typeof senderId === "number" && state.webContentsToProjectDir.has(senderId)) {
      return state.webContentsToProjectDir.get(senderId) || null;
    }
  } catch {}
  return state.currentProjectDir || null;
};

const registerSandboxToken = (
  event: SenderEvent,
  token: unknown,
  projectDir: string
): { ok: boolean; reason?: string } => {
  const safeToken = String(token || "").trim();
  if (!safeToken) return { ok: false, reason: "INVALID_TOKEN" };
  const ownerWebContentsId =
    typeof event?.sender?.id === "number" ? (event.sender.id as number) : null;
  if (ownerWebContentsId == null) return { ok: false, reason: "INVALID_SENDER" };

  state.sandboxTokenToProjectDir.set(safeToken, {
    projectDir,
    ownerWebContentsId,
    createdAt: Date.now(),
  });

  if (!state.sandboxOwnerWebContentsIdToTokens.has(ownerWebContentsId)) {
    state.sandboxOwnerWebContentsIdToTokens.set(ownerWebContentsId, new Set());
  }
  state.sandboxOwnerWebContentsIdToTokens.get(ownerWebContentsId)?.add(safeToken);

  if (!state.sandboxOwnerCleanupHooked.has(ownerWebContentsId)) {
    state.sandboxOwnerCleanupHooked.add(ownerWebContentsId);
    try {
      const once = event.sender?.once;
      if (typeof once === "function") {
        once.call(event.sender, "destroyed", () => {
          const tokens = state.sandboxOwnerWebContentsIdToTokens.get(ownerWebContentsId);
          if (tokens && tokens.size) {
            for (const t of tokens) {
              try {
                state.sandboxTokenToProjectDir.delete(t);
              } catch {}
            }
          }
          try {
            state.sandboxOwnerWebContentsIdToTokens.delete(ownerWebContentsId);
          } catch {}
          try {
            state.sandboxOwnerCleanupHooked.delete(ownerWebContentsId);
          } catch {}
        });
      }
    } catch {}
  }

  return { ok: true };
};

const unregisterSandboxToken = (token: unknown): boolean => {
  const safeToken = String(token || "").trim();
  if (!safeToken) return false;
  const entry = state.sandboxTokenToProjectDir.get(safeToken) || null;
  const ownerWebContentsId =
    entry && typeof entry.ownerWebContentsId === "number" ? entry.ownerWebContentsId : null;
  try {
    state.sandboxTokenToProjectDir.delete(safeToken);
  } catch {}
  if (typeof ownerWebContentsId === "number") {
    const tokens = state.sandboxOwnerWebContentsIdToTokens.get(ownerWebContentsId);
    if (tokens) {
      try {
        tokens.delete(safeToken);
      } catch {}
      if (tokens.size === 0) {
        try {
          state.sandboxOwnerWebContentsIdToTokens.delete(ownerWebContentsId);
        } catch {}
      }
    }
  }
  return true;
};

const updateSandboxViewBounds = (): void => {
  if (
    !state.sandboxView ||
    !state.projector1Window ||
    typeof (state.projector1Window as { isDestroyed?: unknown }).isDestroyed !== "function" ||
    (state.projector1Window as { isDestroyed: () => boolean }).isDestroyed()
  ) {
    return;
  }
  try {
    const getContentSize = (
      state.projector1Window as {
        getContentSize?: unknown;
      }
    ).getContentSize;
    if (typeof getContentSize !== "function") return;
    const [width, height] = getContentSize.call(state.projector1Window) as [number, number];
    const setBounds = (state.sandboxView as { setBounds?: unknown }).setBounds;
    if (typeof setBounds === "function") {
      setBounds.call(state.sandboxView, { x: 0, y: 0, width, height });
    }
  } catch {}
};

const destroySandboxView = (): void => {
  if (!state.sandboxView) return;
  try {
    const setBrowserView = (
      state.projector1Window as {
        setBrowserView?: unknown;
      }
    )?.setBrowserView;
    if (typeof setBrowserView === "function") {
      setBrowserView.call(state.projector1Window, null);
    }
  } catch {}
  try {
    const webContents = (state.sandboxView as { webContents?: unknown }).webContents;
    const destroy = webContents && (webContents as { destroy?: unknown }).destroy;
    if (typeof destroy === "function") {
      destroy.call(webContents);
    }
  } catch {}
  state.sandboxView = null;
  state.sandboxViewWebContentsId = null;
};

const ensureSandboxView = (projectDir: string | null): unknown | null => {
  if (
    !state.projector1Window ||
    typeof (state.projector1Window as { isDestroyed?: unknown }).isDestroyed !== "function" ||
    (state.projector1Window as { isDestroyed: () => boolean }).isDestroyed()
  )
    return null;
  if (
    state.sandboxView &&
    (state.sandboxView as { webContents?: unknown }).webContents &&
    typeof (state.sandboxView as { webContents: { isDestroyed?: unknown } }).webContents
      .isDestroyed === "function" &&
    !(
      state.sandboxView as { webContents: { isDestroyed: () => boolean } }
    ).webContents.isDestroyed()
  ) {
    try {
      const setBrowserView = (
        state.projector1Window as {
          setBrowserView?: unknown;
        }
      ).setBrowserView;
      if (typeof setBrowserView === "function") {
        setBrowserView.call(state.projector1Window, state.sandboxView);
      }
      updateSandboxViewBounds();
    } catch {}
    return state.sandboxView;
  }

  try {
    destroySandboxView();
  } catch {}

  state.sandboxView = new BrowserView({
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(srcDir, "..", "dist", "runtime", "sandboxPreload.js"),
      enableRemoteModule: false,
      backgroundThrottling: false,
      webgl: true,
      enableHardwareAcceleration: true,
      additionalArguments: [
        "--nwWrldRequireProject=1",
        projectDir && typeof projectDir === "string" ? `--nwWrldProjectDir=${projectDir}` : null,
      ].filter(Boolean),
    } as unknown as Electron.WebPreferences,
  });

  try {
    const wc = (state.sandboxView as { webContents?: unknown }).webContents as
      | { id?: unknown; on?: unknown; isDestroyed?: unknown }
      | undefined;
    state.sandboxViewWebContentsId = typeof wc?.id === "number" ? (wc.id as number) : null;
    if (wc && typeof wc.on === "function") {
      wc.on("render-process-gone", () => {
        try {
          if (state.activeSandboxToken) {
            try {
              unregisterSandboxToken(state.activeSandboxToken);
            } catch {}
          }
          state.sandboxViewWebContentsId = null;
          state.activeSandboxToken = null;
          destroySandboxView();
        } catch {}
      });
      wc.on("unresponsive", () => {
        try {
          if (state.activeSandboxToken) {
            try {
              unregisterSandboxToken(state.activeSandboxToken);
            } catch {}
          }
          state.sandboxViewWebContentsId = null;
          state.activeSandboxToken = null;
          destroySandboxView();
        } catch {}
      });
    }
  } catch {}

  try {
    const setBrowserView = (
      state.projector1Window as {
        setBrowserView?: unknown;
      }
    ).setBrowserView;
    if (typeof setBrowserView === "function") {
      setBrowserView.call(state.projector1Window, state.sandboxView);
    }
    updateSandboxViewBounds();
  } catch {}

  return state.sandboxView;
};

const isProjectorEvent = (event: SenderEvent): boolean => {
  try {
    const senderId = event?.sender?.id;
    const projector = state.projector1Window as {
      isDestroyed?: unknown;
      webContents?: unknown;
    } | null;
    if (!projector || typeof projector.isDestroyed !== "function") return false;
    if ((projector as { isDestroyed: () => boolean }).isDestroyed()) return false;
    const wc = projector.webContents as { isDestroyed?: unknown; id?: unknown } | null;
    if (!wc || typeof wc.isDestroyed !== "function") return false;
    if ((wc as { isDestroyed: () => boolean }).isDestroyed()) return false;
    return typeof senderId === "number" && senderId === wc.id;
  } catch {
    return false;
  }
};

const sandboxRequestAllowedTypes = new Set([
  "initTrack",
  "invokeOnInstance",
  "introspectModule",
  "destroyTrack",
  "setMatrixForInstance",
]);

const sendToSandbox = (payload: unknown): boolean => {
  if (
    !state.sandboxView ||
    !(state.sandboxView as { webContents?: unknown }).webContents ||
    typeof (state.sandboxView as { webContents: { isDestroyed?: unknown } }).webContents
      .isDestroyed !== "function" ||
    (state.sandboxView as { webContents: { isDestroyed: () => boolean } }).webContents.isDestroyed()
  ) {
    return false;
  }
  try {
    const wc = (state.sandboxView as { webContents?: unknown }).webContents as {
      send?: unknown;
    };
    if (typeof wc.send === "function") {
      wc.send("sandbox:fromMain", payload);
      return true;
    }
    return false;
  } catch {
    return false;
  }
};

const destroySandboxForProjector = (ownerWebContentsId: number | null): void => {
  if (state.activeSandboxToken) {
    try {
      unregisterSandboxToken(state.activeSandboxToken);
    } catch {}
    state.activeSandboxToken = null;
  }

  if (typeof ownerWebContentsId === "number") {
    const tokens = state.sandboxOwnerWebContentsIdToTokens.get(ownerWebContentsId);
    if (tokens && tokens.size) {
      for (const t of tokens) {
        try {
          unregisterSandboxToken(t);
        } catch {}
      }
    }
  }

  for (const [requestId, entry] of state.pendingSandboxRequests.entries()) {
    try {
      clearTimeout(entry.timeout);
    } catch {}
    try {
      entry.resolve({ ok: false, error: "SANDBOX_DESTROYED" });
    } catch {}
    state.pendingSandboxRequests.delete(requestId);
  }

  try {
    destroySandboxView();
  } catch {}
};

export function registerSandboxIpc(): void {
  ipcMain.on("bridge:sandbox:registerToken", (event, token) => {
    const projectDir = getProjectDirForEvent(event as unknown as SenderEvent);
    if (!projectDir || !isExistingDirectory(projectDir)) {
      (event as unknown as { returnValue: unknown }).returnValue = {
        ok: false,
        reason: "PROJECT_DIR_MISSING",
      };
      return;
    }
    (event as unknown as { returnValue: unknown }).returnValue = registerSandboxToken(
      event as unknown as SenderEvent,
      token,
      projectDir
    );
  });

  ipcMain.on("bridge:sandbox:unregisterToken", (event, token) => {
    (event as unknown as { returnValue: unknown }).returnValue = unregisterSandboxToken(token);
  });

  ipcMain.handle("sandbox:ensure", async (event) => {
    if (!isProjectorEvent(event as unknown as SenderEvent))
      return { ok: false, reason: "FORBIDDEN" };
    const projectDir = getProjectDirForEvent(event as unknown as SenderEvent);
    if (!projectDir || !isExistingDirectory(projectDir)) {
      return { ok: false, reason: "PROJECT_DIR_MISSING" };
    }

    if (state.sandboxEnsureInFlight) {
      try {
        await state.sandboxEnsureInFlight;
      } catch {}
    }

    const view = ensureSandboxView(projectDir);
    const wc = view && (view as { webContents?: unknown }).webContents;
    if (
      !view ||
      !wc ||
      typeof (wc as { isDestroyed?: unknown }).isDestroyed !== "function" ||
      (wc as { isDestroyed: () => boolean }).isDestroyed()
    ) {
      return { ok: false, reason: "SANDBOX_VIEW_UNAVAILABLE" };
    }

    if (state.activeSandboxToken) {
      const entry = state.sandboxTokenToProjectDir.get(state.activeSandboxToken) || null;
      if (entry?.projectDir === projectDir) {
        return { ok: true, token: state.activeSandboxToken };
      }
      try {
        unregisterSandboxToken(state.activeSandboxToken);
      } catch {}
      state.activeSandboxToken = null;
    }

    const p = (async () => {
      const token = `nw_${Math.random().toString(16).slice(2)}_${Date.now()}`;
      const reg = registerSandboxToken(event as unknown as SenderEvent, token, projectDir);
      if (!reg || reg.ok !== true) {
        return { ok: false, reason: reg?.reason || "TOKEN_REGISTER_FAILED" };
      }

      const url = `nw-sandbox://app/moduleSandbox.html#token=${encodeURIComponent(token)}`;
      try {
        const loadURL = (wc as { loadURL?: unknown }).loadURL;
        if (typeof loadURL !== "function") {
          unregisterSandboxToken(token);
          return { ok: false, reason: "SANDBOX_LOAD_FAILED" };
        }
        await loadURL.call(wc, url);
      } catch {
        unregisterSandboxToken(token);
        return { ok: false, reason: "SANDBOX_LOAD_FAILED" };
      }

      state.activeSandboxToken = token;
      return { ok: true, token };
    })();

    state.sandboxEnsureInFlight = p;
    try {
      return await p;
    } finally {
      if (state.sandboxEnsureInFlight === p) state.sandboxEnsureInFlight = null;
    }
  });

  ipcMain.handle("sandbox:destroy", async (event) => {
    if (!isProjectorEvent(event as unknown as SenderEvent))
      return { ok: false, reason: "FORBIDDEN" };
    const ownerId =
      typeof (event as unknown as SenderEvent)?.sender?.id === "number"
        ? ((event as unknown as SenderEvent).sender?.id as number)
        : null;
    destroySandboxForProjector(ownerId);
    return { ok: true };
  });

  ipcMain.handle("sandbox:request", async (event, payload) => {
    if (!isProjectorEvent(event as unknown as SenderEvent))
      return { ok: false, error: "FORBIDDEN" };
    const ownerId =
      typeof (event as unknown as SenderEvent)?.sender?.id === "number"
        ? ((event as unknown as SenderEvent).sender?.id as number)
        : null;
    const token = String((payload as { token?: unknown })?.token || "").trim();
    const type = String((payload as { type?: unknown })?.type || "").trim();
    const props = ((payload as { props?: unknown })?.props ?? {}) as Jsonish;
    if (!token) return { ok: false, error: "INVALID_TOKEN" };
    if (!type || !sandboxRequestAllowedTypes.has(type)) {
      return { ok: false, error: "INVALID_TYPE" };
    }
    const entry = state.sandboxTokenToProjectDir.get(token) || null;
    if (!entry || entry.ownerWebContentsId !== ownerId) {
      return { ok: false, error: "TOKEN_NOT_OWNED" };
    }

    let safeProps: object = {};
    try {
      const normalized = normalizeSandboxRequestProps(type, props);
      if (normalized.ok !== true) {
        return { ok: false, error: normalized.error || "INVALID_PROPS" };
      }
      safeProps = (normalized.props || {}) as object;
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : "INVALID_PROPS",
      };
    }

    const requestId = `${Date.now()}:${Math.random().toString(16).slice(2)}`;
    const sent = sendToSandbox({
      __nwWrldSandbox: true,
      token,
      type,
      requestId,
      props: safeProps,
    });
    if (!sent) return { ok: false, error: "SANDBOX_UNAVAILABLE" };

    return await new Promise((resolve) => {
      const timeout = setTimeout(() => {
        if (!state.pendingSandboxRequests.has(requestId)) return;
        state.pendingSandboxRequests.delete(requestId);
        resolve({ ok: false, error: "TIMEOUT" });
      }, 8000);
      state.pendingSandboxRequests.set(requestId, { resolve, timeout, token });
    });
  });

  ipcMain.on("sandbox:toMain", async (event, payload) => {
    const senderId =
      typeof (event as unknown as SenderEvent)?.sender?.id === "number"
        ? ((event as unknown as SenderEvent).sender?.id as number)
        : null;
    if (!senderId || senderId !== state.sandboxViewWebContentsId) return;
    const data = payload as unknown;
    if (!data || typeof data !== "object") return;

    const token = String((data as { token?: unknown })?.token || "").trim();

    if ((data as { __nwWrldSandboxPerf?: unknown }).__nwWrldSandboxPerf) {
      if (!token || !state.activeSandboxToken || token !== state.activeSandboxToken) return;
      const stats = normalizeSandboxPerfStats((data as { stats?: unknown })?.stats);
      if (!stats) return;
      const dashboard = state.dashboardWindow as {
        isDestroyed?: unknown;
        webContents?: { isDestroyed?: unknown; send?: unknown };
      } | null;
      if (
        dashboard &&
        typeof dashboard.isDestroyed === "function" &&
        !dashboard.isDestroyed() &&
        dashboard.webContents &&
        typeof dashboard.webContents.isDestroyed === "function" &&
        !dashboard.webContents.isDestroyed() &&
        typeof dashboard.webContents.send === "function"
      ) {
        dashboard.webContents.send("from-projector", {
          type: "perf:stats",
          props: stats,
        });
      }
      return;
    }

    const requestId = String((data as { requestId?: unknown })?.requestId || "").trim();
    if (!token || !requestId) return;

    if ((data as { __nwWrldSandboxResult?: unknown }).__nwWrldSandboxResult) {
      const pending = state.pendingSandboxRequests.get(requestId);
      if (!pending) return;
      if (pending.token !== token) return;
      state.pendingSandboxRequests.delete(requestId);
      try {
        clearTimeout(pending.timeout);
      } catch {}
      try {
        pending.resolve(
          normalizeSandboxResult(
            String((data as { type?: unknown })?.type || ""),
            ((data as { result?: unknown })?.result ?? null) as Jsonish
          )
        );
      } catch {}
      return;
    }

    if (
      (data as { __nwWrldSandbox?: unknown }).__nwWrldSandbox &&
      (data as { type?: unknown }).type === "sdk:readAssetText"
    ) {
      if (!state.activeSandboxToken || token !== state.activeSandboxToken) {
        return;
      }
      const entry = state.sandboxTokenToProjectDir.get(token) || null;
      const projectDir = entry?.projectDir || null;
      const relPath = String((data as { props?: { relPath?: unknown } })?.props?.relPath || "");
      let result: { ok: boolean; text: string | null } = { ok: false, text: null };
      if (projectDir && isExistingDirectory(projectDir)) {
        const assetsDir = path.join(projectDir, "assets");
        const fullPath = resolveWithinDir(assetsDir, relPath);
        if (fullPath) {
          const text = await readFileUtf8WithLimit(fullPath, SANDBOX_ASSET_TEXT_MAX_BYTES);
          if (typeof text === "string") {
            result = { ok: true, text };
          }
        }
      }
      sendToSandbox({
        __nwWrldSandboxResult: true,
        token,
        requestId,
        result,
      });
    }

    if (
      (data as { __nwWrldSandbox?: unknown }).__nwWrldSandbox &&
      (data as { type?: unknown }).type === "sdk:listAssets"
    ) {
      if (!state.activeSandboxToken || token !== state.activeSandboxToken) {
        return;
      }
      const entry = state.sandboxTokenToProjectDir.get(token) || null;
      const projectDir = entry?.projectDir || null;
      const relDir = String((data as { props?: { relDir?: unknown } })?.props?.relDir || "");
      let result: { ok: boolean; entries: string[] } = { ok: false, entries: [] };
      if (projectDir && isExistingDirectory(projectDir)) {
        const assetsDir = path.join(projectDir, "assets");
        const fullPath = resolveWithinDir(assetsDir, relDir);
        if (fullPath) {
          try {
            const stat = await fs.promises.stat(fullPath);
            if (stat && stat.isDirectory()) {
              const dirents = await fs.promises.readdir(fullPath, {
                withFileTypes: true,
              });
              const entries = dirents
                .filter((d) => d && d.isFile && d.isFile())
                .map((d) => String(d.name || ""))
                .filter(Boolean);
              result = { ok: true, entries };
            }
          } catch {}
        }
      }
      sendToSandbox({
        __nwWrldSandboxResult: true,
        token,
        requestId,
        result,
      });
    }
  });
}

export {
  updateSandboxViewBounds,
  destroySandboxView,
  ensureSandboxView,
  unregisterSandboxToken,
  registerSandboxToken,
};
