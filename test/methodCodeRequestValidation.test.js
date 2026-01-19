const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const { normalizeGetMethodCodeArgs, escapeRegExpLiteral } = require(path.join(
  __dirname,
  "..",
  "dist",
  "runtime",
  "shared",
  "validation",
  "methodCodeRequestValidation.js"
));

test("normalizeGetMethodCodeArgs preserves valid method names", () => {
  assert.deepEqual(normalizeGetMethodCodeArgs("Any", "show"), { moduleName: "Any", methodName: "show" });
  assert.deepEqual(normalizeGetMethodCodeArgs("Any", "randomZoom"), {
    moduleName: "Any",
    methodName: "randomZoom",
  });
  assert.deepEqual(normalizeGetMethodCodeArgs("Any", "_internal"), {
    moduleName: "Any",
    methodName: "_internal",
  });
  assert.deepEqual(normalizeGetMethodCodeArgs("Any", "$x"), { moduleName: "Any", methodName: "$x" });
});

test("normalizeGetMethodCodeArgs rejects unsafe method names", () => {
  assert.deepEqual(normalizeGetMethodCodeArgs("Any", ""), { moduleName: "Any", methodName: null });
  assert.deepEqual(normalizeGetMethodCodeArgs("Any", "show()"), { moduleName: "Any", methodName: null });
  assert.deepEqual(normalizeGetMethodCodeArgs("Any", ".*"), { moduleName: "Any", methodName: null });
  assert.deepEqual(normalizeGetMethodCodeArgs("Any", "a b"), { moduleName: "Any", methodName: null });
  assert.deepEqual(normalizeGetMethodCodeArgs("Any", "\\"), { moduleName: "Any", methodName: null });
  assert.deepEqual(normalizeGetMethodCodeArgs("Any", null), { moduleName: "Any", methodName: null });
  assert.deepEqual(normalizeGetMethodCodeArgs("Any", 123), { moduleName: "Any", methodName: null });
});

test("escapeRegExpLiteral escapes regex meta characters", () => {
  assert.equal(escapeRegExpLiteral("a.b"), "a\\.b");
  assert.equal(escapeRegExpLiteral("a(b)"), "a\\(b\\)");
  assert.equal(escapeRegExpLiteral("[x]"), "\\[x\\]");
});

