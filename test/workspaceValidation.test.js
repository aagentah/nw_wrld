const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const {
  normalizeModuleSummaries,
  normalizeWorkspaceModuleScanResult,
  normalizeModuleWithMeta,
  normalizeModuleUrlResult,
} = require(path.join(
  __dirname,
  "..",
  "dist",
  "runtime",
  "shared",
  "validation",
  "workspaceValidation.js"
));

test("workspace normalizer filters and shapes module summaries", () => {
  const input = [
    null,
    { file: "A.js", id: "A", name: "A", category: "Cat", hasMetadata: true },
    { file: "B.js", id: "B", hasMetadata: false },
    { file: "", id: "C", hasMetadata: true },
    { file: "D.js", id: "", hasMetadata: true },
  ];
  const res = normalizeModuleSummaries(input);
  assert.deepEqual(res, [
    { file: "A.js", id: "A", name: "A", category: "Cat", hasMetadata: true },
    { file: "B.js", id: "B", hasMetadata: false },
  ]);
});

test("workspace normalizer shapes module scan result (summaries + skipped)", () => {
  const input = {
    summaries: [
      { file: "A.js", id: "A", name: "A", category: "Cat", hasMetadata: true },
      { file: "", id: "B", hasMetadata: false },
    ],
    skipped: [
      { file: "text copy.js", reason: "Invalid filename: must match ^[A-Za-z][A-Za-z0-9]*$" },
      { file: "", reason: "x" },
      null,
    ],
  };
  const res = normalizeWorkspaceModuleScanResult(input);
  assert.deepEqual(res, {
    summaries: [{ file: "A.js", id: "A", name: "A", category: "Cat", hasMetadata: true }],
    skipped: [{ file: "text copy.js", reason: "Invalid filename: must match ^[A-Za-z][A-Za-z0-9]*$" }],
  });
});

test("workspace normalizer accepts valid readModuleWithMeta result", () => {
  const res = normalizeModuleWithMeta({ text: "hello", mtimeMs: 123 });
  assert.deepEqual(res, { text: "hello", mtimeMs: 123 });
});

test("workspace normalizer rejects invalid readModuleWithMeta result", () => {
  assert.equal(normalizeModuleWithMeta({ text: "x", mtimeMs: "123" }), null);
});

test("workspace normalizer accepts valid getModuleUrl result", () => {
  const res = normalizeModuleUrlResult({ url: "file:///x.js?t=1", mtimeMs: 1 });
  assert.deepEqual(res, { url: "file:///x.js?t=1", mtimeMs: 1 });
});
