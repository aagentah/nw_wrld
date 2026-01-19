const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const { validateOptionValue, validateRandomRange, validateMethodOptions } = require(
  path.join(__dirname, "..", "dist", "runtime", "shared", "validation", "optionValidator.js")
);

test("validateOptionValue preserves valid number within range", () => {
  const opt = { name: "x", type: "number", defaultVal: 5, min: 0, max: 10 };
  assert.equal(validateOptionValue(opt, 7), 7);
});

test("validateOptionValue contains invalid number and clamps out-of-range", () => {
  const opt = { name: "x", type: "number", defaultVal: 5, min: 0, max: 10 };
  assert.equal(validateOptionValue(opt, "7"), 5);
  assert.equal(validateOptionValue(opt, -1), 0);
  assert.equal(validateOptionValue(opt, 11), 10);
});

test("validateOptionValue clamps using numeric-string min/max (back-compat)", () => {
  const opt = { name: "x", type: "number", defaultVal: 5, min: "0", max: "10" };
  assert.equal(validateOptionValue(opt, -1), 0);
  assert.equal(validateOptionValue(opt, 11), 10);
});

test("validateOptionValue validates select and allows 'random'", () => {
  const opt = { name: "mode", type: "select", defaultVal: "a", values: ["a", "b"] };
  assert.equal(validateOptionValue(opt, "b"), "b");
  assert.equal(validateOptionValue(opt, "c"), "a");
  assert.equal(validateOptionValue(opt, "random"), "random");
});

test("validateRandomRange rejects invalid and swaps inverted range", () => {
  const opt = { name: "rr", type: "number", defaultVal: 0 };
  assert.equal(validateRandomRange(opt, null), null);
  assert.deepEqual(validateRandomRange(opt, [5, 2]), [2, 5]);
});

test("validateMethodOptions validates known options and preserves unknown options", () => {
  const methodDefinition = {
    name: "m",
    options: [{ name: "opacity", type: "number", defaultVal: 1, min: 0, max: 1 }],
  };
  const optionsToValidate = [
    { name: "opacity", value: 2 },
    { name: "unknown", value: "x" },
  ];
  const out = validateMethodOptions(methodDefinition, optionsToValidate);
  assert.equal(Array.isArray(out), true);
  assert.equal(out[0].value, 1);
  assert.equal(out[1].name, "unknown");
  assert.equal(out[1].value, "x");
});

test("validateMethodOptions does not throw on malformed options array entries", () => {
  const methodDefinition = {
    name: "m",
    options: [{ name: "opacity", type: "number", defaultVal: 1, min: 0, max: 1 }],
  };
  assert.doesNotThrow(() => {
    const out = validateMethodOptions(methodDefinition, [
      null,
      123,
      "x",
      { name: "opacity", value: 2 },
    ]);
    assert.equal(Array.isArray(out), true);
    assert.equal(out.length, 4);
    assert.equal(out[3].value, 1);
  });
});

test("validateMethodOptions returns [] for non-array inputs", () => {
  assert.deepEqual(validateMethodOptions({ name: "m", options: [] }, null), []);
  assert.deepEqual(validateMethodOptions({ name: "m", options: [] }, {}), []);
});
