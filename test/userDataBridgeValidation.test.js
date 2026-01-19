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

test("userData.json sanitize preserves config.aspectRatio (startup-critical)", () => {
  const defaultValue = { config: {}, sets: [] };
  const input = { config: { aspectRatio: "16-9" }, sets: [] };
  const res = sanitizeJsonForBridge("userData.json", input, defaultValue);
  assert.equal(res.config.aspectRatio, "16-9");
});
