const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const { sanitizeAppStateForBridge } = require(path.join(
  __dirname,
  "..",
  "dist",
  "runtime",
  "shared",
  "validation",
  "appStateValidation.js"
));

test("appState.json sanitize is a no-op for valid app state (reference preserved)", () => {
  const input = {
    activeTrackId: 1,
    activeSetId: "set_1",
    sequencerMuted: false,
    workspacePath: "/tmp/project",
  };

  const res = sanitizeAppStateForBridge(input, {
    activeTrackId: null,
    activeSetId: null,
    sequencerMuted: false,
    workspacePath: null,
  });

  assert.equal(res, input);
});

test("appState.json sanitize normalizes invalid values to stable safe defaults", () => {
  const input = {
    activeTrackId: "   ",
    activeSetId: "   ",
    sequencerMuted: "true",
    workspacePath: "  /tmp/project  ",
  };

  const res = sanitizeAppStateForBridge(input, {});

  assert.deepEqual(res, {
    activeTrackId: null,
    activeSetId: null,
    sequencerMuted: false,
    workspacePath: "/tmp/project",
  });
});

