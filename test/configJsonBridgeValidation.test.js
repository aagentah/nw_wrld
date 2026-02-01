const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const { sanitizeJsonForBridge } = require(path.join(
  __dirname,
  "..",
  "dist",
  "runtime",
  "shared",
  "validation",
  "jsonBridgeValidation.js"
));

test("config.json sanitize returns defaultValue when value is not a plain object", () => {
  const defaultValue = { aspectRatio: "16-9" };
  assert.equal(sanitizeJsonForBridge("config.json", null, defaultValue), defaultValue);
  assert.equal(sanitizeJsonForBridge("config.json", [], defaultValue), defaultValue);
  assert.equal(sanitizeJsonForBridge("config.json", "x", defaultValue), defaultValue);
});

test("config.json sanitize is a no-op for plain object values (reference preserved)", () => {
  const defaultValue = { aspectRatio: "16-9" };
  const input = { aspectRatio: "4-3", extra: { nested: true } };
  const res = sanitizeJsonForBridge("config.json", input, defaultValue);
  assert.equal(res, input);
});

