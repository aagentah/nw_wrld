const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const { loadSettingsSync } = require(
  path.join(__dirname, "..", "dist", "runtime", "shared", "json", "configUtils.js")
);
const { loadAppStateSync } = require(
  path.join(__dirname, "..", "dist", "runtime", "shared", "json", "appStateUtils.js")
);

test("configUtils: loadSettingsSync delegates to bridge json.readSync", () => {
  const prev = globalThis.nwWrldAppBridge;
  try {
    globalThis.nwWrldAppBridge = {
      json: {
        readSync: (filename, defaultValue) => {
          assert.equal(filename, "config.json");
          assert.ok(defaultValue && typeof defaultValue === "object");
          return { ok: true };
        },
      },
    };
    assert.deepEqual(loadSettingsSync(), { ok: true });
  } finally {
    globalThis.nwWrldAppBridge = prev;
  }
});

test("appStateUtils: loadAppStateSync delegates to bridge json.readSync", () => {
  const prev = globalThis.nwWrldAppBridge;
  try {
    globalThis.nwWrldAppBridge = {
      json: {
        readSync: (filename, defaultValue) => {
          assert.equal(filename, "appState.json");
          assert.ok(defaultValue && typeof defaultValue === "object");
          return { ok: true };
        },
      },
    };
    assert.deepEqual(loadAppStateSync(), { ok: true });
  } finally {
    globalThis.nwWrldAppBridge = prev;
  }
});

