const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const { normalizeInputConfig } = require(
  path.join(__dirname, "..", "dist", "runtime", "shared", "validation", "inputConfigValidation.js")
);

test("input config normalizer preserves valid config (including extra fields)", () => {
  const input = {
    type: "midi",
    deviceName: " IAC Driver Bus 1 ",
    trackSelectionChannel: 2,
    methodTriggerChannel: 1,
    velocitySensitive: false,
    noteMatchMode: "pitchClass",
    port: 8000,
    extra: { keep: true },
  };
  const res = normalizeInputConfig(input);
  assert.equal(res, input);
});

test("input config normalizer accepts audio input type", () => {
  const input = {
    type: "audio",
    trackSelectionChannel: 2,
    methodTriggerChannel: 1,
    velocitySensitive: false,
    port: 8000,
    extra: { keep: true },
  };
  const res = normalizeInputConfig(input);
  assert.equal(res, input);
});

test("input config normalizer accepts file input type", () => {
  const input = {
    type: "file",
    trackSelectionChannel: 2,
    methodTriggerChannel: 1,
    velocitySensitive: false,
    port: 8000,
    extra: { keep: true },
  };
  const res = normalizeInputConfig(input);
  assert.equal(res, input);
});

test("input config normalizer preserves unknown fields even when it sanitizes known fields", () => {
  const input = {
    type: "midi",
    deviceName: "   ",
    trackSelectionChannel: 2,
    methodTriggerChannel: 1,
    velocitySensitive: false,
    port: 8000,
    extra: { keep: true },
  };
  const res = normalizeInputConfig(input);
  assert.notEqual(res, input);
  assert.equal(res.extra, input.extra);
  assert.equal("deviceName" in res, false);
});

test("input config normalizer rejects invalid payloads", () => {
  assert.equal(normalizeInputConfig(null), null);
  assert.equal(normalizeInputConfig({ type: "midi" }), null);
  assert.equal(
    normalizeInputConfig({
      type: "osc",
      trackSelectionChannel: 2,
      methodTriggerChannel: 1,
      velocitySensitive: false,
      port: 0,
    }),
    null
  );
});
