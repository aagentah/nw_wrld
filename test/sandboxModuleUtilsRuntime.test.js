const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getTokenFromLocationHash,
  safeAssetRelPath,
  ensureTrailingSlash,
  buildWorkspaceImportPreamble,
} = require("../dist/runtime/shared/validation/sandboxModuleUtils.js");

test("getTokenFromLocationHash: parses token from hash", () => {
  assert.equal(getTokenFromLocationHash("#token=abc"), "abc");
  assert.equal(getTokenFromLocationHash("token=abc"), "abc");
  assert.equal(getTokenFromLocationHash("#foo=1"), null);
  assert.equal(getTokenFromLocationHash(null), null);
  assert.equal(getTokenFromLocationHash({}), null);
});

test("safeAssetRelPath: accepts safe rel paths and rejects traversal", () => {
  assert.equal(safeAssetRelPath("a/b.txt"), "a/b.txt");
  assert.equal(safeAssetRelPath("a//b.txt"), "a/b.txt");
  assert.equal(safeAssetRelPath(""), null);
  assert.equal(safeAssetRelPath("../escape.txt"), null);
  assert.equal(safeAssetRelPath("a/../b.txt"), null);
  assert.equal(safeAssetRelPath("/abs.txt"), null);
  assert.equal(safeAssetRelPath("C:\\x"), null);
  assert.equal(safeAssetRelPath("x\\y"), null);
  assert.equal(safeAssetRelPath("x:y"), null);
});

test("ensureTrailingSlash: adds trailing slash if missing", () => {
  assert.equal(ensureTrailingSlash("nw-assets://app/token"), "nw-assets://app/token/");
  assert.equal(ensureTrailingSlash("nw-assets://app/token/"), "nw-assets://app/token/");
  assert.equal(ensureTrailingSlash(null), "/");
});

test("buildWorkspaceImportPreamble: builds preamble for allowed imports", () => {
  const preamble = buildWorkspaceImportPreamble("MyMod", ["ModuleBase", "THREE"]);
  assert.equal(typeof preamble, "string");
  assert.ok(preamble.includes("globalThis.nwWrldSdk"));
  assert.ok(preamble.includes("const THREE = globalThis.THREE;"));
  assert.ok(preamble.includes('Missing required import: ModuleBase'));
  assert.ok(preamble.endsWith("\n"));
});

test("buildWorkspaceImportPreamble: rejects missing/unknown imports", () => {
  assert.throws(
    () => buildWorkspaceImportPreamble("MyMod", []),
    /missing required @nwWrld imports/
  );
  assert.throws(
    () => buildWorkspaceImportPreamble("MyMod", ["Nope"]),
    /requested unknown import "Nope"/
  );
});

