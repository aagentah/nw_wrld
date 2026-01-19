const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const { normalizeSandboxPerfStats } = require(path.join(
  __dirname,
  "..",
  "dist",
  "runtime",
  "shared",
  "validation",
  "perfValidation.js"
));

test("perf normalizer preserves valid stats (within bounds)", () => {
  const input = {
    fps: 59.7,
    frameMsAvg: 16.8,
    longFramePct: 2.5,
    at: 1700000000000,
  };
  const res = normalizeSandboxPerfStats(input);
  assert.deepEqual(res, input);
});

test("perf normalizer clamps out-of-range values and defaults longFramePct", () => {
  const res = normalizeSandboxPerfStats({
    fps: 9999,
    frameMsAvg: -5,
    at: 1,
  });
  assert.deepEqual(res, { fps: 240, frameMsAvg: 0, longFramePct: 0, at: 1 });
});

test("perf normalizer rejects invalid shapes", () => {
  assert.equal(normalizeSandboxPerfStats(null), null);
  assert.equal(normalizeSandboxPerfStats({}), null);
  assert.equal(
    normalizeSandboxPerfStats({ fps: 60, frameMsAvg: 16, longFramePct: 0 }),
    null
  );
});

