const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const { normalizeInputEventPayload } = require(path.join(
  __dirname,
  "..",
  "dist",
  "runtime",
  "shared",
  "validation",
  "inputEventValidation.js"
));

test("input-event normalizer accepts MIDI track-selection", () => {
  const payload = {
    type: "track-selection",
    data: {
      note: 60,
      channel: 1,
      velocity: 0.5,
      source: "midi",
      timestamp: 123.456,
    },
  };

  const res = normalizeInputEventPayload(payload);
  assert.deepEqual(res, payload);
});

test("input-event normalizer accepts MIDI method-trigger", () => {
  const payload = {
    type: "method-trigger",
    data: {
      note: 61,
      channel: 2,
      velocity: 127,
      source: "midi",
      timestamp: 1,
    },
  };

  const res = normalizeInputEventPayload(payload);
  assert.deepEqual(res, payload);
});

test("input-event normalizer accepts OSC track-selection", () => {
  const payload = {
    type: "track-selection",
    data: {
      source: "osc",
      address: "/track/intro",
      identifier: "/track/intro",
      timestamp: 2,
    },
  };

  const res = normalizeInputEventPayload(payload);
  assert.deepEqual(res, payload);
});

test("input-event normalizer accepts OSC method-trigger", () => {
  const payload = {
    type: "method-trigger",
    data: {
      source: "osc",
      address: "/ch/bass",
      channelName: "/ch/bass",
      velocity: 0.9,
      timestamp: 3,
    },
  };

  const res = normalizeInputEventPayload(payload);
  assert.deepEqual(res, payload);
});

test("input-event normalizer accepts AUDIO method-trigger", () => {
  const payload = {
    type: "method-trigger",
    data: {
      source: "audio",
      channelName: "low",
      velocity: 0.25,
      timestamp: 4,
    },
  };

  const res = normalizeInputEventPayload(payload);
  assert.deepEqual(res, payload);
});

test("input-event normalizer accepts FILE method-trigger", () => {
  const payload = {
    type: "method-trigger",
    data: {
      source: "file",
      channelName: "low",
      velocity: 0.25,
      timestamp: 5,
    },
  };

  const res = normalizeInputEventPayload(payload);
  assert.deepEqual(res, payload);
});

test("input-event normalizer rejects invalid payloads", () => {
  assert.equal(normalizeInputEventPayload(null), null);
  assert.equal(normalizeInputEventPayload({}), null);
  assert.equal(
    normalizeInputEventPayload({ type: "track-selection", data: {} }),
    null
  );
});
