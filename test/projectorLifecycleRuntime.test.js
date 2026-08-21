const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const babel = require("@babel/core");
const { isDeepStrictEqual } = require("node:util");

const trackLifecyclePath = path.join(
  __dirname,
  "..",
  "src",
  "projector",
  "internal",
  "track",
  "trackLifecycle.js"
);
const previewControllerPath = path.join(
  __dirname,
  "..",
  "src",
  "projector",
  "internal",
  "preview",
  "previewController.ts"
);
const windowsPath = path.join(
  __dirname,
  "..",
  "src",
  "main",
  "mainProcess",
  "windows.ts"
);

const loadModule = (filePath, overrides = {}, extras = {}) => {
  const source = fs.readFileSync(filePath, "utf8");
  const { code } = babel.transformSync(source, {
    filename: filePath,
    babelrc: false,
    configFile: false,
    presets: [
      ["@babel/preset-env", { targets: { node: "current" }, modules: "commonjs" }],
      ["@babel/preset-typescript", { allExtensions: true, isTSX: true }],
    ],
  });

  const module = { exports: {} };
  const sandbox = {
    module,
    exports: module.exports,
    require: (specifier) => {
      if (Object.prototype.hasOwnProperty.call(overrides, specifier)) {
        return overrides[specifier];
      }
      return require(specifier);
    },
    console,
    process,
    Buffer,
    setTimeout,
    clearTimeout,
    ...extras,
  };

  vm.runInNewContext(code, sandbox, { filename: filePath });
  return module.exports;
};

const createTrackLifecycleHarness = () => {
  const projectorMessages = [];
  const documentStub = {
    querySelector(selector) {
      if (selector === ".modules") {
        return { textContent: "" };
      }
      return null;
    },
  };

  const { handleTrackSelection } = loadModule(
    trackLifecyclePath,
    {
      lodash: {
        find: (items, predicate) =>
          Array.isArray(items)
            ? items.find((item) =>
                Object.entries(predicate || {}).every(([key, value]) => item?.[key] === value)
              )
            : undefined,
        forEach: (collection, iteratee) => {
          if (Array.isArray(collection)) {
            collection.forEach((value, index) => iteratee(value, index));
            return;
          }
          if (!collection || typeof collection !== "object") return;
          Object.keys(collection).forEach((key) => iteratee(collection[key], key));
        },
        isEqual: (a, b) => isDeepStrictEqual(a, b),
        isFunction: (value) => typeof value === "function",
      },
      "../../helpers/logger": {
        __esModule: true,
        default: { debugEnabled: false, log: () => {}, error: () => {} },
      },
      "../sandbox/TrackSandboxHost": {
        TrackSandboxHost: class TrackSandboxHost {},
      },
      "../bridge": {
        getMessaging: () => ({
          sendToDashboard: (type, props) => projectorMessages.push({ type, props }),
        }),
      },
    },
    { document: documentStub }
  );

  return { handleTrackSelection, projectorMessages };
};

const createPreviewControllerHarness = () => {
  const dashboardMessages = [];
  const modulesContainer = { textContent: "" };

  class MockTrackSandboxHost {
    constructor(container) {
      this.container = container;
      this.token = "sandbox-token";
      this.destroyCalls = 0;
    }

    async ensureSandbox() {
      return { ok: true, token: this.token };
    }

    async initTrack() {
      return { ok: true };
    }

    async destroy() {
      this.destroyCalls += 1;
    }
  }

  const moduleExports = loadModule(
    previewControllerPath,
    {
      "../../helpers/logger": {
        __esModule: true,
        default: { debugEnabled: false, log: () => {}, error: () => {} },
      },
      "../sandbox/TrackSandboxHost": {
        TrackSandboxHost: MockTrackSandboxHost,
      },
      "../bridge": {
        getMessaging: () => ({
          sendToDashboard: (type, props) => dashboardMessages.push({ type, props }),
        }),
      },
    },
    {
      document: {
        querySelector(selector) {
          if (selector === ".modules") return modulesContainer;
          return null;
        },
      },
    }
  );

  return { ...moduleExports, dashboardMessages };
};

