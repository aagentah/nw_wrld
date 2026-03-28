const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const { initWorkspaceModulesChangedListener } = require(
  path.join(__dirname, "..", "dist", "runtime", "projector", "internal", "workspaceEvents.js")
);

test("workspaceEvents: modulesChanged reloads active track or lastRequestedTrackName", () => {
  const prevBridge = globalThis.nwWrldBridge;
  try {
    let handler = null;
    globalThis.nwWrldBridge = {
      messaging: {
        onWorkspaceModulesChanged: (cb) => {
          handler = cb;
          return () => {};
        },
      },
    };

    const calls = [];
    const cache = new Map([["Example", 123]]);
    const ctx = {
      workspaceModuleSourceCache: cache,
      assetsBaseUrl: "not-null",
      trackSandboxHost: { destroy: () => calls.push("destroySandbox") },
      trackModuleSources: { some: "sources" },
      activeTrack: { name: "Track A" },
      lastRequestedTrackName: null,
      isLoadingTrack: false,
      pendingWorkspaceReload: false,
      deactivateActiveTrack: () => calls.push("deactivate"),
      handleTrackSelection: (name) => calls.push(["select", name]),
    };

    initWorkspaceModulesChangedListener.call(ctx);
    assert.equal(typeof handler, "function");

    handler();
    assert.equal(ctx.workspaceModuleSourceCache.size, 0);
    assert.equal(ctx.assetsBaseUrl, null);
    assert.equal(ctx.trackSandboxHost, null);
    assert.equal(ctx.trackModuleSources, null);
    assert.deepEqual(calls, ["destroySandbox", "deactivate", ["select", "Track A"]]);

    calls.length = 0;
    ctx.workspaceModuleSourceCache.set("Again", 1);
    ctx.assetsBaseUrl = "x";
    ctx.trackSandboxHost = { destroy: () => calls.push("destroySandbox") };
    ctx.trackModuleSources = { some: "sources" };
    ctx.activeTrack = null;
    ctx.lastRequestedTrackName = "Track B";

    handler();
    assert.equal(ctx.workspaceModuleSourceCache.size, 0);
    assert.equal(ctx.assetsBaseUrl, null);
    assert.equal(ctx.trackSandboxHost, null);
    assert.equal(ctx.trackModuleSources, null);
    assert.deepEqual(calls, ["destroySandbox", "deactivate", ["select", "Track B"]]);
  } finally {
    globalThis.nwWrldBridge = prevBridge;
  }
});

test("workspaceEvents: modulesChanged defers reload while isLoadingTrack", () => {
  const prevBridge = globalThis.nwWrldBridge;
  try {
    let handler = null;
    globalThis.nwWrldBridge = {
      messaging: {
        onWorkspaceModulesChanged: (cb) => {
          handler = cb;
          return () => {};
        },
      },
    };

    let deactivateCalls = 0;
    let selectCalls = 0;
    const sandboxHost = { destroy: () => {} };
    const trackSources = { some: "sources" };
    const ctx = {
      workspaceModuleSourceCache: new Map([["Example", 123]]),
      assetsBaseUrl: "not-null",
      trackSandboxHost: sandboxHost,
      trackModuleSources: trackSources,
      activeTrack: { name: "Track Loading" },
      lastRequestedTrackName: null,
      isLoadingTrack: true,
      pendingWorkspaceReload: false,
      deactivateActiveTrack: () => {
        deactivateCalls += 1;
      },
      handleTrackSelection: () => {
        selectCalls += 1;
      },
    };

    initWorkspaceModulesChangedListener.call(ctx);
    assert.equal(typeof handler, "function");

    handler();
    assert.equal(ctx.workspaceModuleSourceCache.size, 0);
    assert.equal(ctx.assetsBaseUrl, null);
    assert.equal(ctx.trackSandboxHost, sandboxHost);
    assert.equal(ctx.trackModuleSources, trackSources);
    assert.equal(ctx.pendingWorkspaceReload, true);
    assert.equal(deactivateCalls, 0);
    assert.equal(selectCalls, 0);
  } finally {
    globalThis.nwWrldBridge = prevBridge;
  }
});
