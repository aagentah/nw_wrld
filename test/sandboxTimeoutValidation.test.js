const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const { normalizeSandboxTimeoutMs } = require(path.join(
  __dirname,
  "..",
  "dist",
  "runtime",
  "shared",
  "validation",
  "sandboxValidation.js"
));

test("normalizeSandboxTimeoutMs clamps to [1..60000] and floors to int", () => {
  assert.equal(normalizeSandboxTimeoutMs(null, 8000), 8000);
  assert.equal(normalizeSandboxTimeoutMs("x", 8000), 8000);
  assert.equal(normalizeSandboxTimeoutMs(NaN, 8000), 8000);
  assert.equal(normalizeSandboxTimeoutMs(-1, 8000), 8000);
  assert.equal(normalizeSandboxTimeoutMs(0, 8000), 8000);

  assert.equal(normalizeSandboxTimeoutMs(1.9, 8000), 1);
  assert.equal(normalizeSandboxTimeoutMs(60000.9, 8000), 60000);
  assert.equal(normalizeSandboxTimeoutMs(999999, 8000), 60000);
});

