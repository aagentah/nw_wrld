const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const { normalizeSandboxResult } = require(path.join(
  __dirname,
  "..",
  "dist",
  "runtime",
  "shared",
  "validation",
  "sandboxValidation.js"
));
const { normalizeSandboxRequestProps } = require(path.join(
  __dirname,
  "..",
  "dist",
  "runtime",
  "shared",
  "validation",
  "sandboxValidation.js"
));

test("sandbox normalizer preserves valid invokeOnInstance ok:true", () => {
  const input = { ok: true };
  const res = normalizeSandboxResult("invokeOnInstance", input);
  assert.deepEqual(res, input);
});

test("sandbox normalizer coerces invalid result into ok:false envelope", () => {
  const res = normalizeSandboxResult("invokeOnInstance", null);
  assert.deepEqual(res, { ok: false, error: "INVALID_RESULT" });
});

test("sandbox normalizer normalizes introspectModule output shape", () => {
  const input = {
    ok: true,
    name: "MyModule",
    category: "Workspace",
    callableMethods: ["a", "b"],
    methods: [{ name: "a" }, { name: "b" }],
  };
  const res = normalizeSandboxResult("introspectModule", input);
  assert.deepEqual(res, input);
});

test("sandbox normalizer fills missing introspectModule fields safely", () => {
  const res = normalizeSandboxResult("introspectModule", { ok: true });
  assert.deepEqual(res, { ok: true, methods: [], callableMethods: [] });
});

test("sandbox normalizer ensures error is a string on ok:false", () => {
  const res = normalizeSandboxResult("invokeOnInstance", {
    ok: false,
    error: 42,
  });
  assert.deepEqual(res, { ok: false, error: "42" });
});

test("sandbox normalizer preserves moduleType on initTrack ok:false when safe", () => {
  const res = normalizeSandboxResult("initTrack", {
    ok: false,
    error: "Invalid or unexpected token",
    moduleType: "BadSyntax",
  });
  assert.deepEqual(res, {
    ok: false,
    error: "Invalid or unexpected token",
    moduleType: "BadSyntax",
  });
});

test("sandbox request normalizer rejects missing invokeOnInstance fields", () => {
  assert.deepEqual(normalizeSandboxRequestProps("invokeOnInstance", {}), {
    ok: false,
    error: "INVALID_INSTANCE_ID",
  });
});

test("sandbox request normalizer normalizes invokeOnInstance options to object", () => {
  const res = normalizeSandboxRequestProps("invokeOnInstance", {
    instanceId: "x",
    methodName: "y",
    options: null,
  });
  assert.deepEqual(res, {
    ok: true,
    props: { instanceId: "x", methodName: "y", options: {} },
  });
});
