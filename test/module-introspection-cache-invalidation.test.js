const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const { introspectModule } = require(path.join(
  __dirname,
  "..",
  "dist",
  "runtime",
  "projector",
  "internal",
  "introspection.js"
));

test("introspectModule caches by mtimeMs and recomputes when mtimeMs changes (bad -> good)", async () => {
  let currentMtimeMs = 1;
  let currentText = "BAD";

  globalThis.nwWrldBridge = {
    workspace: {
      getModuleUrl: async () => ({ mtimeMs: currentMtimeMs }),
    },
  };

  let loadCalls = 0;
  const loadWorkspaceModuleSource = async (moduleId) => {
    loadCalls += 1;
    return { moduleId: String(moduleId), text: currentText, mtimeMs: currentMtimeMs };
  };

  let sandboxCalls = 0;
  const trackSandboxHost = {
    introspectModule: async (_moduleId, text) => {
      sandboxCalls += 1;
      if (String(text).includes("GOOD")) {
        return { ok: true, name: "Good", category: "Test", methods: [] };
      }
      return { ok: false, error: "SYNTAX_ERROR" };
    },
  };

  const ctx = {
    workspacePath: "/tmp",
    moduleIntrospectionCache: new Map(),
    loadWorkspaceModuleSource,
    trackSandboxHost,
  };

  const first = await introspectModule.call(ctx, "E2EHot");
  assert.equal(first.ok, false);
  assert.equal(loadCalls, 1);
  assert.equal(sandboxCalls, 1);
  assert.equal(ctx.moduleIntrospectionCache.size, 1);

  currentText = "GOOD";
  const second = await introspectModule.call(ctx, "E2EHot");
  assert.equal(second.ok, false);
  assert.equal(loadCalls, 1);
  assert.equal(sandboxCalls, 1);
  assert.equal(ctx.moduleIntrospectionCache.size, 1);

  currentMtimeMs = 2;
  const third = await introspectModule.call(ctx, "E2EHot");
  assert.equal(third.ok, true);
  assert.equal(loadCalls, 2);
  assert.equal(sandboxCalls, 2);
  assert.equal(ctx.moduleIntrospectionCache.size, 1);
});

test("introspectModule recomputes when mtimeMs changes (good -> bad)", async () => {
  let currentMtimeMs = 10;
  let currentText = "GOOD";

  globalThis.nwWrldBridge = {
    workspace: {
      getModuleUrl: async () => ({ mtimeMs: currentMtimeMs }),
    },
  };

  const loadWorkspaceModuleSource = async (moduleId) => ({
    moduleId: String(moduleId),
    text: currentText,
    mtimeMs: currentMtimeMs,
  });

  const trackSandboxHost = {
    introspectModule: async (_moduleId, text) => {
      if (String(text).includes("GOOD")) {
        return { ok: true, name: "Good", category: "Test", methods: [] };
      }
      return { ok: false, error: "SYNTAX_ERROR" };
    },
  };

  const ctx = {
    workspacePath: "/tmp",
    moduleIntrospectionCache: new Map(),
    loadWorkspaceModuleSource,
    trackSandboxHost,
  };

  const first = await introspectModule.call(ctx, "E2EHot");
  assert.equal(first.ok, true);

  currentText = "BAD";
  currentMtimeMs = 11;
  const second = await introspectModule.call(ctx, "E2EHot");
  assert.equal(second.ok, false);
});

