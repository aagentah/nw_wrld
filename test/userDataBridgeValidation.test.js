const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const { sanitizeJsonForBridge } = require(
  path.join(__dirname, "..", "dist", "runtime", "shared", "validation", "jsonBridgeValidation.js")
);

test("userData.json sanitize preserves default flags and minimum shape", () => {
  const defaultValue = { config: {}, sets: [], _isDefaultData: true };
  const res = sanitizeJsonForBridge("userData.json", defaultValue, defaultValue);
  assert.equal(res._isDefaultData, true);
  assert.ok(res.config && typeof res.config === "object");
  assert.ok(Array.isArray(res.sets));
});

test("userData.json sanitize repairs missing config/sets types", () => {
  const defaultValue = {
    config: {},
    sets: [{ id: "set_1", name: "Set 1", tracks: [] }],
  };
  const res = sanitizeJsonForBridge("userData.json", { config: null, sets: null }, defaultValue);
  assert.ok(res.config && typeof res.config === "object");
  assert.ok(Array.isArray(res.sets));
});

test("userData.json sanitize normalizes legacy tracks root into sets", () => {
  const defaultValue = { config: {}, sets: [] };
  const input = {
    config: {},
    tracks: [{ id: 1, name: "T", modules: [], modulesData: {} }],
  };
  const res = sanitizeJsonForBridge("userData.json", input, defaultValue);
  assert.ok(Array.isArray(res.sets));
  assert.equal(res.sets.length, 1);
  assert.ok(Array.isArray(res.sets[0].tracks));
  assert.equal(res.sets[0].tracks.length, 1);
});

test("userData.json sanitize drops invalid module entries and ensures modulesData object", () => {
  const defaultValue = { config: {}, sets: [] };
  const input = {
    config: {},
    sets: [
      {
        id: "set_1",
        name: "Set 1",
        tracks: [
          {
            id: 1,
            name: "T",
            modules: [{ id: "a", type: "X" }, { id: "", type: "Y" }, null],
            modulesData: null,
          },
        ],
      },
    ],
  };
  const res = sanitizeJsonForBridge("userData.json", input, defaultValue);
  const track = res.sets[0].tracks[0];
  assert.equal(track.modules.length, 1);
  assert.ok(track.modulesData && typeof track.modulesData === "object");
});

test("userData.json sanitize ensures each track has at least 3 channelMappings keys", () => {
  const defaultValue = { config: {}, sets: [] };
  const input = {
    config: {},
    sets: [
      {
        id: "set_1",
        name: "Set 1",
        tracks: [
          {
            id: 1,
            name: "T",
            modules: [],
            modulesData: {},
            channelMappings: { 1: 1 },
          },
        ],
      },
    ],
  };
  const res = sanitizeJsonForBridge("userData.json", input, defaultValue);
  const track = res.sets[0].tracks[0];
  assert.ok(track.channelMappings && typeof track.channelMappings === "object");
  const keys = Object.keys(track.channelMappings);
  assert.ok(keys.includes("1"));
  assert.ok(keys.includes("2"));
  assert.ok(keys.includes("3"));
});

test("userData.json sanitize does not mutate input when filling missing channelMappings keys", () => {
  const defaultValue = { config: {}, sets: [] };
  const input = {
    config: {},
    sets: [
      {
        id: "set_1",
        name: "Set 1",
        tracks: [
          {
            id: 1,
            name: "T",
            modules: [],
            modulesData: {},
            channelMappings: { 1: 1 },
          },
        ],
      },
    ],
  };
  const before = JSON.parse(JSON.stringify(input));
  const res = sanitizeJsonForBridge("userData.json", input, defaultValue);
  assert.deepEqual(input, before);
  const cm = res.sets[0].tracks[0].channelMappings;
  const keys = Object.keys(cm);
  assert.ok(keys.includes("1"));
  assert.ok(keys.includes("2"));
  assert.ok(keys.includes("3"));
});

test("userData.json sanitize ensures each track has signal.audio and signal.file defaults", () => {
  const defaultValue = { config: {}, sets: [] };
  const input = {
    config: {},
    sets: [
      {
        id: "set_1",
        name: "Set 1",
        tracks: [
          { id: 1, name: "T", modules: [], modulesData: {}, channelMappings: { 1: 1, 2: 2, 3: 3 } },
        ],
      },
    ],
  };
  const res = sanitizeJsonForBridge("userData.json", input, defaultValue);
  const track = res.sets[0].tracks[0];
  assert.ok(track.signal && typeof track.signal === "object");
  assert.ok(track.signal.audio && typeof track.signal.audio === "object");
  assert.ok(track.signal.file && typeof track.signal.file === "object");
  assert.deepEqual(track.signal.audio.thresholds, { low: 0.5, medium: 0.5, high: 0.5 });
  assert.equal(track.signal.audio.minIntervalMs, 120);
  assert.deepEqual(track.signal.file.thresholds, { low: 0.5, medium: 0.5, high: 0.5 });
  assert.equal(track.signal.file.minIntervalMs, 120);
  assert.equal(track.signal.file.assetRelPath, "");
  assert.equal(track.signal.file.assetName, "");
});

