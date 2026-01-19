const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const { migrateToSets, getActiveSetTracks, getActiveSet } = require(
  path.join(__dirname, "..", "dist", "runtime", "shared", "utils", "setUtils.js")
);

const { createSdkHelpers } = require(
  path.join(
    __dirname,
    "..",
    "dist",
    "runtime",
    "shared",
    "utils",
    "sdkHelpers.js"
  )
);

const { buildMethodOptions, parseMatrixOptions } = require(
  path.join(
    __dirname,
    "..",
    "dist",
    "runtime",
    "shared",
    "utils",
    "methodOptions.js"
  )
);

const { getProjectDir } = require(
  path.join(
    __dirname,
    "..",
    "dist",
    "runtime",
    "shared",
    "utils",
    "projectDir.js"
  )
);

test("setUtils.migrateToSets returns safe default when userData missing", () => {
  assert.deepEqual(migrateToSets(null), { config: {}, sets: [] });
  assert.deepEqual(migrateToSets(undefined), { config: {}, sets: [] });
});

test("setUtils.migrateToSets preserves userData when sets already exists", () => {
  const userData = { config: { x: 1 }, sets: [{ id: "a", tracks: [] }] };
  assert.equal(migrateToSets(userData), userData);
});

test("setUtils.migrateToSets migrates legacy tracks into sets and deletes tracks", () => {
  const legacy = { config: { foo: "bar" }, tracks: [{ id: "t1" }] };
  const migrated = migrateToSets(legacy);
  assert.equal(typeof migrated, "object");
  assert.equal(migrated.tracks, undefined);
  assert.deepEqual(migrated.sets, [
    { id: "set_1", name: "Set 1", tracks: [{ id: "t1" }] },
  ]);
  assert.deepEqual(migrated.config, { foo: "bar", activeSetId: "set_1" });
});

test("setUtils.getActiveSetTracks returns [] when no active set", () => {
  assert.deepEqual(getActiveSetTracks(null, null), []);
  assert.deepEqual(getActiveSetTracks({}, null), []);
});

test("setUtils.getActiveSet returns first set if activeSetId missing/not found", () => {
  const userData = {
    sets: [{ id: "s1", tracks: [1] }, { id: "s2", tracks: [2] }],
  };
  assert.deepEqual(getActiveSet(userData, null), userData.sets[0]);
  assert.deepEqual(getActiveSet(userData, "missing"), userData.sets[0]);
});

test("sdkHelpers returns null when impls missing", async () => {
  const { assetUrl, readText, loadJson } = createSdkHelpers();
  assert.equal(assetUrl("x"), null);
  assert.equal(await readText("x"), null);
  assert.equal(await loadJson("x"), null);
});

test("sdkHelpers normalizeRelPath throw => returns null (fail-safe)", async () => {
  const { assetUrl, readText, loadJson } = createSdkHelpers({
    normalizeRelPath: () => {
      throw new Error("boom");
    },
    assetUrlImpl: () => "ok",
    readTextImpl: async () => '{"ok":true}',
  });
  assert.equal(assetUrl("x"), null);
  assert.equal(await readText("x"), null);
  assert.equal(await loadJson("x"), null);
});

test("sdkHelpers loadJson invalid JSON => null", async () => {
  const { loadJson } = createSdkHelpers({
    readTextImpl: async () => "{nope}",
  });
  assert.equal(await loadJson("x"), null);
});

test("methodOptions does not throw for weird inputs", () => {
  assert.doesNotThrow(() => buildMethodOptions(null));
  assert.doesNotThrow(() => buildMethodOptions([null, 1, "x", {}]));
});

test("methodOptions output keys only from input name fields", () => {
  const out = buildMethodOptions([
    { name: "a", value: 1 },
    { name: "", value: 2 },
    { value: 3 },
    { name: "b", value: 4 },
  ]);
  assert.deepEqual(Object.keys(out).sort(), ["a", "b"]);
});

test("parseMatrixOptions clamps rows/cols to [1..5]", () => {
  assert.deepEqual(parseMatrixOptions([{ name: "matrix", value: [0, 99] }]), {
    rows: 1,
    cols: 5,
    excludedCells: [],
    border: false,
  });
  assert.deepEqual(parseMatrixOptions([{ name: "matrix", value: { rows: 6 } }]), {
    rows: 5,
    cols: 1,
    excludedCells: [],
    border: false,
  });
});

test("projectDir prefers SDK when present", () => {
  const prevSdk = globalThis.nwWrldSdk;
  const prevBridge = globalThis.nwWrldBridge;
  try {
    globalThis.nwWrldSdk = { getWorkspaceDir: () => "sdkDir" };
    globalThis.nwWrldBridge = { project: { getDir: () => "bridgeDir" } };
    assert.equal(getProjectDir(), "sdkDir");
  } finally {
    globalThis.nwWrldSdk = prevSdk;
    globalThis.nwWrldBridge = prevBridge;
  }
});

test("projectDir SDK throw => null (fail-safe)", () => {
  const prevSdk = globalThis.nwWrldSdk;
  const prevBridge = globalThis.nwWrldBridge;
  try {
    globalThis.nwWrldSdk = {
      getWorkspaceDir: () => {
        throw new Error("boom");
      },
    };
    globalThis.nwWrldBridge = { project: { getDir: () => "bridgeDir" } };
    assert.equal(getProjectDir(), null);
  } finally {
    globalThis.nwWrldSdk = prevSdk;
    globalThis.nwWrldBridge = prevBridge;
  }
});

test("projectDir falls back to bridge when SDK absent", () => {
  const prevSdk = globalThis.nwWrldSdk;
  const prevBridge = globalThis.nwWrldBridge;
  try {
    globalThis.nwWrldSdk = undefined;
    globalThis.nwWrldBridge = { project: { getDir: () => "bridgeDir" } };
    assert.equal(getProjectDir(), "bridgeDir");
  } finally {
    globalThis.nwWrldSdk = prevSdk;
    globalThis.nwWrldBridge = prevBridge;
  }
});

test("projectDir bridge throw => null (fail-safe)", () => {
  const prevSdk = globalThis.nwWrldSdk;
  const prevBridge = globalThis.nwWrldBridge;
  try {
    globalThis.nwWrldSdk = undefined;
    globalThis.nwWrldBridge = {
      project: {
        getDir: () => {
          throw new Error("boom");
        },
      },
    };
    assert.equal(getProjectDir(), null);
  } finally {
    globalThis.nwWrldSdk = prevSdk;
    globalThis.nwWrldBridge = prevBridge;
  }
});

test("projectDir returns null when neither SDK nor bridge available", () => {
  const prevSdk = globalThis.nwWrldSdk;
  const prevBridge = globalThis.nwWrldBridge;
  try {
    globalThis.nwWrldSdk = undefined;
    globalThis.nwWrldBridge = undefined;
    assert.equal(getProjectDir(), null);
  } finally {
    globalThis.nwWrldSdk = prevSdk;
    globalThis.nwWrldBridge = prevBridge;
  }
});