const createWindowsHarness = () => {
  const browserWindows = [];
  const attachCalls = [];
  const shellOpenExternalCalls = [];
  const pendingTimers = [];
  let nextWebContentsId = 1;
  let nextTimerId = 1;

  const fakeSetTimeout = (fn, delay, ...args) => {
    const id = nextTimerId++;
    pendingTimers.push({ id, fn, delay: Number(delay) || 0, args });
    return id;
  };
  const fakeClearTimeout = (id) => {
    const index = pendingTimers.findIndex((timer) => timer.id === id);
    if (index !== -1) pendingTimers.splice(index, 1);
  };
  const advanceTimers = (ms) => {
    for (;;) {
      const dueIndex = pendingTimers.findIndex((timer) => timer.delay <= ms);
      if (dueIndex === -1) return;
      const [due] = pendingTimers.splice(dueIndex, 1);
      due.fn(...due.args);
    }
  };

  class MockBrowserWindow {
    constructor(options) {
      this.options = options;
      this.title = options.title;
      this.destroyed = false;
      this.windowOnceHandlers = new Map();
      this.windowHandlers = new Map();
      this.webContents = {
        id: nextWebContentsId++,
        isDestroyed: () => this.destroyed,
        send: () => {},
        once: () => {},
        handlers: new Map(),
        windowOpenHandler: null,
        on(eventName, handler) {
          const hs = this.handlers.get(eventName) || [];
          hs.push(handler);
          this.handlers.set(eventName, hs);
        },
        setWindowOpenHandler(fn) {
          this.windowOpenHandler = fn;
        },
      };
      browserWindows.push(this);
    }

    once(eventName, handler) {
      this.windowOnceHandlers.set(eventName, handler);
    }

    on(eventName, handler) {
      const handlers = this.windowHandlers.get(eventName) || [];
      handlers.push(handler);
      this.windowHandlers.set(eventName, handlers);
    }

    loadFile(filePath) {
      this.loadedFile = filePath;
    }

    show() {}

    isDestroyed() {
      return this.destroyed;
    }

    getBounds() {
      return { x: 0, y: 0, width: 640, height: 480 };
    }

    setBounds(bounds) {
      this.bounds = bounds;
    }

    close() {
      if (this.destroyed) return;
      this.destroyed = true;
      const onceHandler = this.windowOnceHandlers.get("closed");
      if (onceHandler) {
        this.windowOnceHandlers.delete("closed");
        onceHandler();
      }
      const handlers = this.windowHandlers.get("closed") || [];
      handlers.forEach((handler) => handler());
    }
  }

  const state = {
    projector1Window: null,
    dashboardWindow: null,
    inputManager: {
      attachProjectorWindow: (win) => attachCalls.push(win),
    },
    isWorkspaceSwitchInProgress: false,
    workspaceWatcher: null,
    workspaceWatcherDebounce: null,
    currentWorkspacePath: null,
    currentProjectDir: "/tmp/workspace",
    didRegisterAppLifecycleHandlers: false,
    webContentsToProjectDir: new Map(),
    sandboxTokenToProjectDir: new Map(),
    sandboxOwnerWebContentsIdToTokens: new Map(),
    sandboxOwnerCleanupHooked: new Set(),
    sandboxView: null,
    sandboxViewWebContentsId: null,
    activeSandboxToken: null,
    sandboxEnsureInFlight: null,
    projectorDefaultBounds: null,
    pendingSandboxRequests: new Map(),
    didRunShutdownCleanup: false,
  };

  const moduleExports = loadModule(windowsPath, {
    electron: {
      BrowserWindow: MockBrowserWindow,
      app: {
        on: () => {},
        quit: () => {},
      },
      shell: {
        openExternal: (url) => {
          shellOpenExternalCalls.push(url);
        },
      },
      screen: {
        getPrimaryDisplay: () => ({
          workAreaSize: { width: 1200, height: 800 },
          workArea: { x: 0, y: 0, width: 1200, height: 800 },
        }),
        getDisplayMatching: () => ({
          workArea: { x: 0, y: 0, width: 1200, height: 800 },
        }),
      },
    },
    "../InputManager": class InputManager {},
    "../../shared/config/defaultConfig": {
      DEFAULT_INPUT_CONFIG: {},
      DEFAULT_USER_DATA: { config: {} },
    },
    "../../shared/validation/jsonBridgeValidation": {
      sanitizeJsonForBridge: (_name, value, fallback) => value ?? fallback,
    },
    "../../shared/validation/dashboardProjectorIpcValidation": {
      normalizeDashboardProjectorMessage: (value) => value,
    },
    "../../shared/validation/openExternalValidation": {
      normalizeOpenExternalUrl: (url) =>
        typeof url === "string" && /^https?:\/\//i.test(url) ? url : null,
    },
    "./state": {
      srcDir: "/tmp/src",
      state,
    },
    "./workspace": {
      getProjectJsonDirForMain: () => null,
      startWorkspaceWatcher: () => {},
    },
    "./sandbox": {
      destroySandboxView: () => {},
      updateSandboxViewBounds: () => {},
    },
  }, {
    setTimeout: fakeSetTimeout,
    clearTimeout: fakeClearTimeout,
  });

  return {
    ...moduleExports,
    browserWindows,
    state,
    attachCalls,
    shellOpenExternalCalls,
    pendingTimers,
    advanceTimers,
  };
};

