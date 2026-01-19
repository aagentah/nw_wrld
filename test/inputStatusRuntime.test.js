const test = require("node:test");
const assert = require("node:assert/strict");

const INPUT_STATUS = require("../dist/runtime/shared/constants/inputStatus.cjs");

test("INPUT_STATUS exports expected constants", () => {
  assert.deepEqual(INPUT_STATUS, {
    DISCONNECTED: "disconnected",
    CONNECTING: "connecting",
    CONNECTED: "connected",
    ERROR: "error",
  });
});