test("userData.json sanitize clamps track signal values", () => {
  const defaultValue = { config: {}, sets: [] };
  const input = {
    config: {},
    sets: [
      {
        id: "set_1",
        name: "Set 1",
        tracks: [
          {
            id: 1,
            name: "T",
            modules: [],
            modulesData: {},
            channelMappings: { 1: 1, 2: 2, 3: 3 },
            signal: {
              audio: { thresholds: { low: -1, medium: 2, high: 0.25 }, minIntervalMs: 100000 },
              file: {
                thresholds: { low: NaN, medium: 0.1, high: Infinity },
                minIntervalMs: -50,
                assetRelPath: "  ",
                assetName: 123,
              },
            },
          },
        ],
      },
    ],
  };
  const res = sanitizeJsonForBridge("userData.json", input, defaultValue);
  const track = res.sets[0].tracks[0];
  assert.deepEqual(track.signal.audio.thresholds, { low: 0, medium: 1, high: 0.25 });
  assert.equal(track.signal.audio.minIntervalMs, 10_000);
  assert.deepEqual(track.signal.file.thresholds, { low: 0.5, medium: 0.1, high: 0.5 });
  assert.equal(track.signal.file.minIntervalMs, 0);
  assert.equal(track.signal.file.assetRelPath, "");
  assert.equal(track.signal.file.assetName, "");
});

test("userData.json sanitize rounds signal minIntervalMs to integer", () => {
  const defaultValue = { config: {}, sets: [] };
  const input = {
    config: {},
    sets: [
      {
        id: "set_1",
        name: "Set 1",
        tracks: [
          {
            id: 1,
            name: "T",
            modules: [],
            modulesData: {},
            channelMappings: { 1: 1, 2: 2, 3: 3 },
            signal: {
              audio: { thresholds: { low: 0.5, medium: 0.5, high: 0.5 }, minIntervalMs: 120.6 },
              file: {
                thresholds: { low: 0.5, medium: 0.5, high: 0.5 },
                minIntervalMs: 120.4,
                assetRelPath: "assets/x.wav",
                assetName: "x.wav",
              },
            },
          },
        ],
      },
    ],
  };
  const res = sanitizeJsonForBridge("userData.json", input, defaultValue);
  const track = res.sets[0].tracks[0];
  assert.equal(track.signal.audio.minIntervalMs, 121);
  assert.equal(track.signal.file.minIntervalMs, 120);
});

test("userData.json sanitize trims file asset strings and preserves non-empty values", () => {
  const defaultValue = { config: {}, sets: [] };
  const input = {
    config: {},
    sets: [
      {
        id: "set_1",
        name: "Set 1",
        tracks: [
          {
            id: 1,
            name: "T",
            modules: [],
            modulesData: {},
            channelMappings: { 1: 1, 2: 2, 3: 3 },
            signal: {
              audio: { thresholds: { low: 0.5, medium: 0.5, high: 0.5 }, minIntervalMs: 120 },
              file: {
                thresholds: { low: 0.5, medium: 0.5, high: 0.5 },
                minIntervalMs: 120,
                assetRelPath: "  assets/audio/example.wav  ",
                assetName: "  example.wav  ",
              },
            },
          },
        ],
      },
    ],
  };
  const res = sanitizeJsonForBridge("userData.json", input, defaultValue);
  const track = res.sets[0].tracks[0];
  assert.equal(track.signal.file.assetRelPath, "assets/audio/example.wav");
  assert.equal(track.signal.file.assetName, "example.wav");
});

test("userData.json sanitize normalizes track module disabled flag to boolean true only", () => {
  const defaultValue = { config: {}, sets: [] };
  const input = {
    config: {},
    sets: [
      {
        id: "set_1",
        name: "Set 1",
        tracks: [
          {
            id: 1,
            name: "T",
            modules: [
              { id: "a", type: "X", disabled: true },
              { id: "b", type: "Y", disabled: false },
              { id: "c", type: "Z", disabled: "true" },
            ],
            modulesData: {},
          },
        ],
      },
    ],
  };
  const res = sanitizeJsonForBridge("userData.json", input, defaultValue);
  const mods = res.sets[0].tracks[0].modules;
  assert.equal(mods[0].disabled, true);
  assert.ok(!("disabled" in mods[1]));
  assert.ok(!("disabled" in mods[2]));
});

test("userData.json sanitize preserves config.aspectRatio (startup-critical)", () => {
  const defaultValue = { config: {}, sets: [] };
  const input = { config: { aspectRatio: "16-9" }, sets: [] };
  const res = sanitizeJsonForBridge("userData.json", input, defaultValue);
  assert.equal(res.config.aspectRatio, "16-9");
});

test("userData.json sanitize guarantees file mappings keys exist", () => {
  const defaultValue = require(
    path.join(__dirname, "..", "dist", "runtime", "shared", "config", "defaultConfig.js")
  ).DEFAULT_USER_DATA;
  const input = {
    config: {
      trackMappings: { midi: {}, osc: {}, audio: {} },
      channelMappings: { midi: {}, osc: {}, audio: {} },
    },
    sets: [],
  };
  const res = sanitizeJsonForBridge("userData.json", input, defaultValue);
  assert.ok(res.config && typeof res.config === "object");
  assert.ok(res.config.trackMappings && typeof res.config.trackMappings === "object");
  assert.ok(res.config.channelMappings && typeof res.config.channelMappings === "object");
  assert.ok(res.config.trackMappings.file && typeof res.config.trackMappings.file === "object");
  assert.ok(res.config.channelMappings.file && typeof res.config.channelMappings.file === "object");
});