test("handleTrackSelection drains pending track after empty-track early exit", async () => {
  const { handleTrackSelection, projectorMessages } = createTrackLifecycleHarness();
  const ctx = {
    userData: [
      { name: "Track A", modules: [] },
      { name: "Track B", modules: [] },
    ],
    lastRequestedTrackName: null,
    isLoadingTrack: false,
    pendingTrackName: "Track B",
    pendingReloadData: null,
    pendingWorkspaceReload: false,
    activeTrack: null,
    activeModules: {},
    activeChannelHandlers: {},
    trackModuleSources: null,
    workspacePath: "/tmp/workspace",
    buildChannelHandlerMap: (track) => ({ trackName: track.name }),
    deactivateActiveTrack() {
      this.activeTrack = null;
      this.activeModules = {};
    },
    setRenderStatus() {},
    handleTrackSelection(trackName) {
      return handleTrackSelection.call(this, trackName);
    },
  };

  await ctx.handleTrackSelection("Track A");
  await Promise.resolve();

  assert.equal(ctx.pendingTrackName, null);
  assert.equal(ctx.activeTrack?.name, "Track B");
  assert.equal(projectorMessages.at(-1)?.type, "projector-ready");
});

test("handleTrackSelection drains pending track after not-found early exit", async () => {
  const { handleTrackSelection, projectorMessages } = createTrackLifecycleHarness();
  const ctx = {
    userData: [{ name: "Track B", modules: [] }],
    lastRequestedTrackName: null,
    isLoadingTrack: false,
    pendingTrackName: "Track B",
    pendingReloadData: null,
    pendingWorkspaceReload: false,
    activeTrack: null,
    activeModules: {},
    activeChannelHandlers: {},
    trackModuleSources: null,
    workspacePath: "/tmp/workspace",
    buildChannelHandlerMap: (track) => ({ trackName: track.name }),
    deactivateActiveTrack() {
      this.activeTrack = null;
      this.activeModules = {};
    },
    setRenderStatus() {},
    handleTrackSelection(trackName) {
      return handleTrackSelection.call(this, trackName);
    },
  };

  await ctx.handleTrackSelection("Missing Track");
  await Promise.resolve();

  assert.equal(ctx.pendingTrackName, null);
  assert.equal(ctx.activeTrack?.name, "Track B");
  assert.equal(projectorMessages.at(-1)?.type, "projector-ready");
});

