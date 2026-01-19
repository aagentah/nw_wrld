const test = require("node:test");
const assert = require("node:assert/strict");

const { parseNwWrldDocblockMetadata } = require("../dist/runtime/shared/nwWrldDocblock.js");

test("parseNwWrldDocblockMetadata: parses name/category/imports and sets hasMetadata", () => {
  const text = [
    "/*",
    '@nwWrld name: "Hello World"',
    "@nwWrld category: Visuals",
    "@nwWrld imports: ModuleBase, THREE, ModuleBase",
    "*/",
    "export default class X {}",
  ].join("\n");

  const meta = parseNwWrldDocblockMetadata(text);
  assert.deepEqual(meta, {
    name: "Hello World",
    category: "Visuals",
    imports: ["ModuleBase", "THREE"],
    hasMetadata: true,
  });
});

test("parseNwWrldDocblockMetadata: missing fields yields hasMetadata false", () => {
  const text = [
    "/*",
    "@nwWrld name: Foo",
    "@nwWrld category: Bar",
    "@nwWrld imports:",
    "*/",
  ].join("\n");

  const meta = parseNwWrldDocblockMetadata(text);
  assert.equal(meta.hasMetadata, false);
  assert.equal(meta.name, "Foo");
  assert.equal(meta.category, "Bar");
  assert.deepEqual(meta.imports, []);
});

