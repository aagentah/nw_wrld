const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const os = require("node:os");
const fs = require("node:fs");

const { findOffenders } = require(
  path.join(__dirname, "..", "dist", "scripts", "checkRuntimeLaneNoDuplicateSources.js")
);

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

test("findOffenders reports a .js duplicate next to a runtime TS include", () => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "nw_wrld-dupes-"));
  const tsconfigPath = path.join(repoRoot, "tsconfig.runtime.json");
  writeJson(tsconfigPath, { include: ["src/foo.ts"] });

  const tsPath = path.join(repoRoot, "src", "foo.ts");
  const jsPath = path.join(repoRoot, "src", "foo.js");
  fs.mkdirSync(path.dirname(tsPath), { recursive: true });
  fs.writeFileSync(tsPath, "export const x = 1;\n");
  fs.writeFileSync(jsPath, "module.exports = { x: 1 };\n");

  const offenders = findOffenders(repoRoot, tsconfigPath);
  assert.equal(offenders.length, 1);
  assert.equal(offenders[0].runtime, path.join("src", "foo.ts"));
  assert.deepEqual(offenders[0].duplicates, [path.join("src", "foo.js")]);
});

test("findOffenders returns empty when no duplicates exist", () => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "nw_wrld-dupes-"));
  const tsconfigPath = path.join(repoRoot, "tsconfig.runtime.json");
  writeJson(tsconfigPath, { include: ["src/foo.ts"] });

  const tsPath = path.join(repoRoot, "src", "foo.ts");
  fs.mkdirSync(path.dirname(tsPath), { recursive: true });
  fs.writeFileSync(tsPath, "export const x = 1;\n");

  const offenders = findOffenders(repoRoot, tsconfigPath);
  assert.deepEqual(offenders, []);
});
