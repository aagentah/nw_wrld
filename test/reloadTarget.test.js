const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const { resolveReloadTarget } = require(
  path.join(__dirname, "..", "dist", "runtime", "projector", "internal", "track", "reloadTarget.js")
);

test("resolveReloadTarget: a named track resolves to a select action", () => {
  assert.deepEqual(resolveReloadTarget("Track 1", 3), {
    action: "select",
    trackName: "Track 1",
  });
});

test("resolveReloadTarget: trims surrounding whitespace from the track name", () => {
  assert.deepEqual(resolveReloadTarget("  Track 1  ", 3), {
    action: "select",
    trackName: "Track 1",
  });
});

test("resolveReloadTarget: null track name with no tracks shows the empty-set message", () => {
  // Bug 1: a freshly created empty set must NOT resurrect a previous set's track.
  assert.deepEqual(resolveReloadTarget(null, 0), {
    action: "empty",
    message: "No tracks in this set",
  });
});

test("resolveReloadTarget: null track name with tracks present shows no-selection message", () => {
  assert.deepEqual(resolveReloadTarget(null, 2), {
    action: "empty",
    message: "No track selected",
  });
});

test("resolveReloadTarget: empty or whitespace track name never resolves to select", () => {
  assert.equal(resolveReloadTarget("", 0).action, "empty");
  assert.equal(resolveReloadTarget("   ", 5).action, "empty");
  assert.equal(resolveReloadTarget(undefined, 0).action, "empty");
});
