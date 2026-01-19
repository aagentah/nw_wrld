const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const {
  isExistingDirectory,
  resolveWithinDir,
  safeModuleName,
  safeJsonFilename,
} = require("../dist/runtime/main/mainProcess/pathSafety.js");

test("safeModuleName: accepts simple alnum names and rejects others", () => {
  assert.equal(safeModuleName("Hello123"), "Hello123");
  assert.equal(safeModuleName(""), null);
  assert.equal(safeModuleName("123"), null);
  assert.equal(safeModuleName("hello_world"), null);
  assert.equal(safeModuleName("../x"), null);
});

test("safeJsonFilename: only accepts known json filenames", () => {
  assert.equal(safeJsonFilename("userData.json"), "userData.json");
  assert.equal(safeJsonFilename("appState.json"), "appState.json");
  assert.equal(safeJsonFilename("config.json"), "config.json");
  assert.equal(safeJsonFilename("recordingData.json"), "recordingData.json");
  assert.equal(safeJsonFilename("other.json"), null);
});

test("resolveWithinDir: prevents path traversal and returns resolved paths", () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "nw_wrld_pathsafety_"));
  assert.equal(isExistingDirectory(base), true);

  const ok = resolveWithinDir(base, "a/b.txt");
  assert.equal(typeof ok, "string");
  assert.ok(ok.endsWith(path.join("a", "b.txt")));
  assert.ok(ok.startsWith(base));

  const traversal = resolveWithinDir(base, "../escape.txt");
  assert.equal(traversal, null);
});