test("preview chaining preserves the original restore track", async () => {
  const { previewModule, clearPreviewForModule } = createPreviewControllerHarness();
  const restoredTracks = [];
  const ctx = {
    previewToken: 0,
    previewModuleName: null,
    restoreTrackNameAfterPreview: null,
    activeTrack: { name: "Live Track" },
    activeModules: {},
    trackSandboxHost: null,
    trackModuleSources: null,
    loadWorkspaceModuleSource: async () => ({ text: "export default function Example() {}" }),
    deactivateActiveTrack() {
      this.activeTrack = null;
    },
    handleTrackSelection(trackName) {
      restoredTracks.push(trackName);
      this.activeTrack = { name: trackName };
    },
    getAssetsBaseUrlForSandboxToken: () => "nw-assets://app/token/",
    clearPreviewForModule(moduleName, options) {
      return clearPreviewForModule.call(this, moduleName, options);
    },
  };

  await previewModule.call(ctx, "ModuleA", { constructor: [] }, "request-a");
  assert.equal(ctx.previewModuleName, "ModuleA");
  assert.equal(ctx.restoreTrackNameAfterPreview, "Live Track");

  await previewModule.call(ctx, "ModuleB", { constructor: [] }, "request-b");
  assert.equal(ctx.previewModuleName, "ModuleB");
  assert.equal(ctx.restoreTrackNameAfterPreview, "Live Track");

  clearPreviewForModule.call(ctx, "ModuleB", { restoreTrack: true });

  assert.deepEqual(restoredTracks, ["Live Track"]);
  assert.equal(ctx.activeTrack?.name, "Live Track");
});

test("projector recovery timer does not recreate a window after shutdown starts", () => {
  const { createWindow, browserWindows, state, attachCalls, pendingTimers, advanceTimers } =
    createWindowsHarness();

  createWindow("/tmp/workspace");

  const projectorWindowsBeforeClose = browserWindows.filter((win) => win.title === "Projector 1");
  assert.equal(projectorWindowsBeforeClose.length, 1);

  const projector = state.projector1Window;
  assert.ok(projector);

  projector.close();
  state.didRunShutdownCleanup = true;

  assert.equal(
    pendingTimers.length,
    1,
    "closing the projector should have scheduled exactly one recovery timer"
  );
  assert.equal(
    browserWindows.filter((win) => win.title === "Projector 1").length,
    1,
    "no window may be created before the recovery timer fires"
  );

  advanceTimers(1000);

  const projectorWindowsAfterClose = browserWindows.filter((win) => win.title === "Projector 1");
  assert.equal(projectorWindowsAfterClose.length, 1);
  assert.equal(state.projector1Window, null);
  assert.deepEqual(attachCalls, [null]);
  assert.equal(pendingTimers.length, 0);
});

test("createWindow denies new windows and blocks external navigation on both windows", () => {
  const { createWindow, browserWindows, shellOpenExternalCalls } = createWindowsHarness();

  createWindow("/tmp/workspace");

  const windowsToCheck = browserWindows.filter(
    (win) => win.title === "Projector 1" || win.title === "nw_wrld"
  );
  assert.equal(windowsToCheck.length, 2, "expected a projector and a dashboard window");

  for (const win of windowsToCheck) {
    const wc = win.webContents;

    assert.equal(
      typeof wc.windowOpenHandler,
      "function",
      `${win.title}: setWindowOpenHandler should be installed`
    );
    const decision = wc.windowOpenHandler({ url: "https://example.com/page" });
    assert.equal(decision.action, "deny", `${win.title}: window.open must be denied`);

    const navHandlers = wc.handlers.get("will-navigate") || [];
    assert.ok(navHandlers.length >= 1, `${win.title}: will-navigate should be registered`);
    let blockedExternal = false;
    navHandlers.forEach((handler) =>
      handler({ preventDefault: () => (blockedExternal = true) }, "https://evil.example/x")
    );
    assert.equal(blockedExternal, true, `${win.title}: external navigation must be prevented`);

    let blockedInternal = false;
    navHandlers.forEach((handler) =>
      handler({ preventDefault: () => (blockedInternal = true) }, "file:///app/dashboard.html")
    );
    assert.equal(blockedInternal, false, `${win.title}: file:// navigation must be allowed`);
  }

  assert.deepEqual(
    shellOpenExternalCalls,
    ["https://example.com/page", "https://example.com/page"],
    "denied http(s) window.open should be forwarded to shell.openExternal once per window"
  );
});
