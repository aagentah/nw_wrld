const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const { normalizeDashboardProjectorMessage } = require(path.join(
  __dirname,
  "..",
  "dist",
  "runtime",
  "shared",
  "validation",
  "dashboardProjectorIpcValidation.js"
));

test("normalizeDashboardProjectorMessage preserves valid message", () => {
  const msg = { type: "track-activate", props: { trackName: "A" } };
  assert.deepEqual(normalizeDashboardProjectorMessage(msg), msg);
});

test("normalizeDashboardProjectorMessage defaults props to {}", () => {
  assert.deepEqual(normalizeDashboardProjectorMessage({ type: "x" }), { type: "x", props: {} });
  assert.deepEqual(normalizeDashboardProjectorMessage({ type: "x", props: null }), {
    type: "x",
    props: {},
  });
  assert.deepEqual(normalizeDashboardProjectorMessage({ type: "x", props: [] }), {
    type: "x",
    props: {},
  });
});

test("normalizeDashboardProjectorMessage rejects missing/invalid type", () => {
  assert.equal(normalizeDashboardProjectorMessage(null), null);
  assert.equal(normalizeDashboardProjectorMessage({}), null);
  assert.equal(normalizeDashboardProjectorMessage({ type: "   " }), null);
  assert.equal(normalizeDashboardProjectorMessage({ type: 123 }), null);
});

test("normalizeDashboardProjectorMessage rejects overly long type", () => {
  const type = "x".repeat(129);
  assert.equal(normalizeDashboardProjectorMessage({ type, props: {} }), null);
});
